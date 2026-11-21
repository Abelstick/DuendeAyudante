import { ArrowLeft, Mail, Pencil, PenLine } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants } from '@/modules/events/domain/Event';
import { displayName } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { formatEventDate, midnightAfter } from '@/shared/lib/datetime';
import { playSound } from '@/shared/lib/sound';
import { Button, ButtonLink, Spinner } from '@/shared/ui/Button';
import { CardTitle, EmptyState, Notice, PageTitle, Pill } from '@/shared/ui/Card';
import { ConfettiBurst } from '@/shared/ui/Confetti';
import { errorMessage } from '@/shared/ui/errorMessages';
import { GiftBox } from '@/shared/ui/illustrations';
import { toTitleCase } from '@/shared/validation/names';
import type { SentMessage } from '../domain/HolidayMessage';
import { useReceivedMessages, useSentMessages } from './hooks';
import { MessageFormModal } from './MessageFormModal';

type Editing = { initial: SentMessage | null } | null;

/** Mensajes navideños: los que me escribieron (se abren a la medianoche) y los que escribí. */
export function MessagesPage() {
  const { event, context } = useEventScope();
  const received = useReceivedMessages(event.id);
  const sent = useSentMessages(event.id);
  const participants = useParticipants(event.id);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Editing>(() => (params.get('escribir') === '1' ? { initial: null } : null));
  const [opened, setOpened] = useState(false);

  const senders = actingParticipants(context);
  const unlockAt = midnightAfter(event.celebrationAt, event.timezone);
  const unlockText = formatEventDate(unlockAt, event.timezone);
  const inbox = received.data ?? [];
  const unlocked = inbox.some((m) => m.unlocked);

  if (received.isLoading || sent.isLoading || participants.isLoading) return <Spinner label="Cargando…" />;
  if (received.error || sent.error) return <Notice tone="error">{errorMessage(received.error ?? sent.error)}</Notice>;

  const people = participants.data ?? [];
  const nameOf = (id: string) => {
    const p = people.find((x) => x.id === id);
    return p ? toTitleCase(p.firstName) : 'alguien';
  };
  const showFor = senders.length > 1;

  return (
    <div className="space-y-6">
      <ButtonLink to={`/e/${event.id}`} variant="ghost" icon={<ArrowLeft className="size-5" aria-hidden />}>
        Volver al inicio
      </ButtonLink>
      <PageTitle tone="berry" icon={<Mail className="size-8" aria-hidden />} title="Mensajes navideños" subtitle="Se escriben antes y se abren a la medianoche" />

      {senders.length > 0 && (
        <Button size="lg" onClick={() => setEditing({ initial: null })} icon={<PenLine className="size-6" aria-hidden />}>
          Escribir un mensaje
        </Button>
      )}

      <section className="space-y-3">
        <CardTitle icon={<Mail className="size-6" />} tone="berry">
          Para ti
        </CardTitle>
        {inbox.length === 0 ? (
          <EmptyState emoji="📭" title="Todavía no tienes mensajes.">
            Cuando alguien te escriba, aquí aparecerá un regalito esperando.
          </EmptyState>
        ) : !unlocked ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-line bg-surface p-5 text-center shadow-block">
            <GiftBox className="w-24 motion-safe:animate-float" />
            <p className="text-xl font-extrabold text-ink-900">
              ¡{inbox.length === 1 ? 'Hay 1 mensaje esperando' : `Hay ${inbox.length} mensajes esperando`}! 🎁
            </p>
            <p className="text-base text-ink-700">
              Se abre{inbox.length === 1 ? '' : 'n'} el <strong className="first-letter:uppercase">{unlockText}</strong>.
            </p>
            {showFor && (
              <p className="text-sm text-ink-700">
                {[...new Set(inbox.map((m) => m.toId))].map((id) => `Para ${nameOf(id)}: ${inbox.filter((m) => m.toId === id).length}`).join(' · ')}
              </p>
            )}
          </div>
        ) : !opened ? (
          <button
            type="button"
            onClick={() => {
              setOpened(true);
              playSound('reveal');
            }}
            className="tap-card flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-line bg-gold-50 p-5 text-center shadow-block"
          >
            <GiftBox className="w-24 motion-safe:animate-float" />
            <span className="text-xl font-extrabold text-ink-900">¡Ya puedes abrir tus mensajes! 🎄</span>
            <span className="font-display rounded-xl border-2 border-line bg-berry-600 px-4 py-2 text-lg font-semibold text-white">Toca para abrir</span>
          </button>
        ) : (
          <>
            <ConfettiBurst />
            <ul className="stagger space-y-3">
              {inbox.map((m) => (
                <li key={m.id} className="animate-pop-in space-y-2 rounded-2xl border-2 border-line bg-surface p-4 shadow-block">
                  {showFor && <Pill tone="berry">Para {nameOf(m.toId)}</Pill>}
                  <p className="whitespace-pre-line text-lg text-ink-900">{m.body}</p>
                  <p className="text-right text-base font-bold text-ink-700">— {m.fromName ? toTitleCase(m.fromName) : 'Alguien que te quiere 🤫'}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="space-y-3">
        <CardTitle icon={<PenLine className="size-6" />}>Los que escribiste</CardTitle>
        {(sent.data ?? []).length === 0 ? (
          <p className="text-base text-ink-700">Todavía no escribiste ninguno. ¡Sorprende a alguien de la familia!</p>
        ) : (
          <ul className="space-y-2">
            {(sent.data ?? []).map((m) => {
              const to = people.find((p) => p.id === m.toId);
              return (
                <li key={m.id} className="space-y-1 rounded-2xl border-2 border-mist-300 bg-surface p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink-900">Para {to ? displayName(to) : 'alguien que ya no está'}</p>
                    {m.anonymous && <Pill>Sin firma 🤫</Pill>}
                    {showFor && <Pill tone="brand">De {nameOf(m.fromId)}</Pill>}
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line text-base text-ink-700">{m.body}</p>
                  <Button variant="ghost" onClick={() => setEditing({ initial: m })} icon={<Pencil className="size-5" aria-hidden />}>
                    Cambiar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editing && senders.length > 0 && (
        <MessageFormModal
          key={editing.initial?.id ?? 'nuevo'}
          eventId={event.id}
          initial={editing.initial}
          senders={senders}
          participants={people}
          unlockText={unlockText}
          onClose={() => {
            setEditing(null);
            if (params.has('escribir')) setParams({}, { replace: true, preventScrollReset: true });
          }}
        />
      )}
    </div>
  );
}
