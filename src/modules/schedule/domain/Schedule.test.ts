import { describe, expect, it } from 'vitest';
import { currentScheduleItemId, type ScheduleItem } from './Schedule';

const at = (h: number, m = 0, day = 25) => new Date(Date.UTC(2026, 11, day, h, m));
const item = (id: string, start: Date, over: Partial<ScheduleItem> = {}): ScheduleItem => ({
  id,
  eventId: 'e',
  title: id,
  description: null,
  startsAt: start,
  endsAt: null,
  responsibleId: null,
  status: 'pending',
  ...over,
});

describe('actividad de "ahora"', () => {
  const items = [item('llegada', at(22)), item('cena', at(23), { endsAt: at(23, 45) }), item('regalos', at(1, 0, 26))];

  it('según la hora: dura hasta que empieza la siguiente o hasta su fin', () => {
    expect(currentScheduleItemId(items, at(22, 30))).toBe('llegada');
    expect(currentScheduleItemId(items, at(23, 10))).toBe('cena');
    expect(currentScheduleItemId(items, at(23, 50))).toBeNull();
    expect(currentScheduleItemId(items, at(21))).toBeNull();
  });

  it('si el organizador marca una como «en curso», esa manda', () => {
    const marked = items.map((i) => (i.id === 'regalos' ? { ...i, status: 'in_progress' as const } : i));
    expect(currentScheduleItemId(marked, at(22, 30))).toBe('regalos');
  });

  it('ignora actividades canceladas o terminadas', () => {
    const cancelled = items.map((i) => (i.id === 'llegada' ? { ...i, status: 'cancelled' as const } : i));
    expect(currentScheduleItemId(cancelled, at(22, 30))).toBeNull();
  });
});
