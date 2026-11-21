import { Minus, Plus, Shuffle, Users } from 'lucide-react';
import { useState } from 'react';
import { type Family } from '@/modules/families/domain/Family';
import { FAMILY_COLORS } from '@/modules/families/presentation/familyTheme';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { playSound } from '@/shared/lib/sound';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card, CardTitle } from '@/shared/ui/Card';
import { pickRandomPeople } from '../domain/Game';
import { secureRandom } from './random';

interface Props {
  participants: Participant[];
  families: Family[];
}

/**
 * Sorteo de participantes: elige al azar quién juega o cumple un reto.
 * Es solo para el momento (no se guarda nada); cualquiera puede usarlo.
 */
export function ParticipantDraw({ participants, families }: Props) {
  const [count, setCount] = useState(1);
  const [chosen, setChosen] = useState<Participant[]>([]);
  const [round, setRound] = useState(0);

  if (participants.length < 2) return null;

  const max = Math.min(10, participants.length);
  const amount = Math.min(count, max);
  const stepClass = 'flex size-12 items-center justify-center rounded-full border-2 border-mist-300 bg-surface text-brand-ink hover:border-brand disabled:opacity-40';

  const draw = () => {
    setChosen(pickRandomPeople(participants, amount, secureRandom));
    setRound((r) => r + 1);
    playSound('reveal');
  };

  return (
    <Card data-tour="juegos-sorteo" className="space-y-4">
      <CardTitle icon={<Users className="size-6" />} tone="gold">
        ¿A quién le toca?
      </CardTitle>
      <p className="text-base text-ink-700">Sortea al azar quién participa en un juego o reto.</p>

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-mist-100 p-3">
        <span id="draw-count-label" className="text-base font-bold">
          ¿Cuántas personas?
        </span>
        <div className="flex items-center gap-3" role="group" aria-labelledby="draw-count-label">
          <button type="button" className={stepClass} onClick={() => setCount(Math.max(1, amount - 1))} disabled={amount <= 1} aria-label="Una persona menos">
            <Minus className="size-6" aria-hidden />
          </button>
          <span className="w-8 text-center text-2xl font-black tabular-nums" aria-live="polite">
            {amount}
          </span>
          <button type="button" className={stepClass} onClick={() => setCount(Math.min(max, amount + 1))} disabled={amount >= max} aria-label="Una persona más">
            <Plus className="size-6" aria-hidden />
          </button>
        </div>
      </div>

      <Button variant="gold" size="lg" onClick={draw} icon={<Shuffle className="size-6" aria-hidden />}>
        {chosen.length > 0 ? 'Sortear de nuevo' : 'Sortear'}
      </Button>

      {chosen.length > 0 && (
        <div aria-live="polite">
          <p className="mb-2 text-base font-extrabold">🎉 {chosen.length === 1 ? '¡Le toca a…!' : '¡Les toca a…!'}</p>
          <ul key={round} className="stagger space-y-2">
            {chosen.map((p) => {
              const family = families.find((f) => f.id === p.familyId);
              const color = family ? FAMILY_COLORS[family.color] : undefined;
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl border-2 border-gold-400 bg-gold-50 p-3">
                  <Avatar name={p.fullName} colors={color && { bg: color.soft, fg: color.text }} />
                  <span className="min-w-0">
                    <span className="block text-lg font-extrabold leading-tight">{displayName(p)}</span>
                    {family && <span className="block text-sm text-ink-700">Familia {family.name}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
