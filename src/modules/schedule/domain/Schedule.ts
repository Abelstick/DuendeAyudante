export type ScheduleStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export interface ScheduleItem {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  responsibleId: string | null;
  status: ScheduleStatus;
}

export interface SaveScheduleData {
  id: string | null;
  eventId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  responsibleId: string | null;
  status: ScheduleStatus;
}

export interface IScheduleRepository {
  list(eventId: string): Promise<ScheduleItem[]>;
  save(data: SaveScheduleData): Promise<void>;
  remove(id: string): Promise<void>;
}

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, { emoji: string; label: string }> = {
  pending: { emoji: '🕒', label: 'Por empezar' },
  in_progress: { emoji: '▶️', label: 'En curso' },
  done: { emoji: '✅', label: 'Terminada' },
  cancelled: { emoji: '🚫', label: 'Cancelada' },
};

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

/**
 * Actividad que está ocurriendo "ahora": la marcada como en curso o, si no hay,
 * la que corresponde por la hora (hasta su fin, o hasta que empieza la siguiente).
 */
export function currentScheduleItemId(items: ScheduleItem[], now: Date = new Date()): string | null {
  const live = items.filter((i) => i.status !== 'cancelled' && i.status !== 'done');
  const marked = live.find((i) => i.status === 'in_progress');
  if (marked) return marked.id;
  const sorted = [...live].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]!;
    const next = sorted[i + 1];
    const end = item.endsAt ?? (next ? next.startsAt : new Date(item.startsAt.getTime() + DEFAULT_DURATION_MS));
    if (now >= item.startsAt && now < end) return item.id;
  }
  return null;
}

/** La próxima actividad que todavía no empieza (para mostrar "Después sigue…"). */
export function nextScheduleItem(items: ScheduleItem[], now: Date = new Date()): ScheduleItem | null {
  const upcoming = items
    .filter((i) => i.status === 'pending' && i.startsAt > now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return upcoming[0] ?? null;
}

export function sortSchedule(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.title.localeCompare(b.title, 'es'));
}
