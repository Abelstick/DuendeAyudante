import { useState } from 'react';
import { formatMoney } from '@/shared/lib/money';
import { Notice } from '@/shared/ui/Card';
import { Modal } from '@/shared/ui/Modal';
import { chipClasses } from '@/shared/ui/Tabs';
import { AGE_GROUPS, giftIdeasFor, type AgeGroup, type GiftIdea } from '../domain/GiftIdeas';

interface Props {
  budget: number | null;
  currency: string;
  onPick: (idea: GiftIdea) => void;
  onClose: () => void;
}

/** "¿No sabes qué pedir?": ideas según la edad y lo que alcanza con el presupuesto del intercambio. */
export function GiftIdeasModal({ budget, currency, onPick, onClose }: Props) {
  const [age, setAge] = useState<AgeGroup>('adult');
  const canFilter = currency === 'PEN' && budget != null && budget > 0;
  const [withinBudget, setWithinBudget] = useState(canFilter);
  const ideas = giftIdeasFor(age, withinBudget ? budget : null, currency);
  const money = (n: number) => formatMoney(n, currency).replace(/\.00$/, '');

  return (
    <Modal open title="Ideas de regalo" onClose={onClose} size="wide">
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-base font-bold text-ink-900">¿Para qué edad?</legend>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map((g) => (
              <button key={g.value} type="button" aria-pressed={age === g.value} onClick={() => setAge(g.value)} className={chipClasses(age === g.value)}>
                <span aria-hidden>{g.emoji}</span> {g.label}
              </button>
            ))}
          </div>
        </fieldset>

        {canFilter && (
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-mist-300 bg-white px-3">
            <input type="checkbox" className="size-5 accent-brand" checked={withinBudget} onChange={(e) => setWithinBudget(e.target.checked)} />
            <span className="text-base font-semibold">Solo lo que se puede comprar con {money(budget)} (el monto del intercambio)</span>
          </label>
        )}

        {ideas.length === 0 ? (
          <Notice>No hay ideas para esa edad con ese monto. Quita el filtro del monto para ver más.</Notice>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {ideas.map((idea) => (
              <li key={idea.title}>
                <button
                  type="button"
                  onClick={() => onPick(idea)}
                  className="tap-card flex h-full min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-mist-300 bg-white p-3 text-left hover:border-brand"
                >
                  <span className="text-3xl" aria-hidden>
                    {idea.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-bold text-ink-900">{idea.title}</span>
                    <span className="block text-sm text-ink-700">
                      {currency === 'PEN' ? `Aprox. ${money(idea.min)} – ${money(idea.max)} · ` : ''}
                      {idea.detail}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-ink-500">Toca una idea y la usamos para llenar tu regalo. Después puedes cambiar lo que quieras.</p>
      </div>
    </Modal>
  );
}
