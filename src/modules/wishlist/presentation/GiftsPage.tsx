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
import { applySort, DEFAULT_LIST_PREFS, matchesSearch, toggleSort, type ListPrefs, type SortValue } from '@/shared/lib/listing';
import { formatMoney } from '@/shared/lib/money';
import { useSessionState } from '@/shared/lib/useSessionState';
import { Avatar } from '@/shared/ui/Avatar';
import { Spinner } from '@/shared/ui/Button';
import { Notice, PageTitle, Pill } from '@/shared/ui/Card';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { FilterSelect, ListToolbar } from '@/shared/ui/ListToolbar';
import { chipClasses, SegmentedTabs } from '@/shared/ui/Tabs';
import { errorMessage } from '@/shared/ui/errorMessages';
import { toTitleCase } from '@/shared/validation/names';
import { WishlistService } from '../application/WishlistService';
import type { WishlistItem } from '../domain/WishlistItem';
import { DrivePhoto } from './DrivePhoto';
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
        <p className="flex items-center gap-3 rounded-xl border-2 border-night-900 bg-gold-100 px-4 py-3 text-base">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-night-900 bg-gold-400 text-night-900" aria-hidden>
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

interface GiftListPrefs extends ListPrefs {
  /** '' = todas · 'none' = sin familia · id de familia */
  familyId: string;
  /** '' = todos · 'with' = ya agregó regalos · 'without' = todavía no */
  gifts: string;
}

const GIFT_LIST_DEFAULTS: GiftListPrefs = { ...DEFAULT_LIST_PREFS, sort: 'name', familyId: '', gifts: '' };

