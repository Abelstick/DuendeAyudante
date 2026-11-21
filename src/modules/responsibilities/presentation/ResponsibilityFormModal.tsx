import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { type Family } from '@/modules/families/domain/Family';
import { FAMILY_COLORS } from '@/modules/families/presentation/familyTheme';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { TextArea, TextField } from '@/shared/ui/TextField';
import {
  CATEGORY_LABELS,
  KIND_LABELS,
  STATUS_LABELS,
  type Responsibility,
  type ResponsibilityCategory,
  type ResponsibilityKind,
  type ResponsibilityStatus,
} from '../domain/Responsibility';
import { useResponsibilityMutations } from './hooks';

const schema = z.object({
  title: z.string().trim().min(1, 'Escribe qué hay que llevar o hacer (ej. Pavo al horno).').max(120, 'Usa un texto más corto.'),
  description: z.string().max(1000, 'Los detalles son muy largos.'),
  dueDate: z.string(),
  notes: z.string().max(1000, 'Las observaciones son muy largas.'),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  eventId: string;
  initial: Responsibility | null;
  defaultKind: ResponsibilityKind;
  families: Family[];
  participants: Participant[];
  /** Al crear: personas que ya vienen marcadas como responsables (p. ej. "Asignar tarea" desde un familiar). */
  initialParticipantIds?: string[];
  onClose: () => void;
}

export function ResponsibilityFormModal({ eventId, initial, defaultKind, families, participants, initialParticipantIds = [], onClose }: Props) {
  const { save, remove } = useResponsibilityMutations(eventId);
  const toast = useToast();
  const [kind, setKind] = useState<ResponsibilityKind>(initial?.kind ?? defaultKind);
  const [category, setCategory] = useState<ResponsibilityCategory>(initial?.category ?? (defaultKind === 'task' ? 'other' : 'food'));
  const [status, setStatus] = useState<ResponsibilityStatus>(initial?.status ?? 'pending');
  const [familyIds, setFamilyIds] = useState<string[]>(initial?.familyIds ?? []);
  const [participantIds, setParticipantIds] = useState<string[]>(initial?.participantIds ?? initialParticipantIds);
  const [search, setSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      dueDate: initial?.dueDate ?? '',
      notes: initial?.notes ?? '',
    },
  });
  const formId = 'responsibility-form';
  const kindLabel = KIND_LABELS[kind].one.toLowerCase();

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const plain = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const visiblePeople = participants.filter((p) => !search.trim() || plain(displayName(p)).includes(plain(search.trim())));

  const onSubmit = async (v: FormValues) => {
    setFormError(null);
    try {
      await save.mutateAsync({
        id: initial?.id ?? null,
        eventId,
        kind,
        category,
        title: v.title,
        description: v.description || null,
        dueDate: v.dueDate || null,
        status,
        notes: v.notes || null,
        participantIds,
        familyIds,
      });
      toast.success(initial ? 'Cambios guardados.' : kind === 'task' ? 'Tarea agregada.' : 'Aporte agregado.');
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    try {
      await remove.mutateAsync(initial.id);
      toast.success(`Quitamos «${initial.title}».`);
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const chip = (active: boolean) =>
    `min-h-12 rounded-xl border-2 px-3 text-base font-semibold ${active ? 'border-brand bg-brand text-white' : 'border-mist-200 bg-surface'}`;

  return (
    <Modal
      open
      title={initial ? `Editar ${kindLabel}` : kind === 'task' ? 'Nueva tarea' : 'Nuevo aporte'}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            form={formId}
            size="lg"
            loading={save.isPending}
            icon={initial ? <Save className="size-6" aria-hidden /> : <Plus className="size-6" aria-hidden />}
          >
            {initial ? 'Guardar cambios' : 'Guardar'}
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <fieldset>
          <legend className="mb-2 text-base font-semibold">¿Qué es?</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['contribution', 'task'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
                {kind === k ? '✓ ' : ''}
                {k === 'contribution' ? 'Aporte (algo que llevar)' : 'Tarea (algo que hacer)'}
              </button>
            ))}
          </div>
        </fieldset>

        <TextField
          label={kind === 'contribution' ? '¿Qué hay que llevar?' : '¿Qué hay que hacer?'}
          placeholder={kind === 'contribution' ? 'ej. Pavo al horno' : 'ej. Armar el árbol'}
          autoFocus
          error={errors.title?.message}
          {...register('title')}
        />

        <fieldset>
          <legend className="mb-2 text-base font-semibold">Categoría</legend>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CATEGORY_LABELS) as ResponsibilityCategory[]).map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`${chip(category === c)} text-left`}>
                <span aria-hidden>{CATEGORY_LABELS[c].emoji}</span> {CATEGORY_LABELS[c].label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-base font-semibold">¿Quiénes son responsables?</legend>
          <p className="text-sm text-ink-700">Puedes elegir familias completas, personas, o ambas.</p>
          {families.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {families.map((f) => {
                const on = familyIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFamilyIds((ids) => toggle(ids, f.id))}
                    className={`flex min-h-12 items-center gap-2 rounded-full border-2 px-4 text-base font-semibold ${
                      on ? 'border-ink-900 ring-2 ring-gold-400' : 'border-mist-200'
                    }`}
                    style={{ backgroundColor: FAMILY_COLORS[f.color].soft, color: FAMILY_COLORS[f.color].text }}
                  >
                    {on ? '✓ ' : ''}Familia {f.name}
                  </button>
                );
              })}
            </div>
          )}
          {participants.length > 8 && (
            <TextField label="Buscar persona" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Escribe un nombre" />
          )}
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl">
            {visiblePeople.map((p) => (
              <label key={p.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-mist-300 bg-surface px-3">
                <input
                  type="checkbox"
                  className="size-5 accent-brand"
                  checked={participantIds.includes(p.id)}
                  onChange={() => setParticipantIds((ids) => toggle(ids, p.id))}
                />
                <span className="text-base">{displayName(p)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <TextField label="Fecha límite" optional type="date" {...register('dueDate')} />
        <TextArea label="Detalles" optional rows={2} placeholder="ej. Para 20 personas" error={errors.description?.message} {...register('description')} />

        {initial && (
          <fieldset>
            <legend className="mb-2 text-base font-semibold">Estado</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(STATUS_LABELS) as ResponsibilityStatus[]).map((s) => (
                <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={chip(status === s)}>
                  <span aria-hidden>{STATUS_LABELS[s].emoji}</span> {STATUS_LABELS[s].label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <TextArea label="Observaciones" optional rows={2} error={errors.notes?.message} {...register('notes')} />

        {formError && <Notice tone="error">{formError}</Notice>}

        {initial && (
          <div className="border-t border-mist-200 pt-4">
            {confirmingDelete ? (
              <div className="space-y-2 rounded-xl bg-berry-50 p-3" role="alert">
                <p className="font-semibold text-berry-700">¿Quitar «{initial.title}»?</p>
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
                Quitar
              </Button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
