// Edge Function: lee el enlace de una tienda y devuelve nombre, precio y foto
// para llenar un regalo. Solo para usuarios con sesión (verify_jwt = true).
// No guarda nada. Protecciones: solo direcciones públicas http(s), máximo
// 4 redirecciones (cada una se vuelve a revisar), 10 segundos y 1.5 MB.
//
// Algunas tiendas no responden a servidores (bloquean o demoran a las nubes
// fuera del país). Entonces se usa el nombre del producto que viene en el
// mismo enlace (source = 'url') y se informa el motivo (reason) para revisarlo
// en los logs de Supabase.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { getCallerId } from '../_shared/supabase.ts';
import { isPrivateIpv4, isSafePublicUrl, parseLinkMetadata, titleFromUrl, type LinkMetadata } from './parse.ts';

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 10_000;
const DNS_TIMEOUT_MS = 2_000;

/** Motivo del fallo al leer la página (para los logs y para quien llama). */
class PageError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}

/** Además de mirar el texto, revisa a qué IP apunta el nombre (si el entorno lo permite). */
async function resolvesToPublicIp(hostname: string): Promise<boolean> {
  if (/^[\d.]+$/.test(hostname)) return !isPrivateIpv4(hostname);
  try {
    const ips = await Promise.race([
      Deno.resolveDns(hostname, 'A'),
      new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error('dns-timeout')), DNS_TIMEOUT_MS)),
    ]);
    return ips.length > 0 && ips.every((ip) => !isPrivateIpv4(ip));
  } catch {
    // Sin resolución de DNS disponible (o lenta): nos quedamos con la revisión del texto
    return true;
  }
}

async function fetchPage(start: string, signal: AbortSignal): Promise<{ html: string; finalUrl: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafePublicUrl(url) || !(await resolvesToPublicIp(new URL(url).hostname))) {
      throw new HttpError(400, 'LINK_NOT_ALLOWED');
    }
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal,
        headers: {
          // Muchas tiendas solo muestran los datos del producto a navegadores
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'Accept-Language': 'es-PE,es;q=0.9,en;q=0.5',
        },
      });
    } catch (err) {
      throw new PageError(signal.aborted ? 'timeout' : `network: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200));
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('Location');
      await res.body?.cancel();
      if (!location) throw new PageError(`redirect-without-location-${res.status}`);
      url = new URL(location, url).toString();
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new PageError(`status-${res.status}`);
    }
    const type = res.headers.get('Content-Type') ?? '';
    if (!/html|xml/i.test(type)) {
      await res.body?.cancel();
      throw new PageError(`not-html: ${type.slice(0, 60)}`);
    }

    // Leer como máximo MAX_BYTES (los datos del producto suelen estar arriba)
    const reader = res.body?.getReader();
    if (!reader) throw new PageError('empty-body');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (size < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        size += value.byteLength;
      }
    } catch {
      // Se cortó a mitad (tiempo agotado): se usa lo que llegó
      if (size === 0) throw new PageError(signal.aborted ? 'timeout' : 'read-failed');
    }
    await reader.cancel().catch(() => undefined);
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      const part = c.subarray(0, Math.min(c.byteLength, size - offset));
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    return { html: new TextDecoder('utf-8').decode(bytes), finalUrl: url };
  }
  throw new PageError('too-many-redirects');
}

/** Lo que se devuelve cuando la página no se pudo leer: el nombre que trae el enlace. */
function fromUrlOnly(raw: string, reason: string): LinkMetadata & { source: 'url'; reason: string } {
  const title = titleFromUrl(raw);
  if (!title) throw new HttpError(422, reason === 'no-product-data' ? 'LINK_PREVIEW_EMPTY' : 'LINK_PREVIEW_FAILED', { reason });
  return { title, price: null, currency: null, image: null, siteName: null, source: 'url', reason };
}

Deno.serve(
  handler(async (req) => {
    await getCallerId(req);
    const body = await readJson(req);
    const raw = typeof body.url === 'string' ? body.url.trim() : '';
    if (!raw || raw.length > 2000) throw new HttpError(400, 'LINK_INVALID');

    const signal = AbortSignal.timeout(TIMEOUT_MS);
    let page: { html: string; finalUrl: string };
    try {
      page = await fetchPage(raw, signal);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      const reason = err instanceof PageError ? err.reason : 'unknown';
      console.warn(`link-preview: no se pudo leer ${new URL(raw).hostname}: ${reason}`);
      return fromUrlOnly(raw, reason);
    }

    const data = parseLinkMetadata(page.html, page.finalUrl);
    if (!data.title && data.price === null) {
      console.warn(`link-preview: ${new URL(raw).hostname} sin datos de producto`);
      return fromUrlOnly(raw, 'no-product-data');
    }
    return { ...data, source: 'page' as const };
  }),
);
