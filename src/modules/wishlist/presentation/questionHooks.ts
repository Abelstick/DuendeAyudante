import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useServices } from '@/app/ContainerContext';
import { questionStatsByOwner, type QuestionStats } from '../domain/GiftQuestion';
import { useEventWishlist } from './hooks';

export const giftQuestionKeys = { event: (eventId: string) => ['wishlist-questions', eventId] as const };

/** Preguntas (anónimas) y respuestas de todos los regalos de la celebración. */
export function useGiftQuestions(eventId: string) {
  const { giftQuestions } = useServices();
  return useQuery({ queryKey: giftQuestionKeys.event(eventId), queryFn: () => giftQuestions.listByEvent(eventId) });
}

const EMPTY_STATS = new Map<string, QuestionStats>();

/** Cuántas preguntas (y cuántas sin responder) tiene cada persona en sus regalos. */
export function useQuestionStats(eventId: string): Map<string, QuestionStats> {
  const questions = useGiftQuestions(eventId);
  const wishlist = useEventWishlist(eventId);
  return useMemo(() => {
    if (!questions.data || !wishlist.data) return EMPTY_STATS;
    return questionStatsByOwner(questions.data, new Map(wishlist.data.map((item) => [item.id, item.participantId])));
  }, [questions.data, wishlist.data]);
}

export function useGiftQuestionMutations(eventId: string) {
  const { giftQuestions } = useServices();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: giftQuestionKeys.event(eventId) });
  return {
    ask: useMutation({ mutationFn: (v: { itemId: string; question: string }) => giftQuestions.ask(v.itemId, v.question), onSuccess: refresh }),
    answer: useMutation({ mutationFn: (v: { questionId: string; answer: string }) => giftQuestions.answer(v.questionId, v.answer), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (questionId: string) => giftQuestions.remove(questionId), onSuccess: refresh }),
    markSeen: useMutation({ mutationFn: (itemId: string) => giftQuestions.markAnswersSeen(itemId), onSuccess: refresh }),
  };
}
