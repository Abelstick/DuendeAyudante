import { MessagesSquare } from 'lucide-react';
import { Pill } from '@/shared/ui/Card';
import type { QuestionStats } from '../domain/GiftQuestion';

/** Plural corto: "1 pregunta" / "3 preguntas". */
export function questionsLabel(n: number) {
  return n === 1 ? '1 pregunta' : `${n} preguntas`;
}

/**
 * Contador de preguntas de una persona o lista. Si alguna sigue sin respuesta,
 * resalta en rojo cuántas faltan. Sin preguntas no se muestra.
 */
export function QuestionsPill({ stats, compact = false }: { stats: QuestionStats | undefined; compact?: boolean }) {
  if (!stats || stats.total === 0) return null;
  const text = compact ? String(stats.total) : questionsLabel(stats.total);
  const pendingText = stats.pending === 1 ? '1 sin responder' : `${stats.pending} sin responder`;
  return (
    <Pill tone={stats.pending > 0 ? 'berry' : 'neutral'}>
      <MessagesSquare className="size-4 shrink-0" aria-hidden />
      <span aria-hidden={compact}>{text}</span>
      {compact && <span className="sr-only">{questionsLabel(stats.total)}</span>}
      {stats.pending > 0 && (compact ? <span className="sr-only">, {pendingText}</span> : <span className="font-semibold">· {pendingText}</span>)}
    </Pill>
  );
}
