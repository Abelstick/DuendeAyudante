import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/shared/domain/errors';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { IMessageRepository } from '../application/MessageService';
import type { ReceivedMessage, SaveMessageData, SentMessage } from '../domain/HolidayMessage';

interface SentRow {
  id: string;
  event_id: string;
  from_participant_id: string;
  to_participant_id: string;
  body: string;
  anonymous: boolean;
  created_at: string;
}

interface ReceivedRow {
  id: string;
  to_participant_id: string;
  from_name: string | null;
  body: string | null;
  created_at: string;
  unlock_at: string;
  unlocked: boolean;
}

export class SupabaseMessageRepository implements IMessageRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listSent(eventId: string): Promise<SentMessage[]> {
    const { data, error } = await this.supabase
      .from('holiday_messages')
      .select('id, event_id, from_participant_id, to_participant_id, body, anonymous, created_at')
      .eq('event_id', eventId)
      .order('created_at')
      .returns<SentRow[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((r) => ({
      id: r.id,
      eventId: r.event_id,
      fromId: r.from_participant_id,
      toId: r.to_participant_id,
      body: r.body,
      anonymous: r.anonymous,
      createdAt: new Date(r.created_at),
    }));
  }

  async listReceived(eventId: string): Promise<ReceivedMessage[]> {
    const { data, error } = await this.supabase.rpc('list_received_messages', { p_event_id: eventId });
    if (error) throw fromPostgrestError(error);
    return ((data ?? []) as ReceivedRow[]).map((r) => ({
      id: r.id,
      toId: r.to_participant_id,
      fromName: r.from_name,
      body: r.body,
      createdAt: new Date(r.created_at),
      unlockAt: new Date(r.unlock_at),
      unlocked: r.unlocked,
    }));
  }

  async save(data: SaveMessageData): Promise<void> {
    if (data.id) {
      const { data: rows, error } = await this.supabase
        .from('holiday_messages')
        .update({ to_participant_id: data.toId, body: data.body, anonymous: data.anonymous })
        .eq('id', data.id)
        .select('id');
      if (error) throw fromPostgrestError(error);
      if (!rows || rows.length === 0) throw new AppError('FORBIDDEN');
      return;
    }
    const { error } = await this.supabase.from('holiday_messages').insert({
      event_id: data.eventId,
      from_participant_id: data.fromId,
      to_participant_id: data.toId,
      body: data.body,
      anonymous: data.anonymous,
    });
    if (error) throw fromPostgrestError(error);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('holiday_messages').delete().eq('id', id);
    if (error) throw fromPostgrestError(error);
  }
}
