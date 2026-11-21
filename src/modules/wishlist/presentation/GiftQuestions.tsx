import { ChevronDown, MessageCircleQuestion, Send, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Pill } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { TextArea } from '@/shared/ui/TextField';
import { useToast } from '@/shared/ui/Toast';
import { MAX_ANSWER_LENGTH, MAX_QUESTION_LENGTH, type GiftQuestion } from '../domain/GiftQuestion';
import { useGiftQuestionMutations, useGiftQuestions } from './questionHooks';

interface Props {
  eventId: string;
  itemId: string;
  /** Puede responder: la persona del regalo, su tutor o quien administra. */
  canAnswer: boolean;
  /** Puede preguntar: quien mira el regalo de otra persona. */
  canAsk: boolean;
}

/**
 * Preguntas anónimas sobre un regalo, dentro de su tarjeta. Es discreto: un solo
 * botón que se despliega. En los regalos propios no aparece hasta que alguien pregunta.
 */
export function GiftQuestions({ eventId, itemId, canAnswer, canAsk }: Props) {
  const all = useGiftQuestions(eventId);
  const { ask, markSeen } = useGiftQuestionMutations(eventId);
  const toast = useToast();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const questions = useMemo(() => (all.data ?? []).filter((q) => q.itemId === itemId), [all.data, itemId]);
  const pending = questions.filter((q) => q.answer === null).length;
  const hasNewAnswer = questions.some((q) => q.answerUnseen);

  // Se abre sola cuando hay algo que atender: una pregunta por responder o una respuesta nueva
  const needsAttention = (canAnswer && pending > 0) || hasNewAnswer;
  useEffect(() => {
    if (needsAttention) setOpen(true);
  }, [needsAttention]);

  // Al ver la respuesta, deja de avisarse
  const marked = useRef(false);
  const markSeenNow = markSeen.mutate;
  useEffect(() => {
    if (open && hasNewAnswer && !marked.current) {
      marked.current = true;
      markSeenNow(itemId);
    }
  }, [open, hasNewAnswer, itemId, markSeenNow]);

  if (!all.data) return null;
  if (questions.length === 0 && !canAsk) return null;

  const send = async () => {
    setError(null);
    try {
      await ask.mutateAsync({ itemId, question: draft });
      setDraft('');
      toast.success('Pregunta enviada. Nadie sabrá que fuiste tú. 🤫');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="rounded-xl border-2 border-line/15 bg-mist-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-12 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-base font-bold text-heading hover:bg-mist-200"
      >
        <MessageCircleQuestion className="size-5 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          {questions.length === 0 ? '¿Tienes una duda? Pregunta de forma anónima' : `Preguntas y respuestas (${questions.length})`}
          {canAnswer && pending > 0 && <Pill tone="berry">{pending} sin responder</Pill>}
          {hasNewAnswer && <Pill tone="success">Respuesta nueva</Pill>}
        </span>
        <ChevronDown className={`size-5 shrink-0 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div id={panelId} className="animate-pop-in space-y-3 px-3 pb-3">
          {questions.length > 0 && (
            <ul className="space-y-2">
              {questions.map((q) => (
                <QuestionRow key={q.id} eventId={eventId} question={q} canAnswer={canAnswer} />
              ))}
            </ul>
          )}

          {canAsk && (
            <div className="space-y-2 rounded-lg bg-surface p-3">
              <TextArea
                label="Tu pregunta"
                rows={2}
                hint="Es anónima: nadie sabrá quién la hizo. Todos podrán ver la pregunta y la respuesta."
                placeholder="ej. ¿Qué talla usas?"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_QUESTION_LENGTH}
                error={error ?? undefined}
              />
              <Button onClick={send} loading={ask.isPending} disabled={!draft.trim()} icon={<Send className="size-5" aria-hidden />}>
                Enviar pregunta
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionRow({ eventId, question: q, canAnswer }: { eventId: string; question: GiftQuestion; canAnswer: boolean }) {
  const { answer, remove } = useGiftQuestionMutations(eventId);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(q.answer ?? '');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answering = canAnswer && (q.answer === null || editing);
  // Quien administra el regalo quita cualquier pregunta; quien la hizo, solo mientras no tenga respuesta
  const canRemove = canAnswer || (q.isMine && q.answer === null);

  const save = async () => {
    setError(null);
    try {
      await answer.mutateAsync({ questionId: q.id, answer: draft });
      setEditing(false);
      toast.success('¡Respuesta enviada!');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const del = async () => {
    try {
      await remove.mutateAsync(q.id);
      toast.success('Quitamos la pregunta.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <li className="space-y-2 rounded-lg bg-surface p-3">
      <p className="text-base font-bold text-ink-900 wrap-break-word">
        <span aria-hidden>❓ </span>
        <span className="sr-only">Pregunta: </span>
        {q.question}
      </p>
      {q.isMine && <p className="text-sm font-semibold text-ink-500">La hiciste tú (solo tú lo sabes).</p>}

      {answering ? (
        <div className="space-y-2">
          <TextArea
            label="Tu respuesta"
            rows={2}
            hint="Todos podrán verla."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_ANSWER_LENGTH}
            error={error ?? undefined}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} loading={answer.isPending} disabled={!draft.trim() || draft.trim() === q.answer} icon={<Send className="size-5" aria-hidden />}>
              Responder
            </Button>
            {editing && (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  setDraft(q.answer ?? '');
                  setError(null);
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      ) : q.answer !== null ? (
        <p className="rounded-lg bg-pine-50 px-3 py-2 text-base whitespace-pre-line text-ink-900 wrap-break-word">
          <span aria-hidden>💬 </span>
          <span className="sr-only">Respuesta: </span>
          {q.answer}
        </p>
      ) : (
        <p className="text-sm text-ink-700">Todavía sin respuesta.</p>
      )}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <span className="text-sm font-semibold text-berry-700">¿Quitar esta pregunta?</span>
          <Button variant="danger" loading={remove.isPending} onClick={del}>
            Sí, quitar
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            No
          </Button>
        </div>
      ) : (
        (canRemove || (canAnswer && q.answer !== null && !editing)) && (
          <div className="flex flex-wrap gap-1">
            {canAnswer && q.answer !== null && !editing && (
              <Button variant="ghost" onClick={() => setEditing(true)}>
                Cambiar respuesta
              </Button>
            )}
            {canRemove && (
              <Button variant="ghost" onClick={() => setConfirming(true)} icon={<Trash2 className="size-5" aria-hidden />} className="text-berry-700!">
                Quitar pregunta
              </Button>
            )}
          </div>
        )
      )}
    </li>
  );
}
