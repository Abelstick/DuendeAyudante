import { ChevronRight, ClipboardList } from 'lucide-react';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants, canEditContent } from '@/modules/events/domain/Event';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
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
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-bold text-brand">
        <ClipboardList className="size-6" aria-hidden /> Mis responsabilidades
      </h2>
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
        variant="secondary"
        icon={<ChevronRight className="size-5" aria-hidden />}
      >
        {canEditContent(context.role) ? 'Ver y organizar todo' : 'Ver todas las responsabilidades'}
      </ButtonLink>
    </Card>
  );
}
