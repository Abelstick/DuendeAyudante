import { ChevronRight, MessageCircleQuestion, MessageCircleReply } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants } from '@/modules/events/domain/Event';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { toTitleCase } from '@/shared/validation/names';
import { countPending, itemsWithNewAnswers } from '../domain/GiftQuestion';
import { useEventWishlist } from './hooks';
import { useGiftQuestions } from './questionHooks';

const rowClasses = 'flex min-h-14 items-center gap-3 rounded-xl border-2 border-line bg-gold-50 px-4 py-2 text-base font-bold text-ink-900 shadow-block';

/**
 * Avisos de las preguntas sobre regalos: "te preguntaron algo" y "respondieron tu pregunta".
 * Solo aparece cuando hay algo que atender; si no, no ocupa espacio.
 * `inGifts`: ya estamos en Regalos, así que el aviso de preguntas pendientes no es un enlace.
 */
export function GiftQuestionsNotice({ inGifts = false }: { inGifts?: boolean }) {
  const { event, context } = useEventScope();
  const questions = useGiftQuestions(event.id);
  const wishlist = useEventWishlist(event.id);
  const participants = useParticipants(event.id);

  if (!questions.data?.length || !wishlist.data) return null;

  const mine = new Set(actingParticipants(context).map((p) => p.id));
  const ownerOf = new Map(wishlist.data.map((item) => [item.id, item.participantId]));
  const myItemIds = new Set(wishlist.data.filter((item) => mine.has(item.participantId)).map((item) => item.id));
  const pending = countPending(questions.data, myItemIds);
  // Personas que respondieron una pregunta mía
  const answeredBy = [...new Set(itemsWithNewAnswers(questions.data).map((itemId) => ownerOf.get(itemId)))].filter((id): id is string => Boolean(id));

  if (pending === 0 && answeredBy.length === 0) return null;

  const base = `/e/${event.id}/regalos`;
  const icon = (node: ReactNode) => (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-line bg-gold-400 text-night-900" aria-hidden>
      {node}
    </span>
  );
  const pendingText = pending === 1 ? 'Tienes 1 pregunta sin responder sobre tus regalos' : `Tienes ${pending} preguntas sin responder sobre tus regalos`;

  return (
    <div className="space-y-2" role="status">
      {pending > 0 &&
        (inGifts ? (
          <p className={rowClasses}>
            {icon(<MessageCircleQuestion className="size-5" />)}
            <span className="min-w-0 flex-1">
              {pendingText}
              <span className="block text-sm font-semibold text-ink-700">Están más abajo, dentro de cada regalo.</span>
            </span>
          </p>
        ) : (
          <Link to={base} className={`tap-card ${rowClasses}`}>
            {icon(<MessageCircleQuestion className="size-5" />)}
            <span className="min-w-0 flex-1">
              {pendingText}
              <span className="block text-sm font-semibold text-ink-700">Toca para responder</span>
            </span>
            <ChevronRight className="size-6 shrink-0 text-brand-ink" aria-hidden />
          </Link>
        ))}
      {answeredBy.map((participantId) => {
        const person = participants.data?.find((p) => p.id === participantId);
        return (
          <Link key={participantId} to={`${base}/persona/${participantId}`} className={`tap-card ${rowClasses}`}>
            {icon(<MessageCircleReply className="size-5" />)}
            <span className="min-w-0 flex-1">
              {person ? `${toTitleCase(person.firstName)} respondió tu pregunta` : 'Respondieron tu pregunta'}
              <span className="block text-sm font-semibold text-ink-700">Toca para ver la respuesta</span>
            </span>
            <ChevronRight className="size-6 shrink-0 text-brand-ink" aria-hidden />
          </Link>
        );
      })}
    </div>
  );
}
