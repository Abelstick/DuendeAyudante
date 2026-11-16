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

/** Regalos donde respondieron una pregunta mía que todavía no vi. */
export function itemsWithNewAnswers(questions: GiftQuestion[]): string[] {
  return [...new Set(questions.filter((q) => q.answerUnseen).map((q) => q.itemId))];
}
