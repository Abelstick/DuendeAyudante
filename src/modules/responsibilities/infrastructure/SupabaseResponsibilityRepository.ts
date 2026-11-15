import type { SupabaseClient } from '@supabase/supabase-js';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { IResponsibilityRepository } from '../domain/IResponsibilityRepository';
import type {
  Responsibility,
  ResponsibilityCategory,
  ResponsibilityKind,
  ResponsibilityStatus,
  SaveResponsibilityData,
} from '../domain/Responsibility';

interface Row {
  id: string;
  event_id: string;
  kind: ResponsibilityKind;
  category: ResponsibilityCategory;
  title: string;
  description: string | null;
  due_date: string | null;
  status: ResponsibilityStatus;
  notes: string | null;
  responsibility_assignees: { participant_id: string | null; family_id: string | null }[] | null;
}

export class SupabaseResponsibilityRepository implements IResponsibilityRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(eventId: string): Promise<Responsibility[]> {
    const { data, error } = await this.supabase
      .from('responsibilities')
      .select('id, event_id, kind, category, title, description, due_date, status, notes, responsibility_assignees(participant_id, family_id)')
      .eq('event_id', eventId)
      .order('sort_order')
      .order('created_at')
      .returns<Row[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((row) => {
      const assignees = row.responsibility_assignees ?? [];
      return {
        id: row.id,
        eventId: row.event_id,
        kind: row.kind,
        category: row.category,
        title: row.title,
        description: row.description,
        dueDate: row.due_date,
        status: row.status,
        notes: row.notes,
        participantIds: assignees.map((a) => a.participant_id).filter((x): x is string => Boolean(x)),
        familyIds: assignees.map((a) => a.family_id).filter((x): x is string => Boolean(x)),
      };
    });
  }

  async save(data: SaveResponsibilityData): Promise<string> {
    const { data: id, error } = await this.supabase.rpc('save_responsibility', {
      p_event_id: data.eventId,
      p_kind: data.kind,
      p_category: data.category,
      p_title: data.title,
      p_description: data.description,
      p_due_date: data.dueDate,
      p_status: data.status,
      p_notes: data.notes,
      p_participant_ids: data.participantIds,
      p_family_ids: data.familyIds,
      p_id: data.id,
    });
    if (error) throw fromPostgrestError(error);
    return id as string;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('responsibilities').delete().eq('id', id);
    if (error) throw fromPostgrestError(error);
  }

  async setStatus(id: string, status: ResponsibilityStatus): Promise<void> {
    const { error } = await this.supabase.rpc('set_responsibility_status', { p_id: id, p_status: status });
    if (error) throw fromPostgrestError(error);
  }
}
