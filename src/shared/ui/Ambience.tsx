import type { CSSProperties } from 'react';

/**
 * Ambiente navideño de toda la app: nieve que cae por la pantalla y luces de colores.
 * Todo es decorativo (aria-hidden), no recibe toques y se apaga con "reducir movimiento".
 */

const FLAKES = [
  { left: 4, size: 7, duration: 14, delay: 0, sway: 30 },
  { left: 11, size: 4, duration: 19, delay: -6, sway: -24 },
  { left: 19, size: 9, duration: 16, delay: -11, sway: 40 },
  { left: 27, size: 5, duration: 21, delay: -3, sway: -30 },
  { left: 35, size: 6, duration: 15, delay: -9, sway: 22 },
  { left: 43, size: 4, duration: 22, delay: -14, sway: -36 },
  { left: 51, size: 8, duration: 17, delay: -5, sway: 28 },
  { left: 59, size: 5, duration: 20, delay: -12, sway: -20 },
  { left: 67, size: 7, duration: 15, delay: -2, sway: 34 },
  { left: 75, size: 4, duration: 23, delay: -16, sway: -28 },
  { left: 83, size: 9, duration: 18, delay: -8, sway: 24 },
  { left: 90, size: 5, duration: 20, delay: -13, sway: -34 },
  { left: 96, size: 6, duration: 16, delay: -4, sway: 20 },
];

/** Nieve cayendo por toda la pantalla, detrás del contenido. */
export function SnowBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="snowflake"
          style={
            {
              left: `${f.left}%`,
              width: f.size,
              height: f.size,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
              '--sway': `${f.sway}px`,
              '--fall': '110vh',
            } as CSSProperties
          }
        />
      ))}
      {/* Nieve acumulada al pie de la pantalla (en computadora; en el celular ahí va el menú) */}
      <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 hidden h-28 w-full md:block" focusable="false">
        <path d="M0 70 C150 20 300 30 450 60 C600 90 750 30 900 44 C1020 56 1110 80 1200 60 V120 H0 Z" fill="var(--color-snow)" opacity="0.7" />
        <path d="M0 96 C200 60 380 100 600 90 C820 80 1000 60 1200 92 V120 H0 Z" fill="var(--color-snow)" />
      </svg>
    </div>
  );
}

const BULBS = ['#de4343', '#f2b824', '#1f8a55', '#2f8ee0', '#f2913a'];

/**
 * Guirnalda de luces: un cable ondulado con foquitos que se prenden y apagan por turnos.
 * `count` foquitos repartidos a lo ancho del contenedor.
 */
export function Garland({ count = 9, className = '' }: { count?: number; className?: string }) {
  const swags = count;
  // Cada foquito cuelga del punto más bajo de su onda
  const d = Array.from({ length: swags }, (_, i) => {
    const x0 = (i / swags) * 100;
    const x1 = ((i + 1) / swags) * 100;
    return `M${x0} 2 Q${(x0 + x1) / 2} 16 ${x1} 2`;
  }).join(' ');

  return (
    <div className={`pointer-events-none relative h-7 ${className}`} aria-hidden>
      <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="absolute inset-0 size-full" focusable="false">
        <path d={d} fill="none" stroke="var(--color-line)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: count }, (_, i) => {
        const color = BULBS[i % BULBS.length]!;
        return (
          <span
            key={i}
            className="garland-bulb"
            style={{ left: `${((i + 0.5) / count) * 100}%`, backgroundColor: color, color, animationDelay: `${(i % 3) * 0.6}s` }}
          />
        );
      })}
    </div>
  );
}
