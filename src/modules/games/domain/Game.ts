export type GameCategory = 'competition' | 'family_bonding' | 'board' | 'movement' | 'trivia_challenges' | 'kids' | 'adults';
export type GameStatus = 'active' | 'merged' | 'played';
export type PollStatus = 'draft' | 'open' | 'closed';

export interface Game {
  id: string;
  eventId: string;
  name: string;
  category: GameCategory;
  description: string | null;
  durationMinutes: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  materials: string | null;
  instructions: string | null;
  status: GameStatus;
  mergedIntoId: string | null;
  proposedById: string | null;
  responsibleId: string | null;
}

export interface GamePoll {
  status: PollStatus;
  maxVotes: number;
}

export interface GameVote {
  gameId: string;
  participantId: string;
}

export interface GameFields {
  name: string;
  category: GameCategory;
  description: string | null;
  durationMinutes: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  materials: string | null;
  instructions: string | null;
  responsibleId: string | null;
}

export interface SaveGameData extends GameFields {
  id: string | null;
  eventId: string;
  /** Quién propone (uno mismo o alguien a cargo). */
  proposedById: string | null;
}

export interface MergeGamesData {
  eventId: string;
  gameIds: string[];
  /** Juego que se conserva; null = crear uno nuevo con `fields`. */
  targetId: string | null;
  fields: GameFields | null;
}

export const CATEGORY_LABELS: Record<GameCategory, { emoji: string; label: string }> = {
  family_bonding: { emoji: '🤗', label: 'Integración familiar' },
  competition: { emoji: '🏆', label: 'Competencia' },
  board: { emoji: '🎲', label: 'Juegos de mesa' },
  movement: { emoji: '🏃', label: 'Movimiento' },
  trivia_challenges: { emoji: '❓', label: 'Preguntas y desafíos' },
  kids: { emoji: '🧒', label: 'Para niños' },
  adults: { emoji: '🧑', label: 'Para adultos' },
};

/** Igual que app.normalize_game_name en la base: "Charadas  Navideñas!" → "CHARADAS NAVIDENAS". */
export function gameNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

const STOPWORDS = new Set(['DE', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'EN', 'DEL', 'UN', 'UNA', 'JUEGO', 'JUEGOS', 'CON', 'A']);

function words(key: string): string[] {
  return key.split(' ').filter((w) => w && !STOPWORDS.has(w));
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** ¿Los nombres se parecen? (mismo nombre, uno contiene al otro, pocas letras de diferencia o palabras en común). */
export function areNamesSimilar(a: string, b: string): boolean {
  const ka = gameNameKey(a);
  const kb = gameNameKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const wa = words(ka).join(' ');
  const wb = words(kb).join(' ');
  if (wa.length >= 4 && wb.length >= 4 && (wa.includes(wb) || wb.includes(wa))) return true;
  if (Math.min(wa.length, wb.length) >= 5 && levenshtein(wa, wb) <= 2) return true;
  const sa = new Set(words(ka));
  const sb = new Set(words(kb));
  const common = [...sa].filter((w) => sb.has(w)).length;
  return common > 0 && common / Math.min(sa.size, sb.size) >= 0.6;
}

/** Juegos vigentes cuyo nombre se parece al que se está escribiendo. */
export function findSimilarGames(name: string, games: Game[], exceptId?: string | null): Game[] {
  if (gameNameKey(name).length < 3) return [];
  return games.filter((g) => g.status !== 'merged' && g.id !== exceptId && areNamesSimilar(name, g.name));
}

/** Quiénes tuvieron la idea: quien propuso + quienes propusieron los juegos que se unieron en este. */
export function gameCredits(game: Game, all: Game[]): string[] {
  const result = new Set<string>();
  const visit = (g: Game, depth: number) => {
    if (g.proposedById) result.add(g.proposedById);
    if (depth > 10) return;
    for (const child of all.filter((x) => x.mergedIntoId === g.id)) visit(child, depth + 1);
  };
  visit(game, 0);
  return [...result];
}

export interface RankedGame {
  game: Game;
  votes: number;
  /** % de las personas que votaron que eligieron este juego. */
  percent: number;
}

export function rankGames(games: Game[], votes: GameVote[]): RankedGame[] {
  const voters = new Set(votes.map((v) => v.participantId)).size;
  return games
    .map((game) => {
      const n = votes.filter((v) => v.gameId === game.id).length;
      return { game, votes: n, percent: voters ? Math.round((n / voters) * 100) : 0 };
    })
    .sort((a, b) => b.votes - a.votes || a.game.name.localeCompare(b.game.name, 'es'));
}

/** Elige un juego al azar (para la ruleta). */
export function pickRandomGame(games: Game[], random: () => number = Math.random): Game | null {
  if (games.length === 0) return null;
  return games[Math.floor(random() * games.length)] ?? null;
}
