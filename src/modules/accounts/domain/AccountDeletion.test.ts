import { describe, expect, it } from 'vitest';
import { eventsToDelete, isDeleteConfirmed, pendingOwnedEvents } from './AccountDeletion';

const owned = [
  { eventId: 'a', eventName: 'Navidad', successors: [{ userId: 'u1', name: 'MARIO' }] },
  { eventId: 'b', eventName: 'Año nuevo', successors: [] },
];

describe('borrar cuenta', () => {
  it('acepta BORRAR sin importar mayúsculas ni espacios', () => {
    expect(isDeleteConfirmed('  borrar ')).toBe(true);
    expect(isDeleteConfirmed('borra')).toBe(false);
  });

  it('cada celebración necesita un administrador válido o borrarse', () => {
    expect(pendingOwnedEvents(owned, {}).map((e) => e.eventId)).toEqual(['a', 'b']);
    expect(pendingOwnedEvents(owned, { a: 'otro', b: 'DELETE' }).map((e) => e.eventId)).toEqual(['a']);
    expect(pendingOwnedEvents(owned, { a: 'u1', b: 'DELETE' })).toEqual([]);
  });

  it('lista las que se van a borrar', () => {
    expect(eventsToDelete(owned, { a: 'u1', b: 'DELETE' }).map((e) => e.eventName)).toEqual(['Año nuevo']);
  });
});