function EveryonesGifts({ items }: { items: WishlistItem[] }) {
  const { event } = useEventScope();
  const participants = useParticipants(event.id);
  const families = useFamilies(event.id);
  const byPerson = useMemo(() => WishlistService.groupByParticipant(items), [items]);
  const [prefs, setPrefs] = useSessionState<GiftListPrefs>(`${event.id}:regalos:todos`, GIFT_LIST_DEFAULTS);

  if (participants.isLoading || families.isLoading) return <Spinner label="Cargando…" />;
  if (participants.error) return <Notice tone="error">{errorMessage(participants.error)}</Notice>;

  const familyList = families.data ?? [];
  const everyone = participants.data ?? [];
  const patch = (p: Partial<GiftListPrefs>) => setPrefs((prev) => ({ ...prev, ...p }));
  const familyOf = (p: Participant) => familyList.find((f) => f.id === p.familyId);
  const countOf = (p: Participant) => byPerson.get(p.id)?.length ?? 0;
  const sorters: Record<string, (p: Participant) => SortValue> = {
    name: (p) => displayName(p),
    family: (p) => familyOf(p)?.name,
    count: countOf,
  };
  // Búsqueda sin importar tildes ni mayúsculas: "jose" encuentra a "JOSÉ"
  const people = applySort(
    everyone.filter((p) => {
      if (!matchesSearch(prefs.q, displayName(p), familyOf(p)?.name)) return false;
      if (prefs.familyId && (prefs.familyId === 'none' ? Boolean(familyOf(p)) : p.familyId !== prefs.familyId)) return false;
      if (prefs.gifts && (prefs.gifts === 'with') !== countOf(p) > 0) return false;
      return true;
    }),
    sorters,
    prefs.sort,
    prefs.dir,
  );
  const hasFilters = Boolean(prefs.q || prefs.familyId || prefs.gifts);
  const columns: Column<Participant>[] = [
    {
      key: 'name',
      header: 'Persona',
      sortKey: 'name',
      cell: (p) => (
        <Link to={`/e/${event.id}/regalos/persona/${p.id}`} className="flex min-h-10 items-center gap-1 font-bold text-brand underline decoration-2 underline-offset-4">
          {displayName(p)}
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </Link>
      ),
    },
    { key: 'family', header: 'Familia', sortKey: 'family', cell: (p) => <FamilyBadge family={familyOf(p)} /> },
    {
      key: 'count',
      header: 'Regalos',
      sortKey: 'count',
      className: 'whitespace-nowrap tabular-nums',
      cell: (p) => (countOf(p) === 0 ? <span className="text-ink-500">Todavía ninguno</span> : `🎁 ${countOf(p)}`),
    },
  ];
  const groups: { key: string; family?: Family; people: Participant[] }[] = [
    ...familyList.map((f) => ({ key: f.id, family: f, people: people.filter((p) => p.familyId === f.id) })),
    { key: 'none', people: people.filter((p) => !p.familyId || !familyList.some((f) => f.id === p.familyId)) },
  ].filter((g) => g.people.length > 0);

  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-base text-ink-700">
        <Users className="size-5 shrink-0" aria-hidden /> Toca a una persona para ver qué le gustaría recibir.
      </p>
      <ListToolbar
        prefs={prefs}
        onChange={patch}
        searchLabel="Buscar a una persona"
        sortOptions={[
          { value: 'name', label: 'Nombre' },
          { value: 'family', label: 'Familia' },
          { value: 'count', label: 'Cantidad de regalos' },
        ]}
        showView
        summary={hasFilters ? `${people.length} de ${everyone.length} personas` : undefined}
        onReset={hasFilters ? () => patch({ q: '', familyId: '', gifts: '' }) : null}
        activeFilters={[prefs.familyId, prefs.gifts].filter(Boolean).length}
      >
        {familyList.length > 0 && (
          <FilterSelect label="Familia" value={prefs.familyId} onChange={(familyId) => patch({ familyId })}>
            <option value="">Todas</option>
            {familyList.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value="none">Sin familia</option>
          </FilterSelect>
        )}
        <FilterSelect label="Lista de regalos" value={prefs.gifts} onChange={(gifts) => patch({ gifts })}>
          <option value="">Todos</option>
          <option value="with">Ya agregó regalos</option>
          <option value="without">Todavía no agregó</option>
        </FilterSelect>
      </ListToolbar>
      {people.length === 0 && <Notice>No encontramos a nadie con esos filtros.</Notice>}
      {prefs.view === 'table' && people.length > 0 && (
        <DataTable
          label="Regalos de todos"
          rows={people}
          columns={columns}
          rowKey={(p) => p.id}
          sort={{ field: prefs.sort, dir: prefs.dir }}
          onSort={(field) => patch(toggleSort(prefs, field))}
        />
      )}
      {(prefs.view === 'table' ? [] : groups).map((g) => (
        <section key={g.key} className="space-y-2">
          <h2 className="text-lg font-bold">{g.family ? <FamilyBadge family={g.family} /> : 'Sin familia'}</h2>
          <ul className="stagger space-y-2">
            {g.people.map((p) => {
              const wishes = WishlistService.byPriority(byPerson.get(p.id) ?? []);
              const count = wishes.length;
              const preview = wishes.slice(0, 2).map((w) => w.title);
              const cover = wishes.find((w) => w.photos.length > 0)?.photos[0];
              return (
                <li key={p.id}>
                  <Link
                    to={`/e/${event.id}/regalos/persona/${p.id}`}
                    className="tap-card flex min-h-16 items-center gap-3 rounded-2xl border-2 border-mist-300 bg-white px-4 py-3 shadow-card hover:border-brand"
                  >
                    <Avatar name={p.fullName} colors={g.family && { bg: FAMILY_COLORS[g.family.color].soft, fg: FAMILY_COLORS[g.family.color].text }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-bold leading-tight">{displayName(p)}</span>
                      {count === 0 ? (
                        <span className="block text-sm text-ink-700">Todavía no agregó regalos</span>
                      ) : (
                        <span className="block truncate text-sm text-ink-700">
                          <span className="sr-only">Le gustaría: </span>
                          {preview.join(' · ')}
                          {count > preview.length && <strong className="text-ink-900"> y {count - preview.length} más</strong>}
                        </span>
                      )}
                    </span>
                    {cover && <DrivePhoto driveFileId={cover.driveFileId} alt="" width={160} className="size-14 shrink-0 rounded-lg border-2 border-night-900/15" />}
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
