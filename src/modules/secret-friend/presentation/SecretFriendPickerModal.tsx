import { Save } from 'lucide-react';
import { useState } from 'react';
import type { Family } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { TextField } from '@/shared/ui/TextField';
import { useSecretFriendMutations } from './hooks';

interface Props {
  eventId: string;
  giver: Participant;
  forName: string | null;
  currentReceiverId: string | null;
  participants: Participant[];
  families: Family[];
  onClose: () => void;
}

export function SecretFriendPickerModal({ eventId, giver, forName, currentReceiverId, participants, families, onClose }: Props) {
  const { set } = useSecretFriendMutations(eventId);
  const toast = useToast();
  const [receiverId, setReceiverId] = useState<string | null>(currentReceiverId);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const plain = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const options = participants
    .filter((p) => p.id !== giver.id)
    .filter((p) => !search.trim() || plain(displayName(p)).includes(plain(search.trim())));

  const save = async () => {
    if (!receiverId) {
      setError('Toca el nombre de la persona a la que le regalas.');
      return;
    }
    setError(null);
    try {
      await set.mutateAsync({ giverId: giver.id, receiverId });
      toast.success('Listo. Solo tú puedes verlo. 🤫');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={forName ? `Amigo secreto de ${forName}` : 'Mi amigo secreto'}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" loading={set.isPending} onClick={save} icon={<Save className="size-6" aria-hidden />}>
            Guardar
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Notice>🔒 Esto es privado: nadie más lo verá, ni el organizador.</Notice>
        <p className="text-lg font-semibold">{forName ? `¿A quién le regala ${forName}?` : '¿A quién le regalas?'}</p>
        {participants.length > 8 && (
          <TextField label="Buscar" type="search" placeholder="Escribe un nombre" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
        <div role="radiogroup" aria-label="Persona" className="max-h-80 space-y-2 overflow-y-auto">
          {options.map((p) => {
            const selected = receiverId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setReceiverId(p.id)}
                className={`flex min-h-14 w-full flex-wrap items-center justify-between gap-2 rounded-xl border-2 px-4 py-2 text-left ${
                  selected ? 'border-brand bg-brand-soft' : 'border-mist-200 bg-white'
                }`}
              >
                <span className="text-base font-semibold">
                  {selected ? '✓ ' : ''}
                  {displayName(p)}
                </span>
                <FamilyBadge family={families.find((f) => f.id === p.familyId)} />
              </button>
            );
          })}
          {options.length === 0 && <p className="text-base text-ink-700">No encontramos a nadie con ese nombre.</p>}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Modal>
  );
}
