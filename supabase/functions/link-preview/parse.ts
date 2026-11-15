// Lee de una página de tienda lo que sirve para llenar un regalo: nombre,
// precio, moneda y foto. Usa lo que las tiendas publican para compartir
// enlaces (Open Graph), microdatos y JSON-LD de productos.
// Código puro (sin APIs de Deno): lo prueban las pruebas de vitest.

export interface LinkMetadata {
  title: string | null;
  price: number | null;
  currency: string | null;
  image: string | null;
  siteName: string | null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const clean = (text: string | null | undefined, max = 300): string | null => {
  if (!text) return null;
  const out = decodeEntities(text).replace(/\s+/g, ' ').trim();
  return out ? out.slice(0, max) : null;
};

/**
 * "S/ 1,299.90" → 1299.9 · "1.299,90" → 1299.9 · "59,9" → 59.9 · "1,299" → 1299.
 * Devuelve null si no es un precio razonable.
 */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 && raw < 100_000_000 ? Math.round(raw * 100) / 100 : null;
  if (typeof raw !== 'string') return null;
  let s = raw.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // El último separador es el decimal
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    s = s.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = s.split(sep);
    const tail = parts[parts.length - 1] ?? '';
    // Un solo separador con 1–2 cifras al final: decimales; si no, miles
    s = parts.length === 2 && tail.length > 0 && tail.length <= 2 ? `${parts[0]}.${tail}` : parts.join('');
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? Math.round(n * 100) / 100 : null;
}

/** Atributos de cada etiqueta <meta>, en minúsculas. */
function metaTags(html: string): Record<string, string>[] {
  const tags: Record<string, string>[] = [];
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([a-zA-Z_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      attrs[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
    }
    tags.push(attrs);
  }
  return tags;
}

function findMeta(tags: Record<string, string>[], ...keys: string[]): string | null {
  for (const key of keys) {
    const tag = tags.find((t) => (t.property ?? t.name ?? t.itemprop)?.toLowerCase() === key && t.content);
    if (tag?.content) return tag.content;
  }
  return null;
}

interface ProductInfo {
  name?: unknown;
  image?: unknown;
  price?: unknown;
  currency?: unknown;
}

/** Busca un Product (o su oferta) dentro de los bloques JSON-LD. */
function jsonLdProduct(html: string): ProductInfo | null {
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    const stack: unknown[] = [data];
    while (stack.length > 0) {
      const node = stack.pop();
      if (Array.isArray(node)) {
        stack.push(...node);
        continue;
      }
      if (!node || typeof node !== 'object') continue;
      const obj = node as Record<string, unknown>;
      const type = obj['@type'];
      const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
      if (isProduct) {
        const offers = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
        const offer = (offers && typeof offers === 'object' ? offers : {}) as Record<string, unknown>;
        const image = Array.isArray(obj.image) ? obj.image[0] : obj.image;
        return {
          name: obj.name,
          image: image && typeof image === 'object' ? (image as Record<string, unknown>).url : image,
          price: offer.price ?? offer.lowPrice,
          currency: offer.priceCurrency,
        };
      }
      if (obj['@graph']) stack.push(obj['@graph']);
    }
  }
  return null;
}

/** Quita el nombre de la tienda del final del título: "Polo azul | Tienda" → "Polo azul". */
function stripSiteName(title: string, siteName: string | null): string {
  const parts = title.split(/\s+[|–—-]\s+/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1]!.toLowerCase();
    if ((siteName && last.includes(siteName.toLowerCase().split(/[\s.]/)[0] ?? '')) || /\.(com|pe|net|org)\b/.test(last)) {
      return parts.slice(0, -1).join(' - ');
    }
  }
  return title;
}

function absoluteUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(value.trim()), base);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseLinkMetadata(html: string, pageUrl: string): LinkMetadata {
  const tags = metaTags(html);
  const product = jsonLdProduct(html);
  const siteName = clean(findMeta(tags, 'og:site_name'), 80);

  const rawTitle =
    clean(typeof product?.name === 'string' ? product.name : null) ??
    clean(findMeta(tags, 'og:title', 'twitter:title')) ??
    clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const title = rawTitle ? stripSiteName(rawTitle, siteName).slice(0, 120) : null;

  const price =
    parsePrice(product?.price) ??
    parsePrice(findMeta(tags, 'product:price:amount', 'og:price:amount', 'price', 'twitter:data1'));

  const currencyRaw =
    (typeof product?.currency === 'string' ? product.currency : null) ?? findMeta(tags, 'product:price:currency', 'og:price:currency', 'pricecurrency');
  const currency = currencyRaw && /^[A-Za-z]{3}$/.test(currencyRaw.trim()) ? currencyRaw.trim().toUpperCase() : null;

  const image = absoluteUrl(
    (typeof product?.image === 'string' ? product.image : null) ?? findMeta(tags, 'og:image', 'og:image:url', 'twitter:image'),
    pageUrl,
  );

  return { title, price, currency, image, siteName };
}

// ---------------------------------------------------------------------
// Protección: no dejar que la función lea direcciones internas
// ---------------------------------------------------------------------

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** ¿Es una dirección pública http(s) que se puede leer? */
export function isSafePublicUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== '80' && url.port !== '443') return false;
  const host = url.hostname.toLowerCase();
  if (host.startsWith('[') || host.includes(':')) return false; // IPv6 literal
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (!host.includes('.')) return false;
  if (/^[\d.]+$/.test(host)) return !isPrivateIpv4(host) && host.split('.').length === 4;
  return true;
}

export { isPrivateIpv4 };
