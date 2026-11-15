import { Check, ChevronRight, ListChecks } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { ResponsibilityService } from '@/modules/responsibilities/application/ResponsibilityService';
import { useResponsibilities } from '@/modules/responsibilities/presentation/hooks';
import { actingParticipants } from '@/modules/events/domain/Event';
import { useEventWishlist } from '@/modules/wishlist/presentation/hooks';
import { Spinner } from '@/shared/ui/Button';
import { Card, CardTitle, Pill } from '@/shared/ui/Card';
import { ProgressBar } from '@/shared/ui/Progress';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';
import { ChecklistService } from '../application/ChecklistService';
import type { ChecklistEntry } from '../domain/Checklist';
import { useChecklistItems, useChecklistMutations, useChecklistProgress } from './hooks';

/** "Tu preparación": lo que le falta a la persona, con su progreso. */
export function ChecklistCard() {
  const { event, context } = useEventScope();
  const items = useChecklistItems(event.id);
  const progress = useChecklistProgress(event.id);
  const wishlist = useEventWishlist(event.id);
  const responsibilities = useResponsibilities(event.id);
  const { setDone } = useChecklistMutations(event.id);
  const toast = useToast();

  const checklist = useMemo(() => {
    if (!context.me || !items.data || !progress.data || !wishlist.data) return null;
    const mine = ResponsibilityService.mine(responsibilities.data ?? [], actingParticipants(context));
    const counts = new Map<string, number>();
    for (const w of wishlist.data) counts.set(w.participantId, (counts.get(w.participantId) ?? 0) + 1);
    return ChecklistService.buildPersonal({
      eventId: event.id,
      me: context.me,
      wards: context.wards,
      items: items.data,
      progress: progress.data,
      wishCount: (id) => counts.get(id) ?? 0,
      responsibilities: { total: mine.length, done: mine.filter((r) => r.status === 'done').length },
    });
  }, [context, event.id, items.data, progress.data, wishlist.data, responsibilities.data]);

  if (!context.me) return null;

  const toggle = async (entry: ChecklistEntry) => {
    if (!entry.itemId) return;
    try {
      await setDone.mutateAsync({ itemId: entry.itemId, participantId: entry.participantId, done: !entry.done });
      if (!entry.done) {
        const wasLast = checklist !== null && checklist.total - checklist.done === 1;
        if (wasLast) toast.celebrate('🎉 ¡Completaste toda tu preparación!');
        else toast.success('¡Bien hecho! Tarea completada.');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Card className="space-y-4">
      <CardTitle
        icon={<ListChecks className="size-6" />}
        action={checklist ? <Pill tone={checklist.done === checklist.total ? 'gold' : 'brand'}>{checklist.done} de {checklist.total}</Pill> : undefined}
      >
        Tu preparación
      </CardTitle>

      {!checklist ? (
        <Spinner label="Cargando…" />
      ) : (
        <>
          <div>
            {checklist.done === checklist.total && <p className="mb-2 text-base font-bold text-gold-700">🎉 ¡Completaste todo! Ya estás listo para la fiesta.</p>}
            <ProgressBar percent={checklist.percent} label="Progreso de tu preparación" tone={checklist.done === checklist.total ? 'gold' : 'brand'} />
          </div>

          <ul className="space-y-2">
            {checklist.entries.map((entry) => (
              <li key={entry.key} className={`rounded-2xl border-2 p-3 transition-colors ${entry.done ? 'border-brand-soft bg-brand-soft' : 'border-mist-200 bg-white'}`}>
                <div className="flex items-start gap-3">
                  {entry.kind === 'manual' ? (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={entry.done}
                      aria-label={entry.title}
                      disabled={setDone.isPending}
                      onClick={() => toggle(entry)}
                      className={`flex size-12 shrink-0 items-center justify-center rounded-xl border-2 transition-all active:scale-90 ${
                        entry.done ? 'border-brand bg-brand text-white' : 'border-ink-500 bg-white hover:border-brand'
                      }`}
                    >
                      {entry.done && <Check className="size-7 animate-pop-in" strokeWidth={3} aria-hidden />}
                    </button>
                  ) : (
                    <span
                      className={`flex size-12 shrink-0 items-center justify-center rounded-xl border-2 ${
                        entry.done ? 'border-brand bg-brand text-white' : 'border-dashed border-ink-500 bg-white'
                      }`}
                      aria-hidden
                    >
                      {entry.done && <Check className="size-7" strokeWidth={3} />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-base font-semibold ${entry.done ? 'text-ink-700 line-through decoration-2' : 'text-ink-900'}`}>
                      {entry.title}
                      <span className="sr-only">{entry.done ? ' (hecho)' : ' (pendiente)'}</span>
                    </p>
                    {entry.description && !entry.done && <p className="text-sm text-ink-700">{entry.description}</p>}
                    {entry.kind === 'manual' && !entry.done && <p className="text-sm text-ink-500">Toca el cuadro cuando lo hayas hecho.</p>}
                    {entry.link && !entry.done && (
                      <Link to={entry.link} className="mt-1 inline-flex min-h-12 items-center gap-1 text-base font-bold text-brand underline underline-offset-4">
                        {entry.linkLabel}
                        <ChevronRight className="size-5" aria-hidden />
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
