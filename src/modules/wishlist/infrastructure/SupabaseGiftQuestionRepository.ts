import type { SupabaseClient } from '@supabase/supabase-js';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { GiftQuestion, IGiftQuestionRepository } from '../domain/GiftQuestion';

interface QuestionRow {
  id: string;
  item_id: string;
  question: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
  is_mine: boolean;
  answer_unseen: boolean;
}

/** Todo pasa por RPC: la tabla no se puede leer directamente, así nunca viaja quién preguntó. */
export class SupabaseGiftQuestionRepository implements IGiftQuestionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByEvent(eventId: string): Promise<GiftQuestion[]> {
    const { data, error } = await this.supabase.rpc('list_wishlist_questions', { p_event_id: eventId });
    if (error) throw fromPostgrestError(error);
    return ((data ?? []) as QuestionRow[]).map((r) => ({
      id: r.id,
      itemId: r.item_id,
      question: r.question,
      answer: r.answer,
      createdAt: new Date(r.created_at),
      answeredAt: r.answered_at ? new Date(r.answered_at) : null,
      isMine: r.is_mine,
      answerUnseen: r.answer_unseen,
    }));
  }

  async ask(itemId: string, question: string): Promise<void> {
    const { error } = await this.supabase.rpc('ask_wishlist_question', { p_item_id: itemId, p_question: question });
    if (error) throw fromPostgrestError(error);
  }

  async answer(questionId: string, answer: string): Promise<void> {
    const { error } = await this.supabase.rpc('answer_wishlist_question', { p_question_id: questionId, p_answer: answer });
    if (error) throw fromPostgrestError(error);
  }

  async remove(questionId: string): Promise<void> {
    const { error } = await this.supabase.rpc('delete_wishlist_question', { p_question_id: questionId });
    if (error) throw fromPostgrestError(error);
  }

  async markAnswersSeen(itemId: string): Promise<void> {
    const { error } = await this.supabase.rpc('mark_wishlist_answers_seen', { p_item_id: itemId });
    if (error) throw fromPostgrestError(error);
  }
}
