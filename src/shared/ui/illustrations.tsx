/**
 * Ilustraciones propias en SVG (livianas, sin imágenes externas).
 * Todas son decorativas: llevan aria-hidden y nunca reemplazan un texto.
 */

/** Paisaje nevado con pinos y una casita iluminada; se ancla al borde inferior de un banner.
 *  La nieve del frente usa `currentColor` (text-white, text-brand-page…) para fundirse con lo que sigue. */
export function WinterScene({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 110" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden focusable="false">
      {/* colinas del fondo */}
      <path d="M0 78 C60 48 120 52 180 70 C240 88 300 50 400 62 V110 H0 Z" fill="#ffffff" opacity="0.22" />
      {/* pinos lejanos */}
      <g fill="#ffffff" opacity="0.3">
        <path d="M36 74 l10 -22 l10 22 z M41 60 l5 -13 l5 13 z" />
        <path d="M350 62 l9 -20 l9 20 z M354.5 49 l4.5 -12 l4.5 12 z" />
      </g>
      {/* casita */}
      <g transform="translate(262 46)">
        <path d="M-4 22 L20 4 L44 22 Z" fill="#ffffff" />
        <rect x="2" y="22" width="36" height="24" rx="2" fill="#223a63" />
        <rect x="8" y="28" width="9" height="9" rx="1.5" fill="#f2d27d" />
        <rect x="23" y="28" width="9" height="18" rx="1.5" fill="#e7b84b" />
        <rect x="28" y="2" width="6" height="12" fill="#223a63" />
        <rect x="27" y="0" width="8" height="4" rx="2" fill="#ffffff" />
      </g>
      {/* colina del frente */}
      <path d="M0 96 C70 70 150 74 220 88 C290 102 340 82 400 88 V110 H0 Z" fill="currentColor" />
      {/* pinos del frente */}
      <g transform="translate(92 44)">
        <rect x="10" y="40" width="6" height="10" rx="1" fill="#6b4d0b" />
        <path d="M13 0 L26 22 H0 Z" fill="#176b45" />
        <path d="M13 12 L29 34 H-3 Z" fill="#125538" />
        <path d="M13 24 L32 44 H-6 Z" fill="#176b45" />
        <path d="M13 0 l4 7 h-8 z" fill="#ffffff" />
        <circle cx="13" cy="-1" r="3" fill="#e7b84b" />
      </g>
      <g transform="translate(150 60) scale(0.7)">
        <rect x="10" y="40" width="6" height="10" rx="1" fill="#6b4d0b" />
        <path d="M13 0 L26 22 H0 Z" fill="#176b45" />
        <path d="M13 12 L29 34 H-3 Z" fill="#125538" />
        <path d="M13 24 L32 44 H-6 Z" fill="#176b45" />
        <path d="M13 0 l4 7 h-8 z" fill="#ffffff" />
      </g>
    </svg>
  );
}

/** Estrellas que titilan suavemente (solo opacidad/escala: no afecta el rendimiento). */
export function Stars() {
  const stars = [
    { top: '12%', left: '8%', size: 6, delay: '0s' },
    { top: '22%', left: '34%', size: 4, delay: '0.8s' },
    { top: '10%', left: '58%', size: 5, delay: '1.6s' },
    { top: '34%', left: '72%', size: 4, delay: '0.4s' },
    { top: '18%', left: '88%', size: 6, delay: '2.2s' },
    { top: '44%', left: '20%', size: 3, delay: '1.2s' },
  ];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-gold-300 motion-safe:animate-twinkle"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: s.delay, boxShadow: '0 0 8px 1px rgb(242 210 125 / 0.7)' }}
        />
      ))}
    </div>
  );
}

export type GiftTone = 'berry' | 'pine' | 'night' | 'gold';

const giftPalette: Record<GiftTone, { box: string; shade: string; ribbon: string }> = {
  berry: { box: '#c62828', shade: '#a31f1f', ribbon: '#e7b84b' },
  pine: { box: '#176b45', shade: '#125538', ribbon: '#e7b84b' },
  night: { box: '#2c4a7c', shade: '#223a63', ribbon: '#f2d27d' },
  gold: { box: '#e7b84b', shade: '#c99a2e', ribbon: '#c62828' },
};

/** Caja de regalo. Con `open`, la tapa se levanta (animación de "abrir el regalo"). */
export function GiftBox({ tone = 'berry', open = false, className = '' }: { tone?: GiftTone; open?: boolean; className?: string }) {
  const c = giftPalette[tone];
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      {open && (
        <g fill="#e7b84b">
          <path d="M32 6 l1.8 4.6 4.6 1.8 -4.6 1.8 -1.8 4.6 -1.8 -4.6 -4.6 -1.8 4.6 -1.8z" />
          <circle cx="14" cy="14" r="2" />
          <circle cx="51" cy="11" r="1.6" />
        </g>
      )}
      {/* caja */}
      <rect x="10" y="30" width="44" height="28" rx="4" fill={c.box} />
      <rect x="10" y="30" width="44" height="6" fill={c.shade} opacity="0.55" />
      <rect x="28" y="30" width="8" height="28" fill={c.ribbon} />
      {/* tapa + moño */}
      <g
        style={{
          transformBox: 'fill-box',
          transformOrigin: '20% 100%',
          transform: open ? 'translateY(-9px) rotate(-14deg)' : 'none',
          transition: 'transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.3)',
        }}
      >
        <rect x="6" y="20" width="52" height="12" rx="4" fill={c.box} />
        <rect x="6" y="28" width="52" height="4" rx="2" fill={c.shade} opacity="0.5" />
        <rect x="28" y="20" width="8" height="12" fill={c.ribbon} />
        <path d="M32 20 C24 6 12 10 18 18 C21 21 28 21 32 20 Z" fill={c.ribbon} />
        <path d="M32 20 C40 6 52 10 46 18 C43 21 36 21 32 20 Z" fill={c.ribbon} />
        <circle cx="32" cy="19" r="3.4" fill={c.ribbon} stroke={c.shade} strokeOpacity="0.35" />
      </g>
    </svg>
  );
}
