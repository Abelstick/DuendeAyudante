import { describe, expect, it } from 'vitest';
import { areNamesSimilar, findSimilarGames, type Game, gameCredits, gameNameKey, pickRandomGame, rankGames } from './Game';

const game = (id: string, name: string, over: Partial<Game> = {}): Game => ({
  id,
  eventId: 'e',
  name,
  category: 'family_bonding',
  description: null,
  durationMinutes: null,
  minPlayers: null,
  maxPlayers: null,
  materials: null,
  instructions: null,
  status: 'active',
  mergedIntoId: null,
  proposedById: null,
  responsibleId: null,
  ...over,
});

describe('nombres de juegos', () => {
  it('normaliza igual que la base de datos', () => {
    expect(gameNameKey('  Charadas   Navideñas! ')).toBe('CHARADAS NAVIDENAS');
  });

  it.each([
    ['Charadas', 'charadas navideñas'],
    ['Las sillas musicales', 'Sillas musicales'],
    ['Amigo secreto', 'Amigo secrteo'],
    ['Juego de la papa caliente', 'Papa caliente'],
  ])('%j se parece a %j', (a, b) => {
    expect(areNamesSimilar(a, b)).toBe(true);
  });

  it.each([
    ['Bingo', 'Charadas'],
    ['Sillas musicales', 'Bingo navideño'],
  ])('%j NO se parece a %j', (a, b) => {
    expect(areNamesSimilar(a, b)).toBe(false);
  });

  it('busca parecidos solo entre juegos vigentes y excluye el que se está editando', () => {
    const games = [game('1', 'Charadas'), game('2', 'Charadas viejas', { status: 'merged' }), game('3', 'Bingo')];
    expect(findSimilarGames('charadas navideñas', games).map((g) => g.id)).toEqual(['1']);
    expect(findSimilarGames('Charadas', games, '1')).toEqual([]);
  });
});

describe('unir juegos', () => {
  it('reconoce a todos los que tuvieron la idea, aunque se haya unido varias veces', () => {
    const z = game('z', 'Charadas y mímica', { proposedById: null });
    const all = [
      z,
      game('x', 'Charadas', { status: 'merged', mergedIntoId: 'z', proposedById: 'rosa' }),
      game('y', 'Mímica', { status: 'merged', mergedIntoId: 'z', proposedById: 'juan' }),
      game('w', 'Mimica antigua', { status: 'merged', mergedIntoId: 'y', proposedById: 'ana' }),
    ];
    expect(gameCredits(z, all).sort()).toEqual(['ana', 'juan', 'rosa']);
  });
});

describe('ranking y ruleta', () => {
  it('ordena por votos y calcula el % sobre las personas que votaron', () => {
    const games = [game('a', 'Bingo'), game('b', 'Charadas'), game('c', 'Sillas')];
    const votes = [
      { gameId: 'b', participantId: 'p1' },
      { gameId: 'b', participantId: 'p2' },
      { gameId: 'a', participantId: 'p1' },
    ];
    expect(rankGames(games, votes).map((r) => [r.game.id, r.votes, r.percent])).toEqual([
      ['b', 2, 100],
      ['a', 1, 50],
      ['c', 0, 0],
    ]);
  });

  it('la ruleta elige uno de la lista', () => {
    const games = [game('a', 'A'), game('b', 'B')];
    expect(pickRandomGame(games, () => 0.99)?.id).toBe('b');
    expect(pickRandomGame([], () => 0.5)).toBeNull();
  });
});
