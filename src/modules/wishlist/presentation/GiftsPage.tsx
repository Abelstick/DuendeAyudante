import { ChevronRight, Gift, Users, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants } from '@/modules/events/domain/Event';
import { FAMILY_COLORS, type Family } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { formatMoney } from '@/shared/lib/money';
import { Avatar } from '@/shared/ui/Avatar';
import { Spinner } from '@/shared/ui/Button';
import { Notice, PageTitle, Pill } from '@/shared/ui/Card';
import { chipClasses, SegmentedTabs } from '@/shared/ui/Tabs';
import { errorMessage } from '@/shared/ui/errorMessages';
import { TextField } from '@/shared/ui/TextField';
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
      <PageTitle tone="berry" icon={<Gift className="size-8" aria-hidden />} title="Regalos" subtitle="Tu lista de deseos y la de tu familia" />

      <SegmentedTabs
        label="Qué regalos ver"
        value={view}
        onChange={setView}
        options={[
          { value: 'mine', label: 'Mis regalos', icon: <Gift className="size-5" aria-hidden /> },
          { value: 'all', label: 'Regalos de todos', icon: <Users className="size-5" aria-hidden /> },
        ]}
      />

      {budget != null && (
        <p className="flex items-center gap-3 rounded-2xl border border-gold-300 bg-gold-50 px-4 py-3 text-base">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-400 text-night-900" aria-hidden>
            <Wallet className="size-5" />
          </span>
          <span>
            Presupuesto del intercambio: <strong className="text-lg">{formatMoney(budget, event.currency)}</strong>
          </span>
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
          <legend className="mb-2 text-lg font-extrabold">¿De quién son estos regalos?</legend>
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === selected.id}
                onClick={() => setSelectedId(p.id)}
                className={chipClasses(p.id === selected.id)}
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
  const [search, setSearch] = useState('');

  if (participants.isLoading || families.isLoading) return <Spinner label="Cargando…" />;
  if (participants.error) return <Notice tone="error">{errorMessage(participants.error)}</Notice>;

  const familyList = families.data ?? [];
  // Búsqueda sin importar tildes ni mayúsculas: "jose" encuentra a "JOSÉ"
  const plain = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const query = plain(search.trim());
  const people = (participants.data ?? []).filter((p) => !query || plain(displayName(p)).includes(query));
  const groups: { key: string; family?: Family; people: Participant[] }[] = [
    ...familyList.map((f) => ({ key: f.id, family: f, people: people.filter((p) => p.familyId === f.id) })),
    { key: 'none', people: people.filter((p) => !p.familyId || !familyList.some((f) => f.id === p.familyId)) },
  ].filter((g) => g.people.length > 0);

  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-base text-ink-700">
        <Users className="size-5 shrink-0" aria-hidden /> Toca a una persona para ver qué le gustaría recibir.
      </p>
      {(participants.data?.length ?? 0) > 6 && (
        <TextField label="Buscar a una persona" type="search" placeholder="Escribe un nombre" value={search} onChange={(e) => setSearch(e.target.value)} />
      )}
      {groups.length === 0 && <Notice>No encontramos a nadie con ese nombre.</Notice>}
      {groups.map((g) => (
        <section key={g.key} className="space-y-2">
          <h2 className="text-lg font-bold">{g.family ? <FamilyBadge family={g.family} /> : 'Sin familia'}</h2>
          <ul className="stagger space-y-2">
            {g.people.map((p) => {
              const count = byPerson.get(p.id)?.length ?? 0;
              return (
                <li key={p.id}>
                  <Link
                    to={`/e/${event.id}/regalos/persona/${p.id}`}
                    className="tap-card flex min-h-16 items-center gap-3 rounded-2xl border border-mist-200 bg-white px-4 py-3 shadow-card hover:border-brand"
                  >
                    <Avatar name={p.fullName} colors={g.family && { bg: FAMILY_COLORS[g.family.color].soft, fg: FAMILY_COLORS[g.family.color].text }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-bold leading-tight">{displayName(p)}</span>
                      <span className="block text-sm text-ink-700">{count === 0 ? 'Todavía no agregó regalos' : 'Toca para ver su lista'}</span>
                    </span>
                    {count > 0 && (
                      <Pill tone="berry">
                        🎁 {count}
                        <span className="sr-only">{count === 1 ? ' regalo' : ' regalos'}</span>
                      </Pill>
                    )}
                    <ChevronRight className="size-6 shrink-0 text-brand" aria-hidden />
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
