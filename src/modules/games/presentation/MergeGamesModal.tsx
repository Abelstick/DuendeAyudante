import { zodResolver } from '@hookform/resolvers/zod';
import { Merge } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Participant } from '@/modules/members/domain/Participant';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import type { Game } from '../domain/Game';
import { fieldsToForm, formToFields, GameFieldInputs, gameFormSchema, type GameFormValues } from './GameFieldInputs';
import { useGameMutations } from './hooks';

/** Propone un juego "Z" que combina las dinámicas de los elegidos. */
function combine(games: Game[]): GameFormValues {
  // "• Charadas: …\n• Mímica: …" (o el texto tal cual si solo uno lo tiene)
  const join = (pick: (g: Game) => string | null): string | null => {
    const parts = games.map((g) => ({ name: g.name, text: pick(g) })).filter((p): p is { name: string; text: string } => Boolean(p.text));
    if (parts.length <= 1) return parts[0]?.text ?? null;
    return parts.map((p) => `• ${p.name}: ${p.text}`).join('\n');
  };
  const nums = (pick: (g: Game) => number | null) => games.map(pick).filter((n): n is number => n !== null);
  const mins = nums((g) => g.minPlayers);
  const maxs = nums((g) => g.maxPlayers);
  const durs = nums((g) => g.durationMinutes);
  return fieldsToForm({
    name: games[0]?.name ?? '',
    category: games[0]?.category ?? 'family_bonding',
    description: join((g) => g.description),
    materials: join((g) => g.materials),
    instructions: join((g) => g.instructions),
    minPlayers: mins.length ? Math.min(...mins) : null,
    maxPlayers: maxs.length ? Math.max(...maxs) : null,
    durationMinutes: durs.length ? Math.max(...durs) : null,
    responsibleId: games.find((g) => g.responsibleId)?.responsibleId ?? null,
  });
}

interface Props {
  eventId: string;
  games: Game[];
  participants: Participant[];
  onClose: () => void;
  onDone: () => void;
}

export function MergeGamesModal({ eventId, games, participants, onClose, onDone }: Props) {
  const { merge } = useGameMutations(eventId);
  const toast = useToast();
  const [target, setTarget] = useState<string>('new');
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GameFormValues>({ resolver: zodResolver(gameFormSchema), defaultValues: combine(games) });
  const formId = 'merge-form';

  const submit = async (fields: ReturnType<typeof formToFields> | null) => {
    setFormError(null);
    try {
      await merge.mutateAsync({ eventId, gameIds: games.map((g) => g.id), targetId: target === 'new' ? null : target, fields });
      const name = target === 'new' ? fields?.name : games.find((g) => g.id === target)?.name;
      toast.success(`¡Listo! Unimos ${games.length} juegos en «${name}». Los votos se juntaron.`);
      onDone();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={`Unir ${games.length} juegos`}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          {target === 'new' ? (
            <Button type="submit" form={formId} size="lg" loading={merge.isPending} icon={<Merge className="size-6" aria-hidden />}>
              Unir en un juego nuevo
            </Button>
          ) : (
            <Button size="lg" loading={merge.isPending} onClick={() => submit(null)} icon={<Merge className="size-6" aria-hidden />}>
              Unir
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Notice>
          Los juegos elegidos se convierten en uno solo. Sus votos pasan al juego resultante (quien votó por varios cuenta una sola vez) y se
          reconoce a todos los que tuvieron la idea.
        </Notice>

        <fieldset>
          <legend className="mb-2 text-base font-semibold">¿Cómo quieres unirlos?</legend>
          <div className="space-y-2">
            {[{ id: 'new', label: 'Crear uno nuevo que combine las dinámicas' }, ...games.map((g) => ({ id: g.id, label: `Quedarse con «${g.name}»` }))].map(
              (o) => (
                <label
                  key={o.id}
                  className={`flex min-h-13 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 ${
                    target === o.id ? 'border-brand bg-brand-soft' : 'border-mist-200 bg-surface'
                  }`}
                >
                  <input type="radio" name="merge-target" className="size-5 accent-brand" checked={target === o.id} onChange={() => setTarget(o.id)} />
                  <span className="text-base font-semibold">{o.label}</span>
                </label>
              ),
            )}
          </div>
        </fieldset>

        {target === 'new' && (
          <form id={formId} onSubmit={handleSubmit((v) => submit(formToFields(v)))} className="space-y-5 rounded-2xl bg-mist-50 p-4" noValidate>
            <p className="text-base font-semibold text-brand-ink">Revisa y ajusta el juego combinado:</p>
            <GameFieldInputs register={register} errors={errors} participants={participants} autoFocus={false} />
          </form>
        )}

        {formError && <Notice tone="error">{formError}</Notice>}
      </div>
    </Modal>
  );
}
