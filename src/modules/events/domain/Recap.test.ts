import { describe, expect, it } from 'vitest';
import type { Expense } from '@/modules/expenses/domain/Expense';
import type { Game } from '@/modules/games/domain/Game';
import type { Participant } from '@/modules/members/domain/Participant';
import type { Responsibility } from '@/modules/responsibilities/domain/Responsibility';
import type { WishlistItem } from '@/modules/wishlist/domain/WishlistItem';
import { buildRecap, recapShareText } from './Recap';

const person = (id: string, firstName: string): Participant => ({
  id,
  eventId: 'e',
  familyId: null,
  hasAccount: true,
  firstName,
  paternalSurname: 'GARCÍA',
  maternalSurname: null,
  fullName: `${firstName} GARCÍA`,
  distinguishingNote: null,
});

const game = (id: string, name: string, status: Game['status'] = 'active'): Game => ({
  id,
  eventId: 'e',
  name,
  category: 'competition',
  description: null,
  durationMinutes: null,
  minPlayers: null,
  maxPlayers: null,
  materials: null,
  instructions: null,
  status,
  mergedIntoId: null,
  proposedById: null,
  responsibleId: null,
});

const resp = (id: string, status: Responsibility['status'], participantIds: string[]): Responsibility => ({
  id,
  eventId: 'e',
  kind: 'contribution',
  category: 'food',
  title: id,
  description: null,
  dueDate: null,
  status,
  notes: null,
  participantIds,
  familyIds: [],
});

describe('recuerdos del año', () => {
  const recap = buildRecap({
    eventName: 'Navidad García',
    organizerName: 'ABEL PÉREZ',
    participants: [person('rosa', 'ROSA'), person('juan', 'JUAN'), person('ana', 'ANA')],
    familyCount: 2,
    wishes: [{ participantId: 'rosa' }, { participantId: 'rosa' }, { participantId: 'juan' }] as WishlistItem[],
    games: [game('g1', 'Charadas', 'played'), game('g2', 'Bingo'), game('g3', 'Mímica', 'merged')],
    votes: [
      { gameId: 'g2', participantId: 'rosa' },
      { gameId: 'g1', participantId: 'juan' },
      { gameId: 'g2', participantId: 'ana' },
    ],
    responsibilities: [resp('pavo', 'done', ['rosa']), resp('postre', 'done', ['rosa', 'juan']), resp('luces', 'pending', ['ana'])],
    schedule: [],
    announcementCount: 4,
    expenses: [{ kind: 'expense', amount: 100 } as Expense, { kind: 'payment', amount: 30 } as Expense],
  });

  it('resume la celebración', () => {
    expect(recap).toMatchObject({
      people: 3,
      families: 2,
      gifts: 3,
      peopleWithGifts: 2,
      topGame: { name: 'Bingo', votes: 2 },
      gamesProposed: 2,
      gamesPlayed: ['Charadas'],
      responsibilitiesDone: 2,
      responsibilitiesTotal: 3,
      helpers: [
        { name: 'Rosa', done: 2 },
        { name: 'Juan', done: 1 },
      ],
      announcements: 4,
      spent: 100,
      organizer: 'Abel Pérez',
    });
  });

  it('arma el texto para compartir', () => {
    const text = recapShareText(recap, 'Navidad García', 2026, (n) => `S/ ${n}`);
    expect(text).toContain('Recuerdos de «Navidad García» (2026)');
    expect(text).toContain('🏆 El juego favorito: Bingo (2 votos).');
    expect(text).toContain('Entre todos pusimos S/ 100.');
  });
});
