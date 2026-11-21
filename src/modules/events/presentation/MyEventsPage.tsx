import { CalendarPlus, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FullPageSpinner } from '@/app/layout/FullPageSpinner';
import { PublicLayout } from '@/app/layout/PublicLayout';
import { formatEventDate } from '@/shared/lib/datetime';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { ROLE_LABELS, type ChristmasEvent } from '../domain/Event';
import { DuplicateEventModal } from './DuplicateEventModal';
import { useMyEvents } from './hooks';

export function MyEventsPage() {
  const events = useMyEvents();
  const [duplicating, setDuplicating] = useState<ChristmasEvent | null>(null);
  if (events.isLoading) return <FullPageSpinner />;

  const now = Date.now();

  return (
    <PublicLayout>
      <h1 className="mb-4 rounded-2xl border-2 border-line bg-surface px-5 py-4 text-2xl font-semibold text-heading shadow-block">Mis Navidades</h1>
      {events.error && <Notice tone="error">{errorMessage(events.error)}</Notice>}
      <ul className="stagger space-y-3">
        {(events.data ?? []).map(({ event, role }) => {
          const past = event.celebrationAt.getTime() <= now;
          return (
            <li key={event.id} className="space-y-2">
              <Link
                to={`/e/${event.id}`}
                className="tap-card flex min-h-20 items-center justify-between gap-3 rounded-2xl border-2 border-line bg-surface p-5 shadow-block hover:border-brand"
              >
                <span>
                  <span className="block text-lg font-extrabold text-ink-900">🎄 {event.name}</span>
                  <span className="block text-base text-ink-700 first-letter:uppercase">{formatEventDate(event.celebrationAt, event.timezone)}</span>
                  <span className="mt-1 inline-block rounded-full bg-brand-soft px-3 py-0.5 text-sm font-bold text-brand-ink">{ROLE_LABELS[role]}</span>
                </span>
                <ChevronRight className="size-7 shrink-0 text-brand-ink" aria-hidden />
              </Link>
              {past && (
                <div className="flex flex-wrap gap-2 pl-2">
                  <ButtonLink to={`/e/${event.id}/recuerdos`} variant="ghost" icon={<Sparkles className="size-5" aria-hidden />}>
                    Ver los recuerdos
                  </ButtonLink>
                  {role === 'owner' && (
                    <Button variant="ghost" onClick={() => setDuplicating(event)} icon={<CalendarPlus className="size-5" aria-hidden />}>
                      Crear la del próximo año
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ButtonLink to="/crear" variant="secondary" size="lg" className="mt-6" icon={<Plus className="size-6" aria-hidden />}>
        Crear otra Navidad
      </ButtonLink>
      {duplicating && <DuplicateEventModal event={duplicating} onClose={() => setDuplicating(null)} />}
    </PublicLayout>
  );
}
