import type { SupabaseClient } from '@supabase/supabase-js';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { Game, GameCategory, GameFields, GamePoll, GameStatus, GameVote, MergeGamesData, PollStatus, SaveGameData } from '../domain/Game';
import type { IGameRepository } from '../domain/IGameRepository';

interface GameRow {
  id: string;
  event_id: string;
  name: string;
  category: GameCategory;
  description: string | null;
  duration_minutes: number | null;
  min_players: number | null;
  max_players: number | null;
  materials: string | null;
  instructions: string | null;
  status: GameStatus;
  merged_into_game_id: string | null;
  proposed_by_participant_id: string | null;
  responsible_participant_id: string | null;
}

const toRow = (f: GameFields) => ({
  name: f.name,
  category: f.category,
  description: f.description,
  duration_minutes: f.durationMinutes,
  min_players: f.minPlayers,
  max_players: f.maxPlayers,
  materials: f.materials,
  instructions: f.instructions,
  responsible_participant_id: f.responsibleId,
});

export class SupabaseGameRepository implements IGameRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(eventId: string): Promise<Game[]> {
    const { data, error } = await this.supabase
      .from('games')
      .select(
        'id, event_id, name, category, description, duration_minutes, min_players, max_players, materials, instructions, status, merged_into_game_id, proposed_by_participant_id, responsible_participant_id',
      )
      .eq('event_id', eventId)
      .order('created_at')
      .returns<GameRow[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((r) => ({
      id: r.id,
      eventId: r.event_id,
      name: r.name,
      category: r.category,
      description: r.description,
      durationMinutes: r.duration_minutes,
      minPlayers: r.min_players,
      maxPlayers: r.max_players,
      materials: r.materials,
      instructions: r.instructions,
      status: r.status,
      mergedIntoId: r.merged_into_game_id,
      proposedById: r.proposed_by_participant_id,
      responsibleId: r.responsible_participant_id,
    }));
  }

  async getPoll(eventId: string): Promise<GamePoll | null> {
    const { data, error } = await this.supabase
      .from('game_polls')
      .select('status, max_votes')
      .eq('event_id', eventId)
      .maybeSingle<{ status: PollStatus; max_votes: number }>();
    if (error) throw fromPostgrestError(error);
    return data ? { status: data.status, maxVotes: data.max_votes } : null;
  }

  async listVotes(eventId: string): Promise<GameVote[]> {
    const { data, error } = await this.supabase
      .from('game_votes')
      .select('game_id, participant_id, game_polls!inner(event_id)')
      .eq('game_polls.event_id', eventId)
      .returns<{ game_id: string; participant_id: string }[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((v) => ({ gameId: v.game_id, participantId: v.participant_id }));
  }

  async save(data: SaveGameData): Promise<void> {
    const { error } = data.id
      ? await this.supabase.from('games').update(toRow(data)).eq('id', data.id)
      : await this.supabase.from('games').insert({ ...toRow(data), event_id: data.eventId, proposed_by_participant_id: data.proposedById });
    if (error) throw fromPostgrestError(error);
  }

  async setStatus(id: string, status: Exclude<GameStatus, 'merged'>): Promise<void> {
    const { error } = await this.supabase.from('games').update({ status }).eq('id', id);
    if (error) throw fromPostgrestError(error);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('games').delete().eq('id', id);
    if (error) throw fromPostgrestError(error);
  }

  async merge({ eventId, gameIds, targetId, fields }: MergeGamesData): Promise<string> {
    const { data, error } = await this.supabase.rpc('merge_games', {
      p_event_id: eventId,
      p_game_ids: gameIds,
      p_target_id: targetId,
      p_name: fields?.name ?? null,
      p_category: fields?.category ?? null,
      p_description: fields?.description ?? null,
      p_duration_minutes: fields?.durationMinutes ?? null,
      p_min_players: fields?.minPlayers ?? null,
      p_max_players: fields?.maxPlayers ?? null,
      p_materials: fields?.materials ?? null,
      p_instructions: fields?.instructions ?? null,
      p_responsible_id: fields?.responsibleId ?? null,
    });
    if (error) throw fromPostgrestError(error);
    return data as string;
  }

  async setPoll(eventId: string, status: PollStatus, maxVotes: number | null): Promise<void> {
    const { error } = await this.supabase.rpc('set_game_poll', { p_event_id: eventId, p_status: status, p_max_votes: maxVotes });
    if (error) throw fromPostgrestError(error);
  }

  async vote(gameId: string, participantId: string): Promise<void> {
    const { error } = await this.supabase.rpc('cast_game_vote', { p_game_id: gameId, p_participant_id: participantId });
    if (error) throw fromPostgrestError(error);
  }

  async unvote(gameId: string, participantId: string): Promise<void> {
    const { error } = await this.supabase.rpc('remove_game_vote', { p_game_id: gameId, p_participant_id: participantId });
    if (error) throw fromPostgrestError(error);
  }
}
