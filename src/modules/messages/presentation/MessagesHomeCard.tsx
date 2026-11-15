import { ChevronRight, Mail, PenLine } from 'lucide-react';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants } from '@/modules/events/domain/Event';
import { formatEventDate, midnightAfter } from '@/shared/lib/datetime';
import { ButtonLink } from '@/shared/ui/Button';
import { Pill } from '@/shared/ui/Card';
import { CollapsibleCard } from '@/shared/ui/CollapsibleCard';
import { GiftBox } from '@/shared/ui/illustrations';
import { useReceivedMessages, useSentMessages } from './hooks';

/** En Inicio: cuántos mensajes me esperan (o ya puedo abrir) y un acceso para escribir. */
export function MessagesHomeCard() {
  const { event, context } = useEventScope();
  const received = useReceivedMessages(event.id);
  const sent = useSentMessages(event.id);
  if (actingParticipants(context).length === 0) return null;

  const inbox = received.data ?? [];
  const unlocked = inbox.some((m) => m.unlocked);
  const unlockText = formatEventDate(midnightAfter(event.celebrationAt, event.timezone), event.timezone);
  const base = `/e/${event.id}/mensajes`;

  return (
    <CollapsibleCard
      id="inicio:mensajes"
      icon={<Mail className="size-6" />}
      tone="berry"
      title="Mensajes navideños"
      action={inbox.length > 0 ? <Pill tone={unlocked ? 'gold' : 'berry'}>{unlocked ? '¡Ábrelos!' : `${inbox.length} esperando`}</Pill> : undefined}
    >
      {inbox.length > 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-berry-50 p-3">
          <GiftBox className="w-14 shrink-0 motion-safe:animate-float" open={unlocked} />
          <p className="text-base text-ink-900">
            {unlocked ? (
              <strong>¡Tus mensajes ya se pueden abrir! 🎄</strong>
            ) : (
              <>
                <strong>{inbox.length === 1 ? 'Tienes 1 mensaje esperando.' : `Tienes ${inbox.length} mensajes esperando.`}</strong> Se abre
                {inbox.length === 1 ? '' : 'n'} el <span className="first-letter:uppercase">{unlockText}</span>.
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="text-base text-ink-700">
          Déjale un mensaje a alguien de la familia. Lo podrá leer recién el <span className="first-letter:uppercase">{unlockText}</span>. ¡Puede ser sin firma!
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <ButtonLink to={`${base}?escribir=1`} icon={<PenLine className="size-5" aria-hidden />}>
          Escribir un mensaje
        </ButtonLink>
        <ButtonLink to={base} variant="secondary" icon={<ChevronRight className="size-5" aria-hidden />}>
          {unlocked ? 'Abrir mis mensajes' : `Ver mis mensajes${(sent.data ?? []).length > 0 ? ` (escribiste ${(sent.data ?? []).length})` : ''}`}
        </ButtonLink>
      </div>
    </CollapsibleCard>
  );
}
