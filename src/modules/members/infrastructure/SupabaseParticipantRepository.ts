import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventRole } from '@/modules/events/domain/Event';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { IParticipantRepository, ParticipantDetails } from '../domain/IParticipantRepository';
import type { Member, Participant } from '../domain/Participant';
import { mapParticipantRow, PARTICIPANT_COLUMNS, type ParticipantRow } from './mappers';

interface MemberRow {
  participant_id: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  full_name: string;
  distinguishing_note: string | null;
  family_id: string | null;
  status: 'active' | 'removed';
  user_id: string | null;
  username: string | null;
  role: EventRole | null;
  guardian_ids: string[] | null;
}

export class SupabaseParticipantRepository implements IParticipantRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listActive(eventId: string): Promise<Participant[]> {
    const { data, error } = await this.supabase
      .from('participants')
      .select(PARTICIPANT_COLUMNS)
      .eq('event_id', eventId)
      .eq('status', 'active')
      .order('full_name')
      .returns<ParticipantRow[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map(mapParticipantRow);
  }

  async listMembers(eventId: string): Promise<Member[]> {
    const { data, error } = await this.supabase.rpc('list_event_members', { p_event_id: eventId });
    if (error) throw fromPostgrestError(error);
    return ((data ?? []) as MemberRow[]).map((r) => ({
      id: r.participant_id,
      eventId,
      familyId: r.family_id,
      hasAccount: r.user_id !== null,
      firstName: r.first_name,
      paternalSurname: r.paternal_surname,
      maternalSurname: r.maternal_surname,
      fullName: r.full_name,
      distinguishingNote: r.distinguishing_note,
      username: r.username,
      role: r.role,
      guardianIds: r.guardian_ids ?? [],
      status: r.status,
    }));
  }

  async updateFamily(participantId: string, familyId: string | null): Promise<void> {
    const { error } = await this.supabase.from('participants').update({ family_id: familyId }).eq('id', participantId);
    if (error) throw fromPostgrestError(error);
  }

  async updateDetails(participantId: string, d: ParticipantDetails): Promise<void> {
    // El trigger participants_before_write normaliza (mayúsculas, espacios) y valida los nombres
    const { error } = await this.supabase
      .from('participants')
      .update({
        first_name: d.firstName,
        paternal_surname: d.paternalSurname,
        maternal_surname: d.maternalSurname,
        distinguishing_note: d.distinguishingNote,
        family_id: d.familyId,
      })
      .eq('id', participantId);
    if (error) throw fromPostgrestError(error);
  }
}
