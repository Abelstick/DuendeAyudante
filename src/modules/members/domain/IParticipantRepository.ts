import type { Member, Participant } from './Participant';

export interface IParticipantRepository {
  /** Integrantes activos del evento (lo que ve cualquier miembro). */
  listActive(eventId: string): Promise<Participant[]>;
  /** Integrantes con usuario, rol y tutores (solo organizador/administradores). */
  listMembers(eventId: string): Promise<Member[]>;
  updateFamily(participantId: string, familyId: string | null): Promise<void>;
}
