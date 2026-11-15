import type { CSSProperties } from 'react';

/**
 * Pixel art propio de la app (árbol, regalo, estrella, muñeco de nieve, nube).
 * Cada sprite es una cuadrícula de letras: cada letra es un color y "." es transparente.
 * Son decorativos: llevan aria-hidden y nunca reemplazan un texto.
 */

const INK = '#0f1e38';

type Palette = Record<string, string>;

interface SpriteProps {
  rows: string[];
  palette: Palette;
  className?: string;
  style?: CSSProperties;
}

function Sprite({ rows, palette, className = '', style }: SpriteProps) {
  const width = Math.max(...rows.map((r) => r.length));
  return (
    <svg viewBox={`0 0 ${width} ${rows.length}`} className={`pixelated ${className}`} style={style} aria-hidden focusable="false">
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => (palette[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={palette[ch]} /> : null)),
      )}
    </svg>
  );
}

const TREE = [
  '.....y.....',
  '....yyy....',
  '.....y.....',
  '....kgk....',
  '...kgggk...',
  '..kgwggdk..',
  '...kgggk...',
  '..kggrgdk..',
  '.kggggggdk.',
  '..kgyggdk..',
  '.kggggggdk.',
  'kgrggggbgdk',
  'kkkkkkkkkkk',
  '....ktk....',
  '....ktk....',
];

export function PixelTree({ className = '' }: { className?: string }) {
  return <Sprite rows={TREE} className={className} palette={{ k: INK, g: '#1f8a55', d: '#125538', y: '#f2b824', r: '#de4343', b: '#8ed4fb', w: '#ffffff', t: '#8a5a2b' }} />;
}

const STAR = ['....k....', '...kyk...', '...kyk...', 'kkkkyykkk', 'kyyyyyyyk', '.kyyoyyk.', '..kyyyk..', '.kyykyyk.', '.kyk.kyk.', '.kk...kk.'];

export function PixelStar({ className = '' }: { className?: string }) {
  return <Sprite rows={STAR} className={className} palette={{ k: INK, y: '#f7d066', o: '#f2b824' }} />;
}

const CLOUD = ['....wwww......', '..wwwwwwww.ww.', '.wwwwwwwwwwwww', 'wwwwwwwwwwwwww', 'sswwwwwwwwwwss', '.ssssssssssss.'];

