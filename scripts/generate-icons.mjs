// Genera los íconos PNG de la PWA (árbol de Navidad) sin dependencias externas.
// Uso: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = {
  bg: hex('#176b45'),
  bgDark: hex('#0e432c'),
  tree: hex('#ddf2e5'),
  treeShade: hex('#b9e3c9'),
  trunk: hex('#8a6410'),
  star: hex('#f2b824'),
  berry: hex('#de4343'),
  sky: hex('#8ed4fb'),
  gold: hex('#f7d066'),
};

// --- formas en coordenadas normalizadas (0..1) ---
const inTri = (x, y, [ax, ay], [bx, by], [cx, cy]) => {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
};
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const inStar = (x, y, cx, cy, R, r) => {
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > R) return false;
  let a = Math.atan2(dy, dx) + Math.PI / 2; // punta hacia arriba
  const seg = (2 * Math.PI) / 5;
  a = ((a % seg) + seg) % seg;
  const t = Math.abs(a - seg / 2) / (seg / 2); // 0 en el valle, 1 en la punta
  // borde interpolado entre radio interno y externo (aprox. lineal en ángulo)
  const edge = r + (R - r) * t ** 1.6;
  return dist <= edge;
};

/** Devuelve el color de un punto (x,y ∈ 0..1). `scale` encoge el dibujo hacia el centro. */
function shade(x, y, { scale, rounded }) {
  if (rounded && !inRoundRect(x, y, 0, 0, 1, 1, 0.22)) return null; // transparente
  // dibujo centrado y escalado
  const u = (x - 0.5) / scale + 0.5;
  const v = (y - 0.5) / scale + 0.5;

  if (inStar(u, v, 0.5, 0.17, 0.095, 0.04)) return C.star;
  // adornos
  const balls = [
    [0.44, 0.36, C.berry],
    [0.58, 0.5, C.gold],
    [0.38, 0.6, C.sky],
    [0.62, 0.7, C.berry],
    [0.47, 0.74, C.gold],
  ];
  for (const [bx, by, col] of balls) if (inCircle(u, v, bx, by, 0.032)) return col;

  const tiers = [
    [[0.5, 0.2], [0.32, 0.44], [0.68, 0.44]],
    [[0.5, 0.31], [0.26, 0.6], [0.74, 0.6]],
    [[0.5, 0.44], [0.2, 0.78], [0.8, 0.78]],
  ];
  for (const [a, b, c] of tiers) {
    if (inTri(u, v, a, b, c)) return u > 0.5 ? C.treeShade : C.tree;
  }
  if (u > 0.44 && u < 0.56 && v >= 0.78 && v <= 0.88) return C.trunk;
  // suelo nevado
  if (inCircle(u, v, 0.5, 1.55, 0.68)) return C.bgDark;
  return C.bg;
}

function render(size, opts) {
  const SS = 4; // supermuestreo para bordes suaves
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const col = shade((i + (si + 0.5) / SS) / size, (j + (sj + 0.5) / SS) / size, opts);
          if (!col) continue;
          r += col[0]; g += col[1]; b += col[2]; a += 1;
        }
      }
      const o = (j * size + i) * 4;
      if (a) {
        px[o] = Math.round(r / a);
        px[o + 1] = Math.round(g / a);
        px[o + 2] = Math.round(b / a);
      }
      px[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return encodePng(size, size, px);
}

// --- codificador PNG mínimo (RGBA 8 bits) ---
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filtro: ninguno
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = {
  'icon-192.png': render(192, { scale: 1, rounded: true }),
  'icon-512.png': render(512, { scale: 1, rounded: true }),
  // "maskable": fondo a sangre y dibujo dentro de la zona segura (80 %)
  'maskable-512.png': render(512, { scale: 0.78, rounded: false }),
  // iOS redondea por su cuenta: fondo completo
  'apple-touch-icon.png': render(180, { scale: 0.9, rounded: false }),
};
for (const [name, data] of Object.entries(files)) {
  writeFileSync(new URL(name, OUT), data);
  console.log(`✔ public/icons/${name} (${data.length} bytes)`);
}
