import { ArrowLeft } from 'lucide-react';
import { useLocation, useParams } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants, canManageEvent } from '@/modules/events/domain/Event';
import { FAMILY_COLORS } from '@/modules/families/presentation/familyTheme';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { Avatar } from '@/shared/ui/Avatar';
import { ButtonLink, Spinner } from '@/shared/ui/Button';
import { EmptyState, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { toTitleCase } from '@/shared/validation/names';
import { useMySecretFriends } from '@/modules/secret-friend/presentation/hooks';
import { EditableWishlist } from './EditableWishlist';
import { GiftQuestions } from './GiftQuestions';
import { useEventWishlist } from './hooks';
import { useQuestionStats } from './questionHooks';
import { QuestionsPill } from './QuestionsPill';
import { WishlistItemCard } from './WishlistItemCard';

/** Lista de deseos de una persona (todos los del evento pueden verla). */
export function PersonGiftsPage() {
  const { participantId = '' } = useParams();
  // El aviso de amigo secreto solo aparece si se llega desde la tarjeta ya desbloqueada con contraseña
  const unlocked = (useLocation().state as { secretFriendUnlocked?: boolean } | null)?.secretFriendUnlocked === true;
  const { event, context } = useEventScope();
  const participants = useParticipants(event.id);
  const secretNotes = useMySecretFriends(event.id);
  const families = useFamilies(event.id);
  const wishlist = useEventWishlist(event.id);
  const budget = event.giftExchange?.budgetMax ?? null;
  const stats = useQuestionStats(event.id);

  if (participants.isLoading || wishlist.isLoading) return <Spinner label="Cargando…" />;
  if (participants.error || wishlist.error) return <Notice tone="error">{errorMessage(participants.error ?? wishlist.error)}</Notice>;

  const person = participants.data?.find((p) => p.id === participantId);
  if (!person) return <Notice tone="error">No encontramos a esta persona.</Notice>;

  const family = families.data?.find((f) => f.id === person.familyId);
  const items = (wishlist.data ?? []).filter((w) => w.participantId === person.id);
  const canEdit = canManageEvent(context.role) || actingParticipants(context).some((p) => p.id === person.id);

  return (
    <div className="space-y-5">
      <ButtonLink to={`/e/${event.id}/regalos?vista=todos`} variant="ghost" icon={<ArrowLeft className="size-5" aria-hidden />}>
        Volver a Regalos de todos
      </ButtonLink>
      <header className="flex items-center gap-4 rounded-2xl border-2 border-line bg-surface p-5 shadow-block">
        <Avatar name={person.fullName} size="lg" colors={family && { bg: FAMILY_COLORS[family.color].soft, fg: FAMILY_COLORS[family.color].text }} />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-bold uppercase tracking-wide text-ink-500">Lista de deseos de</p>
          <h1 className="text-2xl font-black leading-tight text-ink-900">{displayName(person)}</h1>
          <FamilyBadge family={family} showColorName />
          {stats.get(person.id) && (
            <p className="flex flex-wrap items-center gap-2 pt-1 text-sm text-ink-700">
              <QuestionsPill stats={stats.get(person.id)} />
              <span>Están dentro de cada regalo.</span>
            </p>
          )}
        </div>
      </header>

      {unlocked && secretNotes.data?.some((n) => n.receiverId === person.id) && (
        <Notice tone="success">🎁 Anotaste que es tu amigo secreto. Solo tú ves este aviso. 🤫</Notice>
      )}

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
        <div className="stagger space-y-4">
          {items.map((item) => (
            <WishlistItemCard key={item.id} item={item} budget={budget} currency={event.currency} canEdit={false}>
              {/* Preguntas anónimas: un botón discreto dentro de cada regalo */}
              <GiftQuestions eventId={event.id} itemId={item.id} canAnswer={false} canAsk={Boolean(context.me)} />
            </WishlistItemCard>
          ))}
        </div>
      )}
    </div>
  );
}
