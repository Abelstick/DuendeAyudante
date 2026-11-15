import type { CSSProperties, ReactNode } from 'react';

/**
 * Ilustraciones vectoriales propias (formas redondeadas y colores planos, sin píxeles).
 * Son decorativas: llevan aria-hidden y nunca reemplazan un texto.
 */

const INK = '#0f1e38';

interface ArtProps {
  className?: string;
  style?: CSSProperties;
}

function Svg({ viewBox, className = '', style, children }: ArtProps & { viewBox: string; children: ReactNode }) {
  return (
    <svg viewBox={viewBox} className={className} style={style} aria-hidden focusable="false">
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------ Piezas (para reutilizar dentro de escenas) */

/** Pino nevado; ocupa 48 × 64. */
function TreeArt() {
  return (
    <g strokeLinejoin="round">
      <rect x="20" y="50" width="8" height="12" rx="2" fill="#7a4a21" />
      <path d="M24 26 L42 52 H6 Z" fill="#125538" stroke="#125538" strokeWidth="6" />
      <path d="M24 14 L38 38 H10 Z" fill="#176b45" stroke="#176b45" strokeWidth="6" />
      <path d="M24 6 L33 24 H15 Z" fill="#1f8a55" stroke="#1f8a55" strokeWidth="6" />
      {/* nieve */}
      <path d="M24 5 L30 16 Q27 14 24 17 Q21 14 18 16 Z" fill="#fff" stroke="#fff" strokeWidth="3" />
      <path d="M12 37 Q16 34 19 38 Q23 34 27 38 Q31 34 36 37" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      {/* adornos */}
      <circle cx="19" cy="30" r="2.6" fill="#f2b824" />
      <circle cx="30" cy="45" r="2.6" fill="#de4343" />
      <circle cx="16" cy="48" r="2.6" fill="#8ed4fb" />
    </g>
  );
}

/** Estrella de cinco puntas con brillo; ocupa 48 × 48. */
function StarArt() {
  return (
    <g strokeLinejoin="round">
      <path
        d="M24 5 L29.6 17.3 L43 18.8 L33 27.9 L35.8 41.1 L24 34.4 L12.2 41.1 L15 27.9 L5 18.8 L18.4 17.3 Z"
        fill="#f2b824"
        stroke="#f2b824"
        strokeWidth="5"
      />
      <path d="M24 11 L27.6 19.6 L24 22 L20.4 19.6 Z" fill="#f7d066" stroke="#f7d066" strokeWidth="3" />
    </g>
  );
}

/** Muñeco de nieve; ocupa 48 × 64. */
function SnowmanArt() {
  return (
    <g>
      <circle cx="24" cy="46" r="16" fill="#fff" />
      <circle cx="24" cy="24" r="11" fill="#fff" />
      <path d="M8 50 A16 16 0 0 0 40 50 A20 14 0 0 1 8 50" fill="#dbe4f3" />
      <rect x="15" y="4" width="18" height="11" rx="3" fill={INK} />
      <rect x="11" y="13" width="26" height="4" rx="2" fill={INK} />
      <rect x="15" y="10" width="18" height="3" fill="#de4343" />
      <circle cx="20" cy="22" r="1.8" fill={INK} />
      <circle cx="28" cy="22" r="1.8" fill={INK} />
      <path d="M24 25 L34 27.5 L24 29 Z" fill="#f2913a" strokeLinejoin="round" stroke="#f2913a" strokeWidth="1.5" />
      <path d="M13 32 Q24 38 35 32" fill="none" stroke="#de4343" strokeWidth="5" strokeLinecap="round" />
      <path d="M31 34 V43" stroke="#de4343" strokeWidth="5" strokeLinecap="round" />
      <circle cx="24" cy="44" r="1.8" fill={INK} />
      <circle cx="24" cy="51" r="1.8" fill={INK} />
    </g>
  );
}

export type GiftTone = 'berry' | 'pine' | 'night' | 'gold';

const giftPalette: Record<GiftTone, { box: string; shade: string; ribbon: string }> = {
  berry: { box: '#de4343', shade: '#a31f1f', ribbon: '#f7d066' },
  pine: { box: '#1f8a55', shade: '#125538', ribbon: '#f7d066' },
  night: { box: '#3f6bb3', shade: '#223a63', ribbon: '#f7d066' },
  gold: { box: '#f2b824', shade: '#b98512', ribbon: '#de4343' },
};

/** Regalo; ocupa 48 × 48 (la tapa se mueve con `open`). */
function GiftArt({ tone, open }: { tone: GiftTone; open: boolean }) {
  const c = giftPalette[tone];
  return (
    <g>
      {open && (
        <g fill="#f2b824">
          <path d="M24 3 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
          <circle cx="10" cy="11" r="2" />
          <circle cx="39" cy="9" r="1.6" />
        </g>
      )}
      <rect x="8" y="22" width="32" height="23" rx="5" fill={c.box} />
      <path d="M8 22 h32 v6 h-32z" fill={c.shade} opacity="0.5" />
      <rect x="21" y="22" width="6" height="23" fill={c.ribbon} />
      <g
        style={{
          transformBox: 'fill-box',
          transformOrigin: '15% 100%',
          transform: open ? 'translateY(-8px) rotate(-15deg)' : 'none',
          transition: 'transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.5)',
        }}
      >
        <rect x="5" y="15" width="38" height="10" rx="4" fill={c.box} />
        <rect x="21" y="15" width="6" height="10" fill={c.ribbon} />
        <path d="M24 15 C18 4 8 7 12 13 C15 16 21 16 24 15 Z" fill={c.ribbon} />
        <path d="M24 15 C30 4 40 7 36 13 C33 16 27 16 24 15 Z" fill={c.ribbon} />
        <circle cx="24" cy="14.5" r="3" fill={c.ribbon} stroke={c.shade} strokeOpacity="0.35" />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------ Componentes sueltos */

export function Tree({ className, style }: ArtProps) {
  return (
    <Svg viewBox="0 0 48 64" className={className} style={style}>
      <TreeArt />
    </Svg>
  );
}

export function Star({ className, style }: ArtProps) {
  return (
    <Svg viewBox="0 0 48 48" className={className} style={style}>
      <StarArt />
    </Svg>
  );
}

export function Cloud({ className, style }: ArtProps) {
  return (
    <Svg viewBox="0 0 96 44" className={className} style={style}>
      <path d="M22 40 a16 16 0 0 1 2 -31 a22 22 0 0 1 40 -1 a17 17 0 0 1 12 32 z" fill="#fff" opacity="0.92" />
    </Svg>
  );
}

/** Luna llena con cráteres suaves. */
export function Moon({ className, style }: ArtProps) {
  return (
    <Svg viewBox="0 0 48 48" className={className} style={style}>
      <circle cx="24" cy="24" r="22" fill="#fdf3cf" />
      <circle cx="16" cy="18" r="4.5" fill="#f2dfa0" />
      <circle cx="31" cy="30" r="6" fill="#f2dfa0" />
      <circle cx="30" cy="13" r="2.5" fill="#f2dfa0" />
    </Svg>
  );
}

/** Caja de regalo. Con `open`, la tapa salta y aparece un destello ("abrir el regalo"). */
export function GiftBox({ tone = 'berry', open = false, className, style }: ArtProps & { tone?: GiftTone; open?: boolean }) {
  return (
    <Svg viewBox="0 0 48 48" className={className} style={style}>
      <GiftArt tone={tone} open={open} />
    </Svg>
  );
}

/* ------------------------------------------------------------ Nieve */

const FLAKES = [
  { left: '6%', size: 6, duration: 8, delay: 0, sway: 14 },
  { left: '17%', size: 4, duration: 10, delay: -3, sway: -10 },
  { left: '29%', size: 7, duration: 9, delay: -6, sway: 18 },
  { left: '41%', size: 4, duration: 11, delay: -1.5, sway: -14 },
  { left: '52%', size: 5, duration: 8.5, delay: -4.5, sway: 10 },
  { left: '63%', size: 4, duration: 10.5, delay: -7, sway: -18 },
  { left: '74%', size: 7, duration: 9.5, delay: -2.5, sway: 12 },
  { left: '85%', size: 4, duration: 11.5, delay: -5.5, sway: -8 },
  { left: '94%', size: 5, duration: 8, delay: -8, sway: 16 },
];

/**
 * Nieve que cae suavemente. Va dentro de un contenedor `relative overflow-hidden`.
 * Solo anima `transform`, usa 9 elementos y se oculta con prefers-reduced-motion.
 */
export function Snowfall({ fall = 320 }: { fall?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="snowflake"
          style={
            {
              left: f.left,
              width: f.size,
              height: f.size,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
              '--sway': `${f.sway}px`,
              '--fall': `${fall}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Escena */

/** Lunares de una colina (como las colinas de un mundo de plataformas). */
function HillDots({ points, fill }: { points: [number, number][]; fill: string }) {
  return (
    <g fill={fill}>
      {points.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" />
      ))}
    </g>
  );
}

/**
 * Paisaje nevado de noche: colinas redondas con lunares, pinos, muñeco de nieve y un regalo.
 * Se ancla al borde inferior de un banner `relative overflow-hidden`.
 */
export function WinterScene({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" className={`pointer-events-none absolute inset-x-0 bottom-0 w-full ${className}`} aria-hidden focusable="false">
      {/* colinas del fondo */}
      <ellipse cx="90" cy="130" rx="130" ry="92" fill="#223a63" />
      <HillDots fill="#2c4a7c" points={[[40, 78], [78, 60], [120, 70], [150, 92], [64, 100], [104, 96]]} />
      <ellipse cx="320" cy="140" rx="150" ry="96" fill="#2c4a7c" />
      <HillDots fill="#3f6bb3" points={[[262, 80], [300, 62], [344, 66], [380, 84], [290, 98], [336, 96]]} />
      {/* nieve del frente */}
      <path d="M0 98 C60 84 120 88 190 98 C260 108 330 90 400 96 V120 H0 Z" fill="#fff" />
      <path d="M0 108 C80 100 150 112 220 110 C290 108 350 104 400 108 V120 H0 Z" fill="#e1e6f0" />
      {/* personajes */}
      <g transform="translate(40 40) scale(0.95)">
        <TreeArt />
      </g>
      <g transform="translate(82 62) scale(0.6)">
        <TreeArt />
      </g>
      <g transform="translate(254 62) scale(0.7)">
        <GiftArt tone="berry" open={false} />
      </g>
      <g transform="translate(290 42) scale(0.9)">
        <SnowmanArt />
      </g>
      <g transform="translate(334 58) scale(0.62)">
        <TreeArt />
      </g>
    </svg>
  );
}
