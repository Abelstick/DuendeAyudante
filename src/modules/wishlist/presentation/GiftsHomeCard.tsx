import { ChevronRight, Gift, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants } from '@/modules/events/domain/Event';
import { FAMILY_COLORS } from '@/modules/families/domain/Family';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { matchesSearch, sortBy } from '@/shared/lib/listing';
import { Avatar } from '@/shared/ui/Avatar';
import { ButtonLink } from '@/shared/ui/Button';
import { Pill } from '@/shared/ui/Card';
import { CollapsibleCard } from '@/shared/ui/CollapsibleCard';
import { toTitleCase } from '@/shared/validation/names';
import { WishlistService } from '../application/WishlistService';
import { DrivePhoto } from './DrivePhoto';
import { useEventWishlist } from './hooks';
import { closeKeyboardOnEnter } from '@/shared/lib/virtualKeyboard';

/**
 * En Inicio: acceso rápido a las listas de deseos. Muestra cómo va la propia
 * lista y una fila deslizable con las demás personas (primero quienes ya
 * agregaron regalos y los de mi familia), con lo que más les gustaría recibir.
 */
export function GiftsHomeCard() {
  const { event, context } = useEventScope();
  const wishlist = useEventWishlist(event.id);
  const participants = useParticipants(event.id);
  const families = useFamilies(event.id);
  const [q, setQ] = useState('');

  const base = `/e/${event.id}`;
  const mineIds = new Set(actingParticipants(context).map((p) => p.id));
  const byPerson = useMemo(() => WishlistService.groupByParticipant(wishlist.data ?? []), [wishlist.data]);

  if (!wishlist.data || !participants.data) return null;

  const myCount = context.me ? (byPerson.get(context.me.id)?.length ?? 0) : 0;
  const familyList = families.data ?? [];
  const myFamilyId = context.me?.familyId ?? null;
  const others = participants.data.filter((p) => !mineIds.has(p.id));
  const withGifts = others.filter((p) => (byPerson.get(p.id)?.length ?? 0) > 0);

  // Sin búsqueda: solo quienes ya tienen lista. Buscando: cualquiera que coincida.
  const familyName = (familyId: string | null) => familyList.find((f) => f.id === familyId)?.name;
  const candidates = q.trim() ? others.filter((p) => matchesSearch(q, displayName(p), familyName(p.familyId))) : withGifts;
  const people = sortBy(
    sortBy(candidates, (p) => displayName(p)),
    (p) => ((byPerson.get(p.id)?.length ?? 0) > 0 ? 0 : 2) + (myFamilyId && p.familyId === myFamilyId ? 0 : 1),
  );

  return (
    <CollapsibleCard
      id="inicio:regalos"
      tourId="inicio-regalos"
      icon={<Gift className="size-6" />}
      tone="berry"
      title="Regalos"
      action={withGifts.length > 0 ? <Pill tone="berry">{withGifts.length} con lista</Pill> : undefined}
    >
      {/* Mi lista */}
      {context.me && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-night-900 bg-berry-50 p-3">
          <span className="text-3xl" aria-hidden>
            {myCount === 0 ? '📝' : '🎁'}
          </span>
          <p className="min-w-40 flex-1 text-base font-semibold text-ink-900">
            {myCount === 0 ? (
              'Todavía no agregas tu lista de deseos.'
            ) : (
              <>
                Tienes <strong>{myCount}</strong> {myCount === 1 ? 'regalo' : 'regalos'} en tu lista.
              </>
            )}
          </p>
          <ButtonLink
            to={myCount === 0 ? `${base}/regalos?agregar=1` : `${base}/regalos`}
            variant={myCount === 0 ? 'primary' : 'secondary'}
            icon={myCount === 0 ? <Plus className="size-5" aria-hidden /> : <ChevronRight className="size-5" aria-hidden />}
          >
            {myCount === 0 ? 'Agregar' : 'Mi lista'}
          </ButtonLink>
        </div>
      )}

      {/* Buscar a alguien */}
      {others.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
          <input
            type="search"
            enterKeyHint="search"
            onKeyDown={closeKeyboardOnEnter}
            aria-label="Buscar la lista de una persona"
            placeholder="¿Qué le gustaría a…?"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-h-12 w-full rounded-xl border-2 border-night-900 bg-white pl-10 pr-11 text-base text-ink-900 placeholder:text-ink-500 focus:outline-none focus:ring-4 focus:ring-aqua-400 [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => setQ('')}
              className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-700 hover:bg-mist-200"
            >
              <X className="size-5" aria-hidden />
            </button>
          )}
        </div>
      )}

      {people.length === 0 ? (
        <p className="text-base text-ink-700">{q.trim() ? 'No encontramos a nadie con ese nombre.' : 'Todavía nadie más agregó regalos. ¡Vuelve pronto!'}</p>
      ) : (
        <ul className="relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:-mx-5 sm:px-5" aria-label="Listas de deseos">
          {people.map((p) => {
            const wishes = WishlistService.byPriority(byPerson.get(p.id) ?? []);
            const family = familyList.find((f) => f.id === p.familyId);
            const colors = family && FAMILY_COLORS[family.color];
            return (
              <li key={p.id} className="w-44 shrink-0 snap-start">
                <Link
                  to={`${base}/regalos/persona/${p.id}`}
                  className="tap-card flex h-full flex-col gap-2 rounded-2xl border-2 border-mist-300 bg-white p-3 shadow-card hover:border-brand"
                  style={colors ? { borderTopColor: colors.swatch, borderTopWidth: 6 } : undefined}
                >
                  <span className="flex items-center justify-between gap-2">
                    <Avatar name={p.fullName} size="sm" colors={colors && { bg: colors.soft, fg: colors.text }} />
                    {wishes.length > 0 && (
                      <Pill tone="berry">
                        🎁 {wishes.length}
                        <span className="sr-only">{wishes.length === 1 ? ' regalo' : ' regalos'}</span>
                      </Pill>
                    )}
                  </span>
                  <span className="line-clamp-2 text-base font-bold leading-tight text-ink-900">
                    {toTitleCase(p.firstName)}
                    {p.distinguishingNote && <span className="font-semibold text-ink-700"> ({p.distinguishingNote})</span>}
                  </span>
                  {wishes[0]?.photos[0] && (
                    <DrivePhoto driveFileId={wishes[0].photos[0].driveFileId} alt="" width={360} className="h-24 w-full rounded-lg border-2 border-night-900/15" />
                  )}
                  <span className="mt-auto line-clamp-2 text-sm text-ink-700">
                    {wishes[0] ? (
                      <>
                        <span className="sr-only">Le encantaría: </span>✨ {wishes[0].title}
                      </>
                    ) : (
                      'Todavía no agregó regalos'
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        to={`${base}/regalos?vista=todos`}
        className="inline-flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-base font-bold text-brand underline decoration-2 underline-offset-4 hover:bg-brand-soft"
      >
        Ver los regalos de todos
        <ChevronRight className="size-5" aria-hidden />
      </Link>
    </CollapsibleCard>
  );
}
