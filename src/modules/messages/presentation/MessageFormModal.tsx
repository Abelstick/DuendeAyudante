import { Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { selectClasses } from '@/shared/ui/Tabs';
import { useToast } from '@/shared/ui/Toast';
import { TextArea } from '@/shared/ui/TextField';
import { toTitleCase } from '@/shared/validation/names';
import { MAX_MESSAGE_LENGTH, MESSAGE_STARTERS, type SentMessage } from '../domain/HolidayMessage';
import { useMessageMutations } from './hooks';

interface Props {
  eventId: string;
  initial: SentMessage | null;
  /** Quién puede firmar: uno mismo y las personas a cargo. */
  senders: Participant[];
  participants: Participant[];
  /** "jueves 25 de diciembre, 12:00 a. m." */
  unlockText: string;
  onClose: () => void;
}

export function MessageFormModal({ eventId, initial, senders, participants, unlockText, onClose }: Props) {
  const { save, remove } = useMessageMutations(eventId);
  const toast = useToast();
  const [fromId, setFromId] = useState(initial?.fromId ?? senders[0]?.id ?? '');
  const [toId, setToId] = useState(initial?.toId ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [anonymous, setAnonymous] = useState(initial?.anonymous ?? false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const recipients = participants.filter((p) => p.id !== fromId);
  const to = participants.find((p) => p.id === toId);

  const submit = async () => {
    setError(null);
    try {
      await save.mutateAsync({ id: initial?.id ?? null, eventId, fromId, toId, body, anonymous });
      toast.celebrate(initial ? 'Mensaje actualizado. 💌' : `¡Mensaje guardado! ${to ? toTitleCase(to.firstName) : 'La persona'} lo podrá abrir a la medianoche. 💌`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    try {
      await remove.mutateAsync(initial.id);
      toast.success('Mensaje quitado.');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={initial ? 'Cambiar mensaje' : 'Escribir un mensaje navideño'}
      onClose={save.isPending ? () => undefined : onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" loading={save.isPending} onClick={submit} icon={<Send className="size-6" aria-hidden />}>
            {initial ? 'Guardar cambios' : 'Guardar mensaje'}
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Notice>
          💌 Se abre recién el <strong>{unlockText}</strong>. Hasta entonces, la persona solo sabe que tiene un mensaje esperando.
        </Notice>

        {senders.length > 1 && (
          <label className="flex flex-col gap-1.5 text-base font-semibold">
            ¿De parte de quién?
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={selectClasses}>
              {senders.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-base font-semibold">
          ¿Para quién?
          <select value={toId} onChange={(e) => setToId(e.target.value)} className={selectClasses} autoFocus={!initial}>
            <option value="">Elige a una persona…</option>
            {recipients.map((p) => (
              <option key={p.id} value={p.id}>
                {displayName(p)}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <TextArea label="Tu mensaje" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={MAX_MESSAGE_LENGTH} placeholder="Escribe con cariño…" />
          {!body.trim() && (
            <div className="flex flex-wrap gap-2" aria-label="Ideas para empezar">
              {MESSAGE_STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => setBody(s)} className="min-h-11 rounded-full border-2 border-mist-300 bg-white px-3 text-left text-sm font-semibold text-ink-700 hover:border-brand">
                  {s}
                </button>
              ))}
            </div>
          )}
          <p className="text-right text-sm text-ink-500">
            {body.length} / {MAX_MESSAGE_LENGTH}
          </p>
        </div>

        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border-2 border-mist-300 bg-white p-3">
          <input type="checkbox" className="mt-1 size-5 accent-brand" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          <span>
            <span className="block text-base font-semibold">Enviarlo sin firma 🤫</span>
            <span className="block text-sm text-ink-700">La persona no sabrá de quién es.</span>
          </span>
        </label>

        {error && <Notice tone="error">{error}</Notice>}

        {initial && (
          <div className="border-t border-mist-200 pt-4">
            {confirmingDelete ? (
              <div className="space-y-2 rounded-xl bg-berry-50 p-3" role="alert">
                <p className="font-semibold text-berry-700">¿Quitar este mensaje?</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="danger" loading={remove.isPending} onClick={onDelete}>
                    Sí, quitar
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                    No
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmingDelete(true)} icon={<Trash2 className="size-5" aria-hidden />} className="text-berry-700! hover:bg-berry-50!">
                Quitar este mensaje
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
