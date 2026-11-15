import type { SupabaseClient } from '@supabase/supabase-js';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { ISecretFriendRepository, SecretFriendNote } from '../domain/SecretFriend';

export class SupabaseSecretFriendRepository implements ISecretFriendRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listMine(eventId: string): Promise<SecretFriendNote[]> {
    const { data, error } = await this.supabase
      .from('secret_friend_notes')
      .select('giver_participant_id, receiver_participant_id')
      .eq('event_id', eventId)
      .returns<{ giver_participant_id: string; receiver_participant_id: string }[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((r) => ({ giverId: r.giver_participant_id, receiverId: r.receiver_participant_id }));
  }

  async set(eventId: string, giverId: string, receiverId: string): Promise<void> {
    // Primero intenta cambiarlo; si no existía, lo crea.
    const { data, error } = await this.supabase
      .from('secret_friend_notes')
      .update({ receiver_participant_id: receiverId })
      .eq('giver_participant_id', giverId)
      .select('giver_participant_id');
    if (error) throw fromPostgrestError(error);
    if (data && data.length > 0) return;

    const { error: insertError } = await this.supabase
      .from('secret_friend_notes')
      .insert({ event_id: eventId, giver_participant_id: giverId, receiver_participant_id: receiverId });
    if (insertError) throw fromPostgrestError(insertError);
  }

  async clear(giverId: string): Promise<void> {
    const { error } = await this.supabase.from('secret_friend_notes').delete().eq('giver_participant_id', giverId);
    if (error) throw fromPostgrestError(error);
  }
}
