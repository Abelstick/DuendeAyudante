import { CheckCircle2, Dices, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Participant } from '@/modules/members/domain/Participant';
import { Button } from '@/shared/ui/Button';
import { CATEGORY_LABELS, type Game, pickRandomGame } from '../domain/Game';
import { GameDetails } from './GameCard';
import { secureRandom } from './random';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const SPIN_MS = 2600;
const MAX_SLICES = 12;
const SLICE_COLORS = ['#de4343', '#f2b824', '#1f8a55', '#2f8ee0', '#ffffff', '#f7d066'];

/** Fondo de la ruleta: un gajo de color por juego (hasta 12, para que se distingan). */
function wheelBackground(slices: number): string {
  const step = 360 / slices;
  // Con un número impar de gajos, el último no repite el color del primero
  const stops = Array.from({ length: slices }, (_, i) => {
    const color = i === slices - 1 && slices > 1 && i % SLICE_COLORS.length === 0 ? SLICE_COLORS[2] : SLICE_COLORS[i % SLICE_COLORS.length];
    return `${color} ${i * step}deg ${(i + 1) * step}deg`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

interface Props {
  games: Game[];
  participants: Participant[];
  canMarkPlayed: boolean;
  onMarkPlayed: (game: Game) => void;
}

/** Ruleta de juegos: gira y se detiene en un juego al azar de la lista. */
export function Roulette({ games, participants, canMarkPlayed, onMarkPlayed }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [display, setDisplay] = useState<Game | null>(null);
  const [result, setResult] = useState<Game | null>(null);
  const [rotation, setRotation] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  // Si el juego elegido deja de estar disponible (lo marcaron como jugado), se limpia
  useEffect(() => {
    if (result && !games.some((g) => g.id === result.id)) {
      setResult(null);
      setDisplay(null);
    }
  }, [games, result]);

  const slices = Math.max(2, Math.min(games.length, MAX_SLICES));

  const spin = () => {
    if (spinning) return;
    const final = pickRandomGame(games, secureRandom);
    if (!final) return;
    setResult(null);

    // La ruleta se detiene con el gajo del juego elegido bajo la flecha
    const index = games.findIndex((g) => g.id === final.id) % slices;
    const sliceCenter = (index + 0.5) * (360 / slices);
    setRotation((prev) => prev - (prev % 360) + 360 * 5 + (360 - sliceCenter));

    if (prefersReducedMotion() || games.length === 1) {
      setDisplay(final);
      setResult(final);
      return;
    }
    setSpinning(true);
    // Los nombres pasan cada vez más lento, acompañando el giro
    let elapsed = 0;
    let delay = 70;
    timers.current = [];
    while (elapsed < SPIN_MS - 400) {
      elapsed += delay;
      delay *= 1.12;
      timers.current.push(window.setTimeout(() => setDisplay(pickRandomGame(games, secureRandom)), elapsed));
    }
    timers.current.push(
      window.setTimeout(() => {
        setDisplay(final);
        setResult(final);
        setSpinning(false);
      }, SPIN_MS),
    );
  };

  if (games.length === 0) return null;

  return (
    <section aria-labelledby="roulette-title" className="sky-bg snow-bg relative space-y-4 overflow-hidden rounded-2xl border-[3px] border-night-900 p-5 text-white shadow-lift">
      <div className="flex items-center gap-4">
        {/* Ruleta (decorativa: el resultado siempre aparece escrito) */}
        <div className="relative size-28 shrink-0" aria-hidden>
          <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1.5 border-x-[11px] border-t-[18px] border-x-transparent border-t-gold-400" />
          <div
            className="size-full rounded-full border-4 border-white shadow-[0_5px_0_0_#000]"
            style={{
              background: wheelBackground(slices),
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.8, 0.2, 1)` : 'none',
            }}
          />
          <span className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-2 border-night-900 bg-white text-night-900">
            <Dices className="size-6" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="roulette-title" className="text-2xl font-semibold leading-tight text-gold-300">
            Ruleta de juegos
          </h2>
          <p className="text-base text-white/90">
            {games.length === 1 ? 'Hay 1 juego en la lista.' : `Gira y deja que la suerte elija entre ${games.length} juegos.`}
          </p>
        </div>
      </div>

      {display && (
        <div className={`rounded-xl border-[3px] bg-white p-4 text-center text-ink-900 ${spinning ? 'border-white' : 'animate-pop-in border-gold-400'}`} aria-live={spinning ? 'off' : 'polite'}>
          <p className="text-sm font-bold uppercase tracking-wide text-ink-500">{spinning ? 'Eligiendo…' : '¡Les toca jugar!'}</p>
          <p className={`font-display text-2xl font-semibold leading-tight ${spinning ? 'text-ink-500' : 'text-night-900'}`}>
            {!spinning && <span aria-hidden>🎉 </span>}
            {display.name}
          </p>
          {!spinning && (
            <p className="text-sm font-semibold text-ink-700">
              <span aria-hidden>{CATEGORY_LABELS[display.category].emoji}</span> {CATEGORY_LABELS[display.category].label}
            </p>
          )}
        </div>
      )}

      {result && !spinning && (
        <div className="animate-pop-in space-y-3 rounded-xl bg-white p-4 text-ink-900">
          {result.description && <p className="whitespace-pre-line text-base">{result.description}</p>}
          <GameDetails game={result} participants={participants} />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="gold"
          style={{ ['--btn-edge' as string]: '#000' }}
          size={display ? 'md' : 'lg'}
          onClick={spin}
          disabled={spinning}
          icon={display ? <RefreshCw className="size-5" aria-hidden /> : <Dices className="size-6" aria-hidden />}
          className={display ? 'sm:flex-1' : ''}
        >
          {spinning ? 'Girando…' : display ? 'Girar otra vez' : '¡Girar la ruleta!'}
        </Button>
        {canMarkPlayed && result && !spinning && (
          <Button variant="secondary" style={{ ['--btn-edge' as string]: '#000' }} onClick={() => onMarkPlayed(result)} icon={<CheckCircle2 className="size-5" aria-hidden />} className="sm:flex-1">
            Ya lo jugamos
          </Button>
        )}
      </div>
    </section>
  );
}
