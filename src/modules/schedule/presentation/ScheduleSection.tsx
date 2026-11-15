import { Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { canEditContent } from '@/modules/events/domain/Event';
import { displayName } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { formatDateOnly, formatTime, instantToZonedParts } from '@/shared/lib/datetime';
import { Button, Spinner } from '@/shared/ui/Button';
import { EmptyState, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { currentScheduleItemId, SCHEDULE_STATUS_LABELS, type ScheduleItem, sortSchedule } from '../domain/Schedule';
import { useSchedule } from './hooks';
import { ScheduleFormModal } from './ScheduleFormModal';

/** Cronograma del día: todos lo ven; la actividad de este momento se marca como "AHORA". */
export function ScheduleSection() {
  const { event, context } = useEventScope();
  const schedule = useSchedule(event.id);
  const participants = useParticipants(event.id);
  const [editing, setEditing] = useState<{ item: ScheduleItem | null } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const isEditor = canEditContent(context.role);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (schedule.isLoading) return <Spinner label="Cargando cronograma…" />;
  if (schedule.error) return <Notice tone="error">{errorMessage(schedule.error)}</Notice>;

  const items = sortSchedule(schedule.data ?? []);
  const currentId = currentScheduleItemId(items, now);
  const people = participants.data ?? [];

  // Agrupa por día (por si la celebración pasa de medianoche o dura varios días)
  const days = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const day = instantToZonedParts(item.startsAt, event.timezone).date;
    days.set(day, [...(days.get(day) ?? []), item]);
  }

  return (
    <div className="space-y-4">
      {isEditor && (
        <Button onClick={() => setEditing({ item: null })} icon={<Plus className="size-5" aria-hidden />}>
          Agregar actividad
        </Button>
      )}

      {items.length === 0 ? (
        <EmptyState emoji="🕰️" title="Todavía no hay cronograma.">
          {isEditor ? 'Agrega las actividades del día: llegada, cena, intercambio de regalos…' : 'Pronto el organizador publicará el cronograma.'}
        </EmptyState>
      ) : (
        [...days.entries()].map(([day, dayItems]) => (
          <section key={day} className="space-y-2">
            {days.size > 1 && <h3 className="text-lg font-extrabold text-ink-900 first-letter:uppercase">{formatDateOnly(day)}</h3>}
            <ol className="stagger relative space-y-4 border-l-4 border-dashed border-night-900/40 pl-5">
              {dayItems.map((item) => {
                const isNow = item.id === currentId;
                const responsible = people.find((p) => p.id === item.responsibleId);
                const status = SCHEDULE_STATUS_LABELS[item.status];
                const muted = item.status === 'done' || item.status === 'cancelled';
                return (
                  <li
                    key={item.id}
                    className={`relative rounded-xl border-2 border-night-900 p-4 ${isNow ? 'bg-gold-100 shadow-[0_5px_0_0_var(--color-berry-600)]' : 'bg-white shadow-block'} ${muted ? 'opacity-70' : ''}`}
                    aria-current={isNow ? 'step' : undefined}
                  >
                    <span className={`absolute -left-[2.05rem] top-5 size-5 rounded-md border-2 border-night-900 ${isNow ? 'bg-berry-600' : item.status === 'done' ? 'bg-pine-600' : 'bg-night-600'}`} aria-hidden />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display rounded-lg bg-night-800 px-3 py-0.5 text-base font-semibold text-white">
                        {formatTime(item.startsAt, event.timezone)}
                        {item.endsAt && <span className="font-semibold text-white/85"> – {formatTime(item.endsAt, event.timezone)}</span>}
                      </p>
                      {isNow ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-berry-600 px-3 py-1 text-sm font-black text-white">
                          <span className="size-2 rounded-full bg-white motion-safe:animate-pulse" aria-hidden />
                          AHORA
                        </span>
                      ) : (
                        item.status !== 'pending' && (
                          <span className="rounded-full bg-mist-200 px-3 py-1 text-sm font-bold text-ink-700">
                            <span aria-hidden>{status.emoji}</span> {status.label}
                          </span>
                        )
                      )}
                    </div>
                    <p className={`mt-2 text-lg font-extrabold leading-snug ${item.status === 'cancelled' ? 'line-through' : ''}`}>{item.title}</p>
                    {item.description && <p className="whitespace-pre-line text-base text-ink-700">{item.description}</p>}
                    {responsible && <p className="text-sm text-ink-700">🎤 Responsable: {displayName(responsible)}</p>}
                    {isEditor && (
                      <Button variant="ghost" onClick={() => setEditing({ item })} icon={<Pencil className="size-5" aria-hidden />}>
                        Editar
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}

      {editing && (
        <ScheduleFormModal
          key={editing.item?.id ?? 'new'}
          eventId={event.id}
          timezone={event.timezone}
          celebrationAt={event.celebrationAt}
          initial={editing.item}
          participants={people}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
