import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { toTitleCase } from '@/shared/validation/names';
import { findSimilarGames, type Game, gameNameKey } from '../domain/Game';
import { fieldsToForm, formToFields, GameFieldInputs, gameFormSchema, type GameFormValues } from './GameFieldInputs';
import { useGameMutations } from './hooks';

interface Props {
  eventId: string;
  initial: Game | null;
  allGames: Game[];
  participants: Participant[];
  /** Por quién puede proponer (uno mismo y las personas a cargo). */
  proposers: Participant[];
  meId: string | null;
  canDelete: boolean;
  onClose: () => void;
}

export function GameFormModal({ eventId, initial, allGames, participants, proposers, meId, canDelete, onClose }: Props) {
  const { save, remove } = useGameMutations(eventId);
  const toast = useToast();
  const [proposedBy, setProposedBy] = useState<string | null>(initial?.proposedById ?? meId ?? proposers[0]?.id ?? null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<GameFormValues>({ resolver: zodResolver(gameFormSchema), defaultValues: fieldsToForm(initial) });

  const name = watch('name');
  const similar = findSimilarGames(name, allGames, initial?.id);
  const exact = similar.find((g) => gameNameKey(g.name) === gameNameKey(name));
  const formId = 'game-form';

  const onSubmit = async (v: GameFormValues) => {
    setFormError(null);
    try {
      await save.mutateAsync({ id: initial?.id ?? null, eventId, proposedById: proposedBy, ...formToFields(v) });
      toast.success(initial ? 'Cambios guardados.' : '¡Idea agregada! Ya la ven todos. 🎲');
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    try {
      await remove.mutateAsync(initial.id);
      toast.success(`Quitamos «${initial.name}».`);
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={initial ? 'Editar juego' : 'Nueva idea de juego o actividad'}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            form={formId}
            size="lg"
            loading={save.isPending}
            disabled={Boolean(exact)}
            icon={initial ? <Save className="size-6" aria-hidden /> : <Plus className="size-6" aria-hidden />}
          >
            {initial ? 'Guardar cambios' : 'Agregar idea'}
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {!initial && proposers.length > 1 && (
          <fieldset>
            <legend className="mb-2 text-base font-semibold">¿De quién es la idea?</legend>
            <div className="flex flex-wrap gap-2">
              {proposers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={proposedBy === p.id}
                  onClick={() => setProposedBy(p.id)}
                  className={`min-h-12 rounded-full border-2 px-4 text-base font-semibold ${
                    proposedBy === p.id ? 'border-brand bg-brand text-white' : 'border-cream-200 bg-white'
                  }`}
                >
                  {p.id === meId ? 'Mía' : `De ${toTitleCase(p.firstName)}`}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <GameFieldInputs
          register={register}
          errors={errors}
          participants={participants}
          afterName={
            exact ? (
              <Notice tone="warning">
                <strong>«{exact.name}» ya está en la lista 🙂.</strong> Búscalo y vótalo, o cambia el nombre si tu juego es distinto.
              </Notice>
            ) : similar.length > 0 ? (
              <Notice tone="warning">
                <p className="font-semibold">¿Es alguno de estos?</p>
                <ul className="ml-5 list-disc">
                  {similar.slice(0, 4).map((g) => (
                    <li key={g.id}>{g.name}</li>
                  ))}
                </ul>
                <p className="mt-1">Si tu juego es distinto, continúa sin problema.</p>
              </Notice>
            ) : null
          }
        />

        {initial?.proposedById && (
          <p className="text-sm text-ink-700">
            Idea de {displayName(participants.find((p) => p.id === initial.proposedById) ?? { fullName: '—', distinguishingNote: null })}
          </p>
        )}

        {formError && <Notice tone="error">{formError}</Notice>}

        {initial && canDelete && (
          <div className="border-t border-cream-200 pt-4">
            {confirmingDelete ? (
              <div className="space-y-2 rounded-xl bg-berry-50 p-3" role="alert">
                <p className="font-semibold text-berry-700">¿Quitar «{initial.name}»? También se borran sus votos.</p>
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
              <Button variant="ghost" onClick={() => setConfirmingDelete(true)} icon={<Trash2 className="size-5" aria-hidden />} className="!text-berry-700">
                Quitar este juego
              </Button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
