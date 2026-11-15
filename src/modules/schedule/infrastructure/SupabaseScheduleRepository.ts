import type { SupabaseClient } from '@supabase/supabase-js';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { IScheduleRepository, SaveScheduleData, ScheduleItem, ScheduleStatus } from '../domain/Schedule';

interface Row {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  responsible_participant_id: string | null;
  status: ScheduleStatus;
}

export class SupabaseScheduleRepository implements IScheduleRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(eventId: string): Promise<ScheduleItem[]> {
    const { data, error } = await this.supabase
      .from('schedule_items')
      .select('id, event_id, title, description, starts_at, ends_at, responsible_participant_id, status')
      .eq('event_id', eventId)
      .order('starts_at')
      .returns<Row[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((r) => ({
      id: r.id,
      eventId: r.event_id,
      title: r.title,
      description: r.description,
      startsAt: new Date(r.starts_at),
      endsAt: r.ends_at ? new Date(r.ends_at) : null,
      responsibleId: r.responsible_participant_id,
      status: r.status,
    }));
  }

  async save(d: SaveScheduleData): Promise<void> {
    const row = {
      title: d.title,
      description: d.description,
      starts_at: d.startsAt.toISOString(),
      ends_at: d.endsAt?.toISOString() ?? null,
      responsible_participant_id: d.responsibleId,
      status: d.status,
    };
    const { error } = d.id
      ? await this.supabase.from('schedule_items').update(row).eq('id', d.id)
      : await this.supabase.from('schedule_items').insert({ ...row, event_id: d.eventId });
    if (error) throw fromPostgrestError(error);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('schedule_items').delete().eq('id', id);
    if (error) throw fromPostgrestError(error);
  }
}
