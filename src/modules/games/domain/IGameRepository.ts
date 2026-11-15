import type { Game, GamePoll, GameStatus, GameVote, MergeGamesData, PollStatus, SaveGameData } from './Game';

export interface IGameRepository {
  /** Todos los juegos del evento (incluye unidos y jugados). */
  list(eventId: string): Promise<Game[]>;
  getPoll(eventId: string): Promise<GamePoll | null>;
  listVotes(eventId: string): Promise<GameVote[]>;
  save(data: SaveGameData): Promise<void>;
  setStatus(id: string, status: Exclude<GameStatus, 'merged'>): Promise<void>;
  remove(id: string): Promise<void>;
  merge(data: MergeGamesData): Promise<string>;
  setPoll(eventId: string, status: PollStatus, maxVotes: number | null): Promise<void>;
  vote(gameId: string, participantId: string): Promise<void>;
  unvote(gameId: string, participantId: string): Promise<void>;
}
