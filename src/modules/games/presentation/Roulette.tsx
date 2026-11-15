import { CheckCircle2, Dices, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Participant } from '@/modules/members/domain/Participant';
import { Button } from '@/shared/ui/Button';
import { CATEGORY_LABELS, type Game, pickRandomGame } from '../domain/Game';
import { GameDetails } from './GameCard';

function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 2 ** 32;
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

interface Props {
  games: Game[];
  participants: Participant[];
  canMarkPlayed: boolean;
  onMarkPlayed: (game: Game) => void;
}

/** "¡Sorpréndenos con un juego!": ruleta que se detiene en un juego al azar. */
export function Roulette({ games, participants, canMarkPlayed, onMarkPlayed }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [display, setDisplay] = useState<Game | null>(null);
  const [result, setResult] = useState<Game | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  // Si el juego elegido deja de estar disponible (lo marcaron como jugado), se limpia
  useEffect(() => {
    if (result && !games.some((g) => g.id === result.id)) {
      setResult(null);
      setDisplay(null);
    }
  }, [games, result]);

  const spin = () => {
    const final = pickRandomGame(games, secureRandom);
    if (!final) return;
    setResult(null);
    if (prefersReducedMotion() || games.length === 1) {
      setDisplay(final);
      setResult(final);
      return;
    }
    setSpinning(true);
    // Va cada vez más lento, como una ruleta
    let elapsed = 0;
    let delay = 70;
    timers.current = [];
    while (elapsed < 2200) {
      elapsed += delay;
      delay *= 1.12;
      timers.current.push(window.setTimeout(() => setDisplay(pickRandomGame(games, secureRandom)), elapsed));
    }
    timers.current.push(
      window.setTimeout(() => {
        setDisplay(final);
        setResult(final);
        setSpinning(false);
      }, elapsed + 150),
    );
  };

  if (games.length === 0) return null;

  return (
    <section aria-labelledby="roulette-title" className="snow-bg space-y-4 rounded-3xl bg-brand p-5 text-white shadow-md">
      <h2 id="roulette-title" className="sr-only">
        Juego sorpresa
      </h2>
      {!display ? (
        <button
          type="button"
          onClick={spin}
          className="flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 text-xl font-extrabold text-brand shadow-lg hover:bg-brand-soft"
        >
          <Dices className="size-8" aria-hidden />
          ¡SORPRÉNDENOS CON UN JUEGO!
        </button>
      ) : (
        <div className="space-y-4">
          <div
            className={`rounded-2xl bg-white p-5 text-center text-ink-900 ${spinning ? '' : 'animate-pop-in'}`}
            aria-live={spinning ? 'off' : 'polite'}
          >
            <p className="text-sm font-semibold text-ink-700">{spinning ? 'Eligiendo…' : '¡Les toca jugar!'}</p>
            <p className={`text-2xl font-extrabold ${spinning ? 'text-ink-500' : 'text-brand'}`}>
              {!spinning && <span aria-hidden>🎉 </span>}
              {display.name}
            </p>
            {!spinning && (
              <p className="text-sm text-ink-700">
                <span aria-hidden>{CATEGORY_LABELS[display.category].emoji}</span> {CATEGORY_LABELS[display.category].label}
              </p>
            )}
          </div>

          {result && !spinning && (
            <div className="animate-pop-in space-y-3 rounded-2xl bg-white p-4 text-ink-900">
              {result.description && <p className="whitespace-pre-line text-base">{result.description}</p>}
              <GameDetails game={result} participants={participants} />
            </div>
          )}

          {!spinning && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={spin} icon={<RefreshCw className="size-5" aria-hidden />} className="!border-white">
                Otro juego
              </Button>
              {canMarkPlayed && result && (
                <Button variant="secondary" onClick={() => onMarkPlayed(result)} icon={<CheckCircle2 className="size-5" aria-hidden />} className="!border-white">
                  Ya lo jugamos
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
