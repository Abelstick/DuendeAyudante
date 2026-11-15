import { useMemo, type CSSProperties } from 'react';

const COLORS = ['#de4343', '#1f8a55', '#f2b824', '#2f8ee0', '#ffffff', '#f7d066'];
const PIECES = 28;

/**
 * Ráfaga breve de confeti para momentos especiales. Es solo decoración:
 * no bloquea toques, dura 1,5 s y se oculta con prefers-reduced-motion.
 */
export function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => {
        const angle = (i / PIECES) * Math.PI * 2 + Math.random() * 0.4;
        const distance = 90 + Math.random() * 150;
        return {
          color: COLORS[i % COLORS.length],
          style: {
            '--dx': `${Math.round(Math.cos(angle) * distance)}px`,
            '--dy': `${Math.round(Math.sin(angle) * distance + 90)}px`,
            '--rot': `${Math.round(Math.random() * 720 - 360)}deg`,
            '--delay': `${Math.round(Math.random() * 120)}ms`,
          } as CSSProperties,
        };
      }),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 top-1/3 z-[60] h-0" aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={{ ...p.style, backgroundColor: p.color }} />
      ))}
    </div>
  );
}
