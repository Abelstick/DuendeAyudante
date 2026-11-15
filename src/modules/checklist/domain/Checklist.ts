import type { Participant } from '@/modules/members/domain/Participant';

export type ChecklistScope = 'all' | 'family' | 'participant';

/** Tarea creada por el organizador, un administrador o un editor. */
export interface ChecklistItem {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  scope: ChecklistScope;
  familyId: string | null;
  participantId: string | null;
  sortOrder: number;
}

export interface ChecklistProgress {
  itemId: string;
  participantId: string;
}

export interface SaveChecklistItemData {
  title: string;
  description: string | null;
  scope: ChecklistScope;
  familyId: string | null;
  participantId: string | null;
}

/** Una línea del checklist personal (automática o creada por el organizador). */
export interface ChecklistEntry {
  key: string;
  title: string;
  description: string | null;
  done: boolean;
  /** auto = se marca sola según lo que la persona hizo; manual = la persona la marca. */
  kind: 'auto' | 'manual';
  itemId?: string;
  participantId: string;
  link?: string;
  linkLabel?: string;
}

export function appliesTo(item: ChecklistItem, person: Pick<Participant, 'id' | 'familyId'>): boolean {
  if (item.scope === 'all') return true;
  if (item.scope === 'family') return item.familyId !== null && item.familyId === person.familyId;
  return item.participantId === person.id;
}

export const SCOPE_LABELS: Record<ChecklistScope, string> = {
  all: 'Para todos',
  family: 'Para una familia',
  participant: 'Para una persona',
};
