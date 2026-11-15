import { ChevronRight, Gift, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants } from '@/modules/events/domain/Event';
import type { Family } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { formatMoney } from '@/shared/lib/money';
import { Spinner } from '@/shared/ui/Button';
import { Notice, PageTitle } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { toTitleCase } from '@/shared/validation/names';
import { WishlistService } from '../application/WishlistService';
import type { WishlistItem } from '../domain/WishlistItem';
import { EditableWishlist } from './EditableWishlist';
import { useEventWishlist } from './hooks';

export function GiftsPage() {
  const { event } = useEventScope();
  const [params, setParams] = useSearchParams();
  const view = params.get('vista') === 'todos' ? 'all' : 'mine';
  const wishlist = useEventWishlist(event.id);
  const budget = event.giftExchange?.budgetMax ?? null;

  const setView = (v: 'mine' | 'all') => setParams(v === 'all' ? { vista: 'todos' } : {}, { replace: true });

  return (
    <div className="space-y-5">
      <PageTitle icon={<Gift className="size-8 text-berry-600" aria-hidden />} title="Regalos" />

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-cream-200 p-1.5" role="tablist" aria-label="Qué regalos ver">
        {(
          [
            ['mine', 'Mis regalos'],
            ['all', 'Regalos de todos'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className={`min-h-13 rounded-xl text-base font-bold ${view === value ? 'bg-white text-pine-900 shadow' : 'text-ink-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {budget != null && (
        <p className="rounded-2xl bg-gold-100 px-4 py-3 text-base">
          💰 Presupuesto del intercambio: <strong>{formatMoney(budget, event.currency)}</strong>
        </p>
      )}

      {wishlist.isLoading && <Spinner label="Cargando regalos…" />}
      {wishlist.error && <Notice tone="error">{errorMessage(wishlist.error)}</Notice>}

      {wishlist.data &&
        (view === 'mine' ? (
          <MyGifts items={wishlist.data} startAdding={params.get('agregar') === '1'} />
        ) : (
          <EveryonesGifts items={wishlist.data} />
        ))}
    </div>
  );
}

function MyGifts({ items, startAdding }: { items: WishlistItem[]; startAdding: boolean }) {
  const { event, context } = useEventScope();
  const people = actingParticipants(context);
  const [selectedId, setSelectedId] = useState(people[0]?.id ?? '');
  const selected = people.find((p) => p.id === selectedId) ?? people[0];

  if (!selected) {
    return <Notice>Todavía no tienes un perfil en esta celebración. Pide al organizador que te agregue.</Notice>;
  }

  const isMe = selected.id === context.me?.id;

  return (
    <div className="space-y-4">
      {people.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-lg font-semibold">¿De quién son estos regalos?</legend>
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === selected.id}
                onClick={() => setSelectedId(p.id)}
                className={`min-h-12 rounded-full border-2 px-5 text-base font-semibold ${
                  p.id === selected.id ? 'border-pine-700 bg-pine-700 text-white' : 'border-cream-200 bg-white'
                }`}
              >
                {p.id === context.me?.id ? 'Yo' : toTitleCase(p.firstName)}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <EditableWishlist
        key={selected.id}
        eventId={event.id}
        participantId={selected.id}
        items={items.filter((w) => w.participantId === selected.id)}
        budget={event.giftExchange?.budgetMax ?? null}
        currency={event.currency}
        forName={isMe ? undefined : toTitleCase(selected.firstName)}
        startAdding={startAdding && isMe}
      />
    </div>
  );
}

function EveryonesGifts({ items }: { items: WishlistItem[] }) {
  const { event } = useEventScope();
  const participants = useParticipants(event.id);
  const families = useFamilies(event.id);
  const byPerson = useMemo(() => WishlistService.groupByParticipant(items), [items]);

  if (participants.isLoading || families.isLoading) return <Spinner label="Cargando…" />;
  if (participants.error) return <Notice tone="error">{errorMessage(participants.error)}</Notice>;

  const familyList = families.data ?? [];
  const people = participants.data ?? [];
  const groups: { key: string; family?: Family; people: Participant[] }[] = [
    ...familyList.map((f) => ({ key: f.id, family: f, people: people.filter((p) => p.familyId === f.id) })),
    { key: 'none', people: people.filter((p) => !p.familyId || !familyList.some((f) => f.id === p.familyId)) },
  ].filter((g) => g.people.length > 0);

  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-base text-ink-700">
        <Users className="size-5 shrink-0" aria-hidden /> Toca a una persona para ver qué le gustaría recibir.
      </p>
      {groups.map((g) => (
        <section key={g.key} className="space-y-2">
          <h2 className="text-lg font-bold">{g.family ? <FamilyBadge family={g.family} /> : 'Sin familia'}</h2>
          <ul className="space-y-2">
            {g.people.map((p) => {
              const count = byPerson.get(p.id)?.length ?? 0;
              return (
                <li key={p.id}>
                  <Link
                    to={`/e/${event.id}/regalos/persona/${p.id}`}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-cream-200 bg-white px-4 py-3 hover:border-pine-600"
                  >
                    <span>
                      <span className="block text-lg font-semibold">{displayName(p)}</span>
                      <span className="block text-sm text-ink-700">
                        {count === 0 ? 'Todavía no agregó regalos' : `${count} ${count === 1 ? 'regalo' : 'regalos'}`}
                      </span>
                    </span>
                    <ChevronRight className="size-6 shrink-0 text-pine-700" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
