import { AppError } from '@/shared/domain/errors';
import { MAX_ANSWER_LENGTH, MAX_QUESTION_LENGTH, type GiftQuestion, type IGiftQuestionRepository } from '../domain/GiftQuestion';

/** Preguntas anónimas sobre los regalos y sus respuestas. */
export class GiftQuestionService {
  constructor(private readonly questions: IGiftQuestionRepository) {}

  listByEvent(eventId: string): Promise<GiftQuestion[]> {
    return this.questions.listByEvent(eventId);
  }

  ask(itemId: string, question: string): Promise<void> {
    const text = question.trim();
    if (!text || text.length > MAX_QUESTION_LENGTH) throw new AppError('QUESTION_INVALID');
    return this.questions.ask(itemId, text);
  }

  answer(questionId: string, answer: string): Promise<void> {
    const text = answer.trim();
    if (!text || text.length > MAX_ANSWER_LENGTH) throw new AppError('ANSWER_INVALID');
    return this.questions.answer(questionId, text);
  }

  remove(questionId: string): Promise<void> {
    return this.questions.remove(questionId);
  }

  markAnswersSeen(itemId: string): Promise<void> {
    return this.questions.markAnswersSeen(itemId);
  }
}
