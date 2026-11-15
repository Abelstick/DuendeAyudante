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
      <h1 className="mb-4 rounded-3xl bg-white px-5 py-4 text-2xl font-black text-ink-900 shadow-card">Mis Navidades</h1>
      {events.error && <Notice tone="error">{errorMessage(events.error)}</Notice>}
      <ul className="stagger space-y-3">
        {(events.data ?? []).map(({ event, role }) => (
          <li key={event.id}>
            <Link
              to={`/e/${event.id}`}
              className="tap-card flex min-h-20 items-center justify-between gap-3 rounded-3xl border border-mist-200 bg-white p-5 shadow-card hover:border-brand"
            >
              <span>
                <span className="block text-lg font-extrabold text-ink-900">🎄 {event.name}</span>
                <span className="block text-base text-ink-700 first-letter:uppercase">{formatEventDate(event.celebrationAt, event.timezone)}</span>
                <span className="mt-1 inline-block rounded-full bg-brand-soft px-3 py-0.5 text-sm font-bold text-brand">{ROLE_LABELS[role]}</span>
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
