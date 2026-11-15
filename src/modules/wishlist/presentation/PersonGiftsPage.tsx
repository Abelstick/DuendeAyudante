import { ArrowLeft } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants, canManageEvent } from '@/modules/events/domain/Event';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { ButtonLink, Spinner } from '@/shared/ui/Button';
import { EmptyState, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { toTitleCase } from '@/shared/validation/names';
import { EditableWishlist } from './EditableWishlist';
import { useEventWishlist } from './hooks';
import { WishlistItemCard } from './WishlistItemCard';

/** Lista de deseos de una persona (todos los del evento pueden verla). */
export function PersonGiftsPage() {
  const { participantId = '' } = useParams();
  const { event, context } = useEventScope();
  const participants = useParticipants(event.id);
  const families = useFamilies(event.id);
  const wishlist = useEventWishlist(event.id);
  const budget = event.giftExchange?.budgetMax ?? null;

  if (participants.isLoading || wishlist.isLoading) return <Spinner label="Cargando…" />;
  if (participants.error || wishlist.error) return <Notice tone="error">{errorMessage(participants.error ?? wishlist.error)}</Notice>;

  const person = participants.data?.find((p) => p.id === participantId);
  if (!person) return <Notice tone="error">No encontramos a esta persona.</Notice>;

  const items = (wishlist.data ?? []).filter((w) => w.participantId === person.id);
  const canEdit = canManageEvent(context.role) || actingParticipants(context).some((p) => p.id === person.id);

  return (
    <div className="space-y-5">
      <ButtonLink to={`/e/${event.id}/regalos?vista=todos`} variant="ghost" icon={<ArrowLeft className="size-5" aria-hidden />}>
        Volver a Regalos de todos
      </ButtonLink>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-brand">{displayName(person)}</h1>
        <FamilyBadge family={families.data?.find((f) => f.id === person.familyId)} showColorName />
      </header>

      {canEdit ? (
        <EditableWishlist
          eventId={event.id}
          participantId={person.id}
          items={items}
          budget={budget}
          currency={event.currency}
          forName={person.id === context.me?.id ? undefined : toTitleCase(person.firstName)}
        />
      ) : items.length === 0 ? (
        <EmptyState emoji="🎁" title="Todavía no agregó regalos." />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <WishlistItemCard key={item.id} item={item} budget={budget} currency={event.currency} canEdit={false} />
          ))}
        </div>
      )}
    </div>
  );
}
