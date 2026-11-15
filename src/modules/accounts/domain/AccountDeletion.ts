import type { OwnedEvent, OwnershipChoices } from '@/shared/application/ports/IAuthService';

export const DELETE_CONFIRMATION_WORD = 'BORRAR';
export const DELETE_EVENT_CHOICE = 'DELETE';

export function isDeleteConfirmed(text: string): boolean {
  return text.trim().toUpperCase() === DELETE_CONFIRMATION_WORD;
}

/** Celebraciones que todavía no tienen decidido a quién pasarlas (o si se borran). */
export function pendingOwnedEvents(owned: readonly OwnedEvent[], choices: OwnershipChoices): OwnedEvent[] {
  return owned.filter((e) => {
    const choice = choices[e.eventId];
    return !choice || (choice !== DELETE_EVENT_CHOICE && !e.successors.some((s) => s.userId === choice));
  });
}

/** Celebraciones que se borrarán con la cuenta (para advertirlo antes). */
export function eventsToDelete(owned: readonly OwnedEvent[], choices: OwnershipChoices): OwnedEvent[] {
  return owned.filter((e) => choices[e.eventId] === DELETE_EVENT_CHOICE);
}
