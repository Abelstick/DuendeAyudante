import type { EventRole } from '@/modules/events/domain/Event';

/** Perfil de una persona dentro de un evento (puede no tener cuenta). */
export interface Participant {
  id: string;
  eventId: string;
  familyId: string | null;
  hasAccount: boolean;
  firstName: string;
  paternalSurname: string;
  maternalSurname: string | null;
  fullName: string;
  distinguishingNote: string | null;
}

/** Vista del organizador: incluye usuario, rol y tutores. */
export interface Member extends Participant {
  username: string | null;
  role: EventRole | null;
  guardianIds: string[];
  status: 'active' | 'removed';
}

/** Nombre a mostrar, con el dato que diferencia a homónimos. */
export function displayName(p: Pick<Participant, 'fullName' | 'distinguishingNote'>): string {
  return p.distinguishingNote ? `${p.fullName} (${p.distinguishingNote})` : p.fullName;
}
