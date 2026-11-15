/**
 * Recuerdos del año: un resumen de la celebración armado con lo que ya hay
 * en la app (no se guarda aparte; se puede ver cualquier año en Mis Navidades).
 */
import type { Expense } from '@/modules/expenses/domain/Expense';
import { totalSpent } from '@/modules/expenses/domain/Expense';
import type { Game, GameVote } from '@/modules/games/domain/Game';
import type { Participant } from '@/modules/members/domain/Participant';
import type { Responsibility } from '@/modules/responsibilities/domain/Responsibility';
import type { ScheduleItem } from '@/modules/schedule/domain/Schedule';
import type { WishlistItem } from '@/modules/wishlist/domain/WishlistItem';
import { toTitleCase } from '@/shared/validation/names';

export interface RecapInput {
  eventName: string;
  organizerName: string;
  participants: readonly Participant[];
  familyCount: number;
  wishes: readonly WishlistItem[];
  games: readonly Game[];
  votes: readonly GameVote[];
  responsibilities: readonly Responsibility[];
  schedule: readonly ScheduleItem[];
  announcementCount: number;
  expenses: readonly Expense[];
}

export interface Recap {
  people: number;
  families: number;
  gifts: number;
  /** Personas que agregaron al menos un regalo. */
  peopleWithGifts: number;
  /** El juego con más votos (o null si nadie votó). */
  topGame: { name: string; votes: number } | null;
  gamesProposed: number;
  gamesPlayed: string[];
  responsibilitiesDone: number;
  responsibilitiesTotal: number;
  /** Quienes más cumplieron (asignaciones directas completadas), hasta 3. */
  helpers: { name: string; done: number }[];
  activities: number;
  announcements: number;
  spent: number;
  organizer: string;
}

export function buildRecap(input: RecapInput): Recap {
  const activeGames = input.games.filter((g) => g.status !== 'merged');
  const votesByGame = new Map<string, number>();
  for (const v of input.votes) votesByGame.set(v.gameId, (votesByGame.get(v.gameId) ?? 0) + 1);
  const top = activeGames
    .map((g) => ({ name: g.name, votes: votesByGame.get(g.id) ?? 0 }))
    .filter((g) => g.votes > 0)
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'es'))[0];

  const done = input.responsibilities.filter((r) => r.status === 'done');
  const helperCount = new Map<string, number>();
  for (const r of done) for (const id of r.participantIds) helperCount.set(id, (helperCount.get(id) ?? 0) + 1);
  const helpers = [...helperCount.entries()]
    .map(([id, n]) => {
      const p = input.participants.find((x) => x.id === id);
      return p ? { name: toTitleCase(p.firstName), done: n } : null;
    })
    .filter((h): h is { name: string; done: number } => h !== null)
    .sort((a, b) => b.done - a.done || a.name.localeCompare(b.name, 'es'))
    .slice(0, 3);

  return {
    people: input.participants.length,
    families: input.familyCount,
    gifts: input.wishes.length,
    peopleWithGifts: new Set(input.wishes.map((w) => w.participantId)).size,
    topGame: top ?? null,
    gamesProposed: activeGames.length,
    gamesPlayed: activeGames.filter((g) => g.status === 'played').map((g) => g.name),
    responsibilitiesDone: done.length,
    responsibilitiesTotal: input.responsibilities.length,
    helpers,
    activities: input.schedule.filter((s) => s.status !== 'cancelled').length,
    announcements: input.announcementCount,
    spent: totalSpent(input.expenses),
    organizer: toTitleCase(input.organizerName),
  };
}

/** Texto para compartir los recuerdos por WhatsApp. */
export function recapShareText(recap: Recap, eventName: string, year: number, formatMoney: (n: number) => string): string {
  const lines = [
    `🎄 Recuerdos de «${eventName}» (${year})`,
    '',
    `👨‍👩‍👧‍👦 Fuimos ${recap.people} ${recap.people === 1 ? 'persona' : 'personas'}${recap.families > 0 ? ` de ${recap.families} ${recap.families === 1 ? 'familia' : 'familias'}` : ''}.`,
  ];
  if (recap.gifts > 0) lines.push(`🎁 Pedimos ${recap.gifts} ${recap.gifts === 1 ? 'regalo' : 'regalos'}.`);
  if (recap.topGame) lines.push(`🏆 El juego favorito: ${recap.topGame.name} (${recap.topGame.votes} ${recap.topGame.votes === 1 ? 'voto' : 'votos'}).`);
  if (recap.responsibilitiesTotal > 0) lines.push(`✅ Cumplimos ${recap.responsibilitiesDone} de ${recap.responsibilitiesTotal} aportes y tareas.`);
  if (recap.helpers.length > 0) lines.push(`💪 Gracias especiales a: ${recap.helpers.map((h) => h.name).join(', ')}.`);
  if (recap.spent > 0) lines.push(`🧾 Entre todos pusimos ${formatMoney(recap.spent)}.`);
  lines.push(`⭐ Organizó: ${recap.organizer}.`, '', '¡Gracias por una Navidad tan bonita! ❤️');
  return lines.join('\n');
}
