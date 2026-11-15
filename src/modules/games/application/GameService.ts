import { AppError } from '@/shared/domain/errors';
import { type GameFields, type GameStatus, gameNameKey, type MergeGamesData, type PollStatus, type SaveGameData } from '../domain/Game';
import type { IGameRepository } from '../domain/IGameRepository';

function cleanFields<T extends GameFields>(data: T): T {
  const name = data.name.trim().replace(/\s+/g, ' ');
  if (!gameNameKey(name) || name.length > 100) throw new AppError('GAME_NAME_INVALID');
  const { minPlayers, maxPlayers, durationMinutes } = data;
  if (minPlayers !== null && maxPlayers !== null && minPlayers > maxPlayers) throw new AppError('PLAYERS_RANGE_INVALID');
  for (const n of [minPlayers, maxPlayers, durationMinutes]) {
    if (n !== null && (!Number.isInteger(n) || n < 1)) throw new AppError('NUMBER_INVALID');
  }
  return {
    ...data,
    name,
    description: data.description?.trim() || null,
    materials: data.materials?.trim() || null,
    instructions: data.instructions?.trim() || null,
  };
}

export class GameService {
  constructor(private readonly games: IGameRepository) {}

  list(eventId: string) {
    return this.games.list(eventId);
  }

  getPoll(eventId: string) {
    return this.games.getPoll(eventId);
  }

  listVotes(eventId: string) {
    return this.games.listVotes(eventId);
  }

  async save(data: SaveGameData) {
    return this.games.save(cleanFields(data));
  }

  setStatus(id: string, status: Exclude<GameStatus, 'merged'>) {
    return this.games.setStatus(id, status);
  }

  remove(id: string) {
    return this.games.remove(id);
  }

  async merge(data: MergeGamesData): Promise<string> {
    if (new Set(data.gameIds).size < 2) throw new AppError('MERGE_NEEDS_TWO_GAMES');
    if (data.targetId === null && !data.fields) throw new AppError('GAME_NAME_INVALID');
    return this.games.merge({ ...data, fields: data.fields ? cleanFields(data.fields) : null });
  }

  setPoll(eventId: string, status: PollStatus, maxVotes: number | null = null) {
    return this.games.setPoll(eventId, status, maxVotes);
  }

  vote(gameId: string, participantId: string) {
    return this.games.vote(gameId, participantId);
  }

  unvote(gameId: string, participantId: string) {
    return this.games.unvote(gameId, participantId);
  }
}
