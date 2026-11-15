import type { Participant } from '../domain/Participant';

export interface ParticipantRow {
  id: string;
  event_id: string;
  family_id: string | null;
  user_id: string | null;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  full_name: string;
  distinguishing_note: string | null;
}

export const PARTICIPANT_COLUMNS =
  'id, event_id, family_id, user_id, first_name, paternal_surname, maternal_surname, full_name, distinguishing_note';

export function mapParticipantRow(row: ParticipantRow): Participant {
  return {
    id: row.id,
    eventId: row.event_id,
    familyId: row.family_id,
    hasAccount: row.user_id !== null,
    firstName: row.first_name,
    paternalSurname: row.paternal_surname,
    maternalSurname: row.maternal_surname,
    fullName: row.full_name,
    distinguishingNote: row.distinguishing_note,
  };
}
