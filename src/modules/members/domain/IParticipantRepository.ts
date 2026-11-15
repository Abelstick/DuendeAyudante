import type { Member, Participant } from './Participant';

/** Datos que el organizador puede corregir de un familiar (el usuario y la contraseña van aparte). */
export interface ParticipantDetails {
  firstName: string;
  paternalSurname: string;
  maternalSurname: string | null;
  distinguishingNote: string | null;
  familyId: string | null;
}

export interface IParticipantRepository {
  /** Integrantes activos del evento (lo que ve cualquier miembro). */
  listActive(eventId: string): Promise<Participant[]>;
  /** Integrantes con usuario, rol y tutores (solo organizador/administradores). */
  listMembers(eventId: string): Promise<Member[]>;
  updateFamily(participantId: string, familyId: string | null): Promise<void>;
  updateDetails(participantId: string, details: ParticipantDetails): Promise<void>;
}
