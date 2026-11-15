import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FAMILY_COLOR_KEYS, FAMILY_COLORS, type Family, type FamilyColor } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilyMutations } from '@/modules/families/presentation/hooks';
import type { Participant } from '@/modules/members/domain/Participant';
import { Button } from '@/shared/ui/Button';
import { EmptyState, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';
import { TextField } from '@/shared/ui/TextField';
import { normalizeName } from '@/shared/validation/names';

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre de la familia (ej. GARCÍA).').max(60),
  dressCodeNote: z.string().max(120),
});
type FormValues = z.infer<typeof schema>;

export function FamiliesManager({ eventId, families, participants }: { eventId: string; families: Family[]; participants: Participant[] }) {
  const { create, remove } = useFamilyMutations(eventId);
  const toast = useToast();
  const [color, setColor] = useState<FamilyColor>(() => FAMILY_COLOR_KEYS.find((c) => !families.some((f) => f.color === c)) ?? 'green');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', dressCodeNote: '' } });

  const onSubmit = async (v: FormValues) => {
    setFormError(null);
    try {
      await create.mutateAsync({ name: v.name, color, dressCodeNote: v.dressCodeNote || null });
      toast.success(`Familia ${normalizeName(v.name)} creada.`);
      reset();
      setColor(FAMILY_COLOR_KEYS.find((c) => c !== color && !families.some((f) => f.color === c)) ?? color);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const onRemove = async (family: Family) => {
    try {
      await remove.mutateAsync(family.id);
      toast.success(`Quitamos la familia ${family.name}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {families.length === 0 ? (
        <EmptyState emoji="👨‍👩‍👧‍👦" title="Todavía no hay familias.">
          Crea una familia por cada rama (ej. GARCÍA, LÓPEZ). Cada una tendrá su color.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {families.map((f) => {
            const count = participants.filter((p) => p.familyId === f.id).length;
            return (
              <li key={f.id} className="rounded-2xl border border-cream-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <FamilyBadge family={f} showColorName />
                    <p className="text-sm text-ink-700">
                      {count} {count === 1 ? 'integrante' : 'integrantes'}
                      {f.dressCodeNote ? ` · Vestimenta: ${f.dressCodeNote}` : ''}
                    </p>
                  </div>
                  {confirmingId !== f.id && (
                    <Button variant="ghost" onClick={() => setConfirmingId(f.id)} icon={<Trash2 className="size-5" aria-hidden />}>
                      Quitar
                    </Button>
                  )}
                </div>
                {confirmingId === f.id && (
                  <div className="mt-3 space-y-2 rounded-xl bg-berry-50 p-3" role="alert">
                    <p className="font-semibold text-berry-700">
                      ¿Quitar la familia {f.name}? Sus integrantes no se borran: quedan «sin familia».
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="danger" loading={remove.isPending} onClick={() => onRemove(f)}>
                        Sí, quitar
                      </Button>
                      <Button variant="secondary" onClick={() => setConfirmingId(null)}>
                        No
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-3xl bg-cream-50 p-4" noValidate>
        <h3 className="text-lg font-bold text-pine-900">Nueva familia</h3>
        <TextField label="Nombre de la familia" placeholder="ej. García" error={errors.name?.message} {...register('name')} />
        <fieldset>
          <legend className="mb-2 text-base font-semibold">Color</legend>
          <div className="grid grid-cols-4 gap-2">
            {FAMILY_COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl border-2 text-sm font-semibold ${
                  color === c ? 'border-ink-900 ring-2 ring-gold-400' : 'border-cream-200'
                }`}
                style={{ backgroundColor: FAMILY_COLORS[c].soft, color: FAMILY_COLORS[c].text }}
              >
                <span className="size-4 rounded-full" style={{ backgroundColor: FAMILY_COLORS[c].swatch }} aria-hidden />
                {color === c ? '✓ ' : ''}
                {FAMILY_COLORS[c].label}
              </button>
            ))}
          </div>
        </fieldset>
        <TextField
          label="Indicación de vestimenta"
          optional
          placeholder="ej. Polo rojo"
          error={errors.dressCodeNote?.message}
          {...register('dressCodeNote')}
        />
        {formError && <Notice tone="error">{formError}</Notice>}
        <Button type="submit" loading={create.isPending} icon={<Plus className="size-5" aria-hidden />}>
          Crear familia
        </Button>
      </form>
    </div>
  );
}