export function PixelCloud({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <Sprite rows={CLOUD} className={className} style={style} palette={{ w: '#ffffff', s: '#dff3ff' }} />;
}

const SNOWMAN = [
  '...kkkk...',
  '...krrk...',
  '..kkkkkk..',
  '..kwwwwk..',
  '.kwkwwkwk.',
  '.kwwwooook',
  '..kwwwwk..',
  '.krrrrrrk.',
  'kwwwwwwrk.',
  'kwwwkwwwwk',
  'kwwwwwwwsk',
  'kwwwkwwssk',
  '.kwwwwssk.',
  '..kkkkkk..',
];

export function PixelSnowman({ className = '' }: { className?: string }) {
  return <Sprite rows={SNOWMAN} className={className} palette={{ k: INK, w: '#ffffff', s: '#dbe4f3', r: '#de4343', o: '#f2913a' }} />;
}

const CANE = ['..kkkk..', '.krwwrk.', 'kwrkkrwk', 'krk..krk', 'kk...kwk', '.....krk', '.....kwk', '.....krk', '.....kwk', '.....krk', '.....kkk'];

export function PixelCane({ className = '' }: { className?: string }) {
  return <Sprite rows={CANE} className={className} palette={{ k: INK, r: '#de4343', w: '#ffffff' }} />;
}

/* ---------------------------------------------------------------- Regalo */

export type GiftTone = 'berry' | 'pine' | 'night' | 'gold';

const giftPalette: Record<GiftTone, Palette> = {
  berry: { k: INK, b: '#de4343', d: '#a31f1f', y: '#f7d066' },
  pine: { k: INK, b: '#1f8a55', d: '#125538', y: '#f7d066' },
  night: { k: INK, b: '#3f6bb3', d: '#223a63', y: '#f7d066' },
  gold: { k: INK, b: '#f2b824', d: '#b98512', y: '#de4343' },
};

const GIFT_LID = ['..kk....kk..', '.kyyk..kyyk.', '.kyyykkyyyk.', '..kyyyyyyk..', 'kkkkkyykkkkk', 'kbbbbyybbbbk', 'kddddyyddddk', 'kkkkkkkkkkkk'];
const GIFT_BODY = ['.kbbbyybbbk.', '.kbbbyybbbk.', '.kbbbyybbbk.', '.kbbbyybbdk.', '.kbddyydddk.', '.kkkkkkkkkk.'];
const GIFT_SPARK = ['..y..', '.yyy.', 'yyyyy', '.yyy.', '..y..'];

/** Caja de regalo en pixel art. Con `open`, la tapa salta y aparece un destello ("abrir el regalo"). */
export function GiftBox({ tone = 'berry', open = false, className = '' }: { tone?: GiftTone; open?: boolean; className?: string }) {
  const palette = giftPalette[tone];
  return (
    <span className={`relative inline-block ${className}`} aria-hidden>
      <span className="absolute inset-0 flex flex-col">
        <Sprite
          rows={GIFT_LID}
          palette={palette}
          className="block w-full"
          style={{
            aspectRatio: '12 / 8',
            transformOrigin: '15% 100%',
            transform: open ? 'translateY(-22%) rotate(-16deg)' : 'none',
            transition: 'transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.5)',
          }}
        />
        <Sprite rows={GIFT_BODY} palette={palette} className="block w-full" style={{ aspectRatio: '12 / 6' }} />
      </span>
      {open && <Sprite rows={GIFT_SPARK} palette={{ y: '#f2b824' }} className="absolute -top-[18%] left-[38%] w-[30%] animate-twinkle" />}
      {/* reserva la proporción 12 × 14 */}
      <svg viewBox="0 0 12 14" className="invisible block w-full" />
    </span>
  );
}

/* ---------------------------------------------------------------- Nieve */

const FLAKES = [
  { left: '6%', size: 5, duration: 7, delay: 0, sway: 14 },
  { left: '17%', size: 4, duration: 9, delay: -3, sway: -10 },
  { left: '29%', size: 6, duration: 8, delay: -6, sway: 18 },
  { left: '41%', size: 4, duration: 10, delay: -1.5, sway: -14 },
  { left: '52%', size: 5, duration: 7.5, delay: -4.5, sway: 10 },
  { left: '63%', size: 4, duration: 9.5, delay: -7, sway: -18 },
  { left: '74%', size: 6, duration: 8.5, delay: -2.5, sway: 12 },
  { left: '85%', size: 4, duration: 10.5, delay: -5.5, sway: -8 },
  { left: '94%', size: 5, duration: 7, delay: -8, sway: 16 },
];

/**
 * Nieve que cae (copos cuadrados). Va dentro de un contenedor `relative overflow-hidden`.
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

/**
 * "Nivel nevado": suelo de bloques con nieve, árboles, muñeco de nieve y un regalo.
 * Se ancla al borde inferior de un banner `relative overflow-hidden`.
 */
export function LevelScene() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0" aria-hidden>
      <div className="relative mx-auto flex h-14 max-w-2xl items-end justify-between px-4">
        <PixelTree className="h-14 w-auto" />
        <PixelTree className="-ml-2 h-9 w-auto" />
        <span className="flex-1" />
        <GiftBox tone="berry" className="mb-0.5 w-7" />
        <PixelSnowman className="ml-3 h-12 w-auto" />
        <PixelCane className="ml-3 h-9 w-auto" />
      </div>
      <div className="snow-top ground-blocks h-8 border-t-[3px] border-night-900" />
    </div>
  );
}
