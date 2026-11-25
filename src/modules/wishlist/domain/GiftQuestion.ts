/**
 * Pregunta anónima sobre un regalo ("¿qué talla?"). Nunca se sabe quién la hizo:
 * solo quien preguntó ve `isMine` en sus propias preguntas.
 */
export interface GiftQuestion {
  id: string;
  itemId: string;
  question: string;
  answer: string | null;
  createdAt: Date;
  answeredAt: Date | null;
  /** La hice yo (solo yo lo sé). */
  isMine: boolean;
  /** Es mía, ya la respondieron y todavía no vi la respuesta. */
  answerUnseen: boolean;
}

export const MAX_QUESTION_LENGTH = 300;
export const MAX_ANSWER_LENGTH = 500;

export interface IGiftQuestionRepository {
  listByEvent(eventId: string): Promise<GiftQuestion[]>;
  ask(itemId: string, question: string): Promise<void>;
  answer(questionId: string, answer: string): Promise<void>;
  remove(questionId: string): Promise<void>;
  /** Quien preguntó ya vio las respuestas de este regalo. */
  markAnswersSeen(itemId: string): Promise<void>;
}

/** Cuántas preguntas siguen sin respuesta en estos regalos. */
export function countPending(questions: GiftQuestion[], itemIds: ReadonlySet<string>): number {
  return questions.filter((q) => q.answer === null && itemIds.has(q.itemId)).length;
}

export interface QuestionStats {
  /** Preguntas hechas en total. */
  total: number;
  /** Las que siguen sin respuesta. */
  pending: number;
}

/**
 * Cuántas preguntas tiene cada persona en sus regalos (clave: id de la persona).
 * `ownerOf` dice de quién es cada regalo; las preguntas de regalos que ya no existen se ignoran.
 */
export function questionStatsByOwner(questions: GiftQuestion[], ownerOf: ReadonlyMap<string, string>): Map<string, QuestionStats> {
  const stats = new Map<string, QuestionStats>();
  for (const q of questions) {
    const owner = ownerOf.get(q.itemId);
    if (!owner) continue;
    const s = stats.get(owner) ?? { total: 0, pending: 0 };
    s.total += 1;
    if (q.answer === null) s.pending += 1;
    stats.set(owner, s);
  }
  return stats;
}

/** Suma las estadísticas de varias personas. */
export function sumStats(stats: Iterable<QuestionStats>): QuestionStats {
  let total = 0;
  let pending = 0;
  for (const s of stats) {
    total += s.total;
    pending += s.pending;
  }
  return { total, pending };
}

/** Regalos donde respondieron una pregunta mía que todavía no vi. */
export function itemsWithNewAnswers(questions: GiftQuestion[]): string[] {
  return [...new Set(questions.filter((q) => q.answerUnseen).map((q) => q.itemId))];
}
