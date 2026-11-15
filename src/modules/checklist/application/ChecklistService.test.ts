import { describe, expect, it } from 'vitest';
import type { Participant } from '@/modules/members/domain/Participant';
import type { ChecklistItem } from '../domain/Checklist';
import { ChecklistService } from './ChecklistService';

const person = (id: string, familyId: string | null, firstName = 'ROSA'): Participant => ({
  id,
  eventId: 'e',
  familyId,
  hasAccount: true,
  firstName,
  paternalSurname: 'GARCÍA',
  maternalSurname: null,
  fullName: `${firstName} GARCÍA`,
  distinguishingNote: null,
});

const item = (id: string, over: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id,
  eventId: 'e',
  title: `Tarea ${id}`,
  description: null,
  scope: 'all',
  familyId: null,
  participantId: null,
  sortOrder: 0,
  ...over,
});

describe('checklist personal', () => {
  const me = person('me', 'fam-roja');

  it('la tarea de regalos se marca sola cuando hay al menos un regalo', () => {
    const empty = ChecklistService.buildPersonal({ eventId: 'e', me, wards: [], items: [], progress: [], wishCount: () => 0 });
    expect(empty.entries[0]).toMatchObject({ key: 'auto:wishlist', done: false });
    const withGift = ChecklistService.buildPersonal({ eventId: 'e', me, wards: [], items: [], progress: [], wishCount: () => 2 });
    expect(withGift.entries[0]!.done).toBe(true);
    expect(withGift.percent).toBe(100);
  });

  it('incluye los regalos de las personas a cargo', () => {
    const kid = person('kid', 'fam-roja', 'JUAN');
    const r = ChecklistService.buildPersonal({
      eventId: 'e',
      me,
      wards: [kid],
      items: [],
      progress: [],
      wishCount: (id) => (id === 'me' ? 1 : 0),
    });
    expect(r.entries.map((e) => e.title)).toEqual(['Agrega tus opciones de regalo', 'Agrega los regalos de Juan']);
    expect(r).toMatchObject({ done: 1, total: 2, percent: 50 });
  });

  it('agrega «Cumple tus responsabilidades» solo si tiene alguna, y se marca sola al completarlas', () => {
    const none = ChecklistService.buildPersonal({ eventId: 'e', me, wards: [], items: [], progress: [], wishCount: () => 0, responsibilities: { total: 0, done: 0 } });
    expect(none.entries.some((e) => e.key === 'auto:responsibilities')).toBe(false);
    const some = ChecklistService.buildPersonal({ eventId: 'e', me, wards: [], items: [], progress: [], wishCount: () => 0, responsibilities: { total: 2, done: 1 } });
    expect(some.entries.find((e) => e.key === 'auto:responsibilities')).toMatchObject({ done: false, title: 'Cumple tus responsabilidades (1 de 2)' });
    const all = ChecklistService.buildPersonal({ eventId: 'e', me, wards: [], items: [], progress: [], wishCount: () => 0, responsibilities: { total: 2, done: 2 } });
    expect(all.entries.find((e) => e.key === 'auto:responsibilities')?.done).toBe(true);
  });

  it('solo muestra las tareas que le corresponden: todos, su familia o ella', () => {
    const items = [
      item('todos'),
      item('mi-familia', { scope: 'family', familyId: 'fam-roja' }),
      item('otra-familia', { scope: 'family', familyId: 'fam-azul' }),
      item('para-mi', { scope: 'participant', participantId: 'me' }),
      item('para-otro', { scope: 'participant', participantId: 'otro' }),
    ];
    const r = ChecklistService.buildPersonal({
      eventId: 'e',
      me,
      wards: [],
      items,
      progress: [{ itemId: 'todos', participantId: 'me' }, { itemId: 'para-mi', participantId: 'otro' }],
      wishCount: () => 0,
    });
    const manual = r.entries.filter((e) => e.kind === 'manual');
    expect(manual.map((e) => e.itemId)).toEqual(['todos', 'mi-familia', 'para-mi']);
    expect(manual.map((e) => e.done)).toEqual([true, false, false]);
  });
});
