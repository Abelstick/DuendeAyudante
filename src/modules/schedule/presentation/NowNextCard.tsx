import { ChevronRight, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { formatShortDateTime, formatTime, instantToZonedParts } from '@/shared/lib/datetime';
import { currentScheduleItemId, nextScheduleItem } from '../domain/Schedule';
import { useSchedule } from './hooks';

/** En Inicio: qué actividad está pasando ahora y cuál sigue. Si no hay cronograma, no ocupa espacio. */
export function NowNextCard() {
  const { event } = useEventScope();
  const schedule = useSchedule(event.id);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const items = schedule.data ?? [];
  const current = items.find((i) => i.id === currentScheduleItemId(items, now));
  const next = nextScheduleItem(items, now);
  if (!current && !next) return null;

  const sameDay = (d: Date) => instantToZonedParts(d, event.timezone).date === instantToZonedParts(now, event.timezone).date;
  const when = (d: Date) => (sameDay(d) ? formatTime(d, event.timezone) : formatShortDateTime(d, event.timezone));

  return (
    <Link
      to={`/e/${event.id}/celebracion?vista=cronograma`}
      className="tap-card flex items-center gap-3 rounded-2xl border-[3px] border-night-900 bg-sky-100 p-4 shadow-block active:shadow-none"
      aria-label="Ver el cronograma completo"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-night-900 bg-night-700 text-gold-300" aria-hidden>
        <Clock className="size-6" />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        {current && (
          <span className="block">
            <span className="font-display mr-2 inline-flex items-center gap-1.5 rounded-lg border-2 border-night-900 bg-berry-600 px-2 py-0.5 text-sm font-semibold text-white">
              <span className="size-2 rounded-full bg-white motion-safe:animate-pulse" aria-hidden />
              AHORA
            </span>
            <span className="font-display text-lg font-semibold text-night-900">{current.title}</span>
          </span>
        )}
        {next && (
          <span className="block text-base text-night-800">
            <span className="font-bold">{current ? 'Después: ' : 'Sigue: '}</span>
            {next.title} · {when(next.startsAt)}
          </span>
        )}
      </span>
      <ChevronRight className="size-6 shrink-0 text-night-700" aria-hidden />
    </Link>
  );
}
