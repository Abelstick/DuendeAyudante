import { ChevronRight, ClipboardList } from 'lucide-react';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants, canEditContent } from '@/modules/events/domain/Event';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { ButtonLink } from '@/shared/ui/Button';
import { Pill } from '@/shared/ui/Card';
import { CollapsibleCard } from '@/shared/ui/CollapsibleCard';
import { ResponsibilityService } from '../application/ResponsibilityService';
import { useResponsibilities, useStatusChanger } from './hooks';
import { ResponsibilityCard } from './ResponsibilityCard';

/** En Inicio: lo que le toca a la persona (o a su familia, o a sus hijos). */
export function MyResponsibilitiesCard() {
  const { event, context } = useEventScope();
  const responsibilities = useResponsibilities(event.id);
  const participants = useParticipants(event.id);
  const families = useFamilies(event.id);
  const { change, busyId } = useStatusChanger(event.id);

  const me = actingParticipants(context);
  if (me.length === 0 || !responsibilities.data) return null;

  const mine = ResponsibilityService.mine(responsibilities.data, me);
  if (mine.length === 0) return null;

  const pending = mine.filter((r) => r.status !== 'done');
  const shown = (pending.length > 0 ? pending : mine).slice(0, 3);

  return (
    <CollapsibleCard
      id="inicio:responsabilidades"
      icon={<ClipboardList className="size-6" />}
      title="Mis responsabilidades"
      action={
        pending.length > 0 ? (
          <Pill tone="gold">
            {pending.length}
            <span className="sr-only"> por hacer</span>
          </Pill>
        ) : (
          <Pill tone="success">Al día</Pill>
        )
      }
    >
      <p className="text-base">
        {pending.length === 0 ? (
          <strong>🎉 ¡Cumpliste todo lo que te tocaba!</strong>
        ) : (
          <>
            Te {pending.length === 1 ? 'falta' : 'faltan'} <strong>{pending.length}</strong> de {mine.length}.
          </>
        )}
      </p>
      <div className="space-y-3">
        {shown.map((r) => (
          <ResponsibilityCard
            key={r.id}
            item={r}
            families={families.data ?? []}
            participants={participants.data ?? []}
            canChangeStatus
            canEdit={false}
            compact
            busy={busyId === r.id}
            onStatus={(s) => change(r, s)}
          />
        ))}
      </div>
      <ButtonLink
        to={`/e/${event.id}/celebracion`}
        variant="ghost"
        icon={<ChevronRight className="size-5" aria-hidden />}
      >
        {canEditContent(context.role) ? 'Ver y organizar todo' : 'Ver todas las responsabilidades'}
      </ButtonLink>
    </CollapsibleCard>
  );
}
