import { ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FullPageSpinner } from '@/app/layout/FullPageSpinner';
import { PublicLayout } from '@/app/layout/PublicLayout';
import { formatEventDate } from '@/shared/lib/datetime';
import { ButtonLink } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { ROLE_LABELS } from '../domain/Event';
import { useMyEvents } from './hooks';

export function MyEventsPage() {
  const events = useMyEvents();
  if (events.isLoading) return <FullPageSpinner />;

  return (
    <PublicLayout>
      <h1 className="mb-4 text-2xl font-bold text-brand">Mis Navidades</h1>
      {events.error && <Notice tone="error">{errorMessage(events.error)}</Notice>}
      <ul className="space-y-3">
        {(events.data ?? []).map(({ event, role }) => (
          <li key={event.id}>
            <Link
              to={`/e/${event.id}`}
              className="flex min-h-20 items-center justify-between gap-3 rounded-3xl border border-cream-200 bg-white p-5 shadow-sm hover:border-brand"
            >
              <span>
                <span className="block text-lg font-bold text-brand">🎄 {event.name}</span>
                <span className="block text-base capitalize text-ink-700">{formatEventDate(event.celebrationAt, event.timezone)}</span>
                <span className="block text-sm text-ink-500">{ROLE_LABELS[role]}</span>
              </span>
              <ChevronRight className="size-7 shrink-0 text-brand" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <ButtonLink to="/crear" variant="secondary" size="lg" className="mt-6" icon={<Plus className="size-6" aria-hidden />}>
        Crear otra Navidad
      </ButtonLink>
    </PublicLayout>
  );
}
