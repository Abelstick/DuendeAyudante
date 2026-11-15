import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FAMILY_COLOR_KEYS, FAMILY_COLORS, FAMILY_THEMES, type Family, type FamilyColor } from '@/modules/families/domain/Family';
import { useFamilyMutations } from '@/modules/families/presentation/hooks';
import type { Participant } from '@/modules/members/domain/Participant';
import { Button } from '@/shared/ui/Button';
import { EmptyState, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { TextField } from '@/shared/ui/TextField';
import { normalizeName } from '@/shared/validation/names';

type Editing = { mode: 'create' } | { mode: 'edit'; family: Family } | null;

export function FamiliesManager({ eventId, families, participants }: { eventId: string; families: Family[]; participants: Participant[] }) {
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <div className="space-y-4">
      {families.length === 0 ? (
        <EmptyState emoji="👨‍👩‍👧‍👦" title="Todavía no hay familias.">
          Crea una familia por cada rama (ej. GARCÍA, LÓPEZ). Cada una tendrá su color, y la aplicación de sus integrantes se verá de ese color.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {families.map((f) => {
            const count = participants.filter((p) => p.familyId === f.id).length;
            const color = FAMILY_COLORS[f.color];
            return (
              <li key={f.id} className="overflow-hidden rounded-2xl border border-mist-200 bg-white shadow-card">
                <div className="h-3" style={{ backgroundColor: FAMILY_THEMES[f.color].strong }} aria-hidden />
                <div className="space-y-2 p-4">
                  <p className="text-lg font-bold" style={{ color: color.text }}>
                    Familia {f.name}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-ink-700">
                    <span className="size-4 rounded-full border border-black/25" style={{ backgroundColor: color.swatch }} aria-hidden />
                    {color.label} · {count} {count === 1 ? 'integrante' : 'integrantes'}
                  </p>
                  {f.dressCodeNote && <p className="text-sm text-ink-700">👕 {f.dressCodeNote}</p>}
                  <Button variant="secondary" onClick={() => setEditing({ mode: 'edit', family: f })} icon={<Pencil className="size-5" aria-hidden />}>
                    Editar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button onClick={() => setEditing({ mode: 'create' })} icon={<Plus className="size-5" aria-hidden />}>
        Nueva familia
      </Button>

      {editing && (
        <FamilyFormModal
          key={editing.mode === 'edit' ? editing.family.id : 'create'}
          eventId={eventId}
          editing={editing}
          families={families}
          memberCount={editing.mode === 'edit' ? participants.filter((p) => p.familyId === editing.family.id).length : 0}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre de la familia (ej. GARCÍA).').max(60, 'Usa un nombre más corto.'),
  dressCodeNote: z.string().max(120, 'Usa una indicación más corta.'),
});
type FormValues = z.infer<typeof schema>;

interface FormModalProps {
  eventId: string;
  editing: NonNullable<Editing>;
  families: Family[];
  memberCount: number;
  onClose: () => void;
}

function FamilyFormModal({ eventId, editing, families, memberCount, onClose }: FormModalProps) {
  const { create, update, remove } = useFamilyMutations(eventId);
  const toast = useToast();
  const initial = editing.mode === 'edit' ? editing.family : null;
  const [color, setColor] = useState<FamilyColor>(
    () => initial?.color ?? FAMILY_COLOR_KEYS.find((c) => !families.some((f) => f.color === c)) ?? 'green',
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: initial?.name ?? '', dressCodeNote: initial?.dressCodeNote ?? '' },
  });

  const previewName = normalizeName(watch('name')) || 'NUEVA';
  const saving = create.isPending || update.isPending;
  const formId = 'family-form';

  const onSubmit = async (v: FormValues) => {
    setFormError(null);
    const data = { name: v.name, color, dressCodeNote: v.dressCodeNote || null };
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, data });
        toast.success(`Familia ${normalizeName(v.name)} actualizada.`);
      } else {
        await create.mutateAsync(data);
        toast.success(`Familia ${normalizeName(v.name)} creada.`);
      }
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    try {
      await remove.mutateAsync(initial.id);
      toast.success(`Quitamos la familia ${initial.name}.`);
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={initial ? `Editar familia ${initial.name}` : 'Nueva familia'}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            form={formId}
            size="lg"
            loading={saving}
            icon={initial ? <Save className="size-6" aria-hidden /> : <Plus className="size-6" aria-hidden />}
          >
            {initial ? 'Guardar cambios' : 'Crear familia'}
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <TextField label="Nombre de la familia" placeholder="ej. García" autoFocus error={errors.name?.message} {...register('name')} />

        <fieldset>
          <legend className="mb-2 text-base font-semibold">Color de la familia</legend>
          <div className="grid grid-cols-3 gap-2">
            {FAMILY_COLOR_KEYS.map((c) => {
              const used = families.some((f) => f.color === c && f.id !== initial?.id);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 text-sm font-semibold ${
                    color === c ? 'border-ink-900 ring-2 ring-gold-400' : 'border-mist-200'
                  }`}
                  style={{ backgroundColor: FAMILY_COLORS[c].soft, color: FAMILY_COLORS[c].text }}
                >
                  <span className="size-5 rounded-full border border-black/25" style={{ backgroundColor: FAMILY_COLORS[c].swatch }} aria-hidden />
                  <span>
                    {color === c ? '✓ ' : ''}
                    {FAMILY_COLORS[c].label}
                  </span>
                  {used && <span className="text-xs font-normal">(ya en uso)</span>}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Vista previa de cómo verán la aplicación los integrantes */}
        <div className="overflow-hidden rounded-2xl border border-mist-200" aria-hidden>
          <div className="snow-bg px-4 py-3 text-base font-bold text-white" style={{ backgroundColor: FAMILY_THEMES[color].strong }}>
            🎄 Así verán la aplicación sus integrantes
          </div>
          <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ backgroundColor: FAMILY_THEMES[color].page }}>
            <span className="font-semibold" style={{ color: FAMILY_COLORS[color].text }}>
              Familia {previewName}
            </span>
            <span className="rounded-xl px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: FAMILY_THEMES[color].strong }}>
              Agregar regalo
            </span>
          </div>
        </div>

        <TextField label="Indicación de vestimenta" optional placeholder="ej. Polo rojo" error={errors.dressCodeNote?.message} {...register('dressCodeNote')} />

        {formError && <Notice tone="error">{formError}</Notice>}

        {initial && (
          <div className="border-t border-mist-200 pt-4">
            {confirmingDelete ? (
              <div className="space-y-2 rounded-xl bg-berry-50 p-3" role="alert">
                <p className="font-semibold text-berry-700">
                  ¿Quitar la familia {initial.name}?{memberCount > 0 ? ` Sus ${memberCount} integrantes no se borran: quedan «sin familia».` : ''}
                </p>
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
                Quitar esta familia
              </Button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
