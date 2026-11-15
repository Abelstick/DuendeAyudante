import type { Participant } from '@/modules/members/domain/Participant';

export type ResponsibilityKind = 'contribution' | 'task';
export type ResponsibilityStatus = 'pending' | 'in_progress' | 'done';
export type ResponsibilityCategory = 'decoration' | 'food' | 'salads' | 'desserts' | 'drinks' | 'tableware' | 'music' | 'other';

export interface Responsibility {
  id: string;
  eventId: string;
  kind: ResponsibilityKind;
  category: ResponsibilityCategory;
  title: string;
  description: string | null;
  /** "YYYY-MM-DD" */
  dueDate: string | null;
  status: ResponsibilityStatus;
  notes: string | null;
  participantIds: string[];
  familyIds: string[];
}

export interface SaveResponsibilityData {
  id: string | null;
  eventId: string;
  kind: ResponsibilityKind;
  category: ResponsibilityCategory;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: ResponsibilityStatus;
  notes: string | null;
  participantIds: string[];
  familyIds: string[];
}

export const KIND_LABELS: Record<ResponsibilityKind, { one: string; many: string }> = {
  contribution: { one: 'Aporte', many: 'Aportes' },
  task: { one: 'Tarea', many: 'Tareas' },
};

/** Siempre emoji + texto (nunca solo el color o el icono). */
export const CATEGORY_LABELS: Record<ResponsibilityCategory, { emoji: string; label: string }> = {
  food: { emoji: '🍗', label: 'Comida (pavo, platos)' },
  salads: { emoji: '🥗', label: 'Ensaladas' },
  desserts: { emoji: '🍰', label: 'Postres' },
  drinks: { emoji: '🥤', label: 'Bebidas' },
  decoration: { emoji: '🎄', label: 'Árbol, luces y decoración' },
  tableware: { emoji: '🍽️', label: 'Platos, cubiertos y manteles' },
  music: { emoji: '🎵', label: 'Música' },
  other: { emoji: '📌', label: 'Otro' },
};

export const STATUS_LABELS: Record<ResponsibilityStatus, { emoji: string; label: string }> = {
  pending: { emoji: '⏳', label: 'Pendiente' },
  in_progress: { emoji: '🔄', label: 'En progreso' },
  done: { emoji: '✅', label: 'Completada' },
};

/** ¿Le toca a alguna de estas personas (directamente o por su familia)? */
export function isAssignedTo(r: Responsibility, people: Pick<Participant, 'id' | 'familyId'>[]): boolean {
  return people.some((p) => r.participantIds.includes(p.id) || (p.familyId !== null && r.familyIds.includes(p.familyId)));
}
