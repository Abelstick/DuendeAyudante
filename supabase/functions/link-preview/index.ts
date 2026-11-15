// Edge Function: lee el enlace de una tienda y devuelve nombre, precio y foto
// para llenar un regalo. Solo para usuarios con sesión (verify_jwt = true).
// No guarda nada. Protecciones: solo direcciones públicas http(s), máximo
// 4 redirecciones (cada una se vuelve a revisar), 8 segundos y 1.5 MB.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { getCallerId } from '../_shared/supabase.ts';
import { isPrivateIpv4, isSafePublicUrl, parseLinkMetadata } from './parse.ts';

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 8_000;

/** Además de mirar el texto, revisa a qué IP apunta el nombre (si el entorno lo permite). */
async function resolvesToPublicIp(hostname: string): Promise<boolean> {
  if (/^[\d.]+$/.test(hostname)) return !isPrivateIpv4(hostname);
  try {
    const ips = await Deno.resolveDns(hostname, 'A');
    return ips.length > 0 && ips.every((ip) => !isPrivateIpv4(ip));
  } catch {
    // Sin resolución de DNS disponible: nos quedamos con la revisión del texto
    return true;
  }
}

async function fetchPage(start: string, signal: AbortSignal): Promise<{ html: string; finalUrl: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafePublicUrl(url) || !(await resolvesToPublicIp(new URL(url).hostname))) {
      throw new HttpError(400, 'LINK_NOT_ALLOWED');
    }
    const res = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: {
        // Muchas tiendas solo muestran los datos del producto a navegadores
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'Accept-Language': 'es-PE,es;q=0.9,en;q=0.5',
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('Location');
      await res.body?.cancel();
      if (!location) break;
      url = new URL(location, url).toString();
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new HttpError(422, 'LINK_PREVIEW_FAILED');
    }
    const type = res.headers.get('Content-Type') ?? '';
    if (!/html|xml/i.test(type)) {
      await res.body?.cancel();
      throw new HttpError(422, 'LINK_PREVIEW_EMPTY');
    }

    // Leer como máximo MAX_BYTES (los datos del producto están arriba, en <head>)
    const reader = res.body?.getReader();
    if (!reader) throw new HttpError(422, 'LINK_PREVIEW_FAILED');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.byteLength;
    }
    await reader.cancel().catch(() => undefined);
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c.subarray(0, Math.min(c.byteLength, size - offset)), offset);
      offset += c.byteLength;
    }
    return { html: new TextDecoder('utf-8').decode(bytes), finalUrl: url };
  }
  throw new HttpError(422, 'LINK_PREVIEW_FAILED');
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
      throw new HttpError(422, 'LINK_PREVIEW_FAILED');
    }

    const data = parseLinkMetadata(page.html, page.finalUrl);
    if (!data.title && data.price === null) throw new HttpError(422, 'LINK_PREVIEW_EMPTY');
    return data;
  }),
);
