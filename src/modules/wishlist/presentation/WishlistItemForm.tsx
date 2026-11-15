import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, Plus, Save, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { formatMoney, parseMoney } from '@/shared/lib/money';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { TextArea, TextField } from '@/shared/ui/TextField';
import { isValidHttpUrl, MAX_LINKS_PER_ITEM, normalizeUrl, PRIORITY_LABELS, type WishlistItem, type WishPriority } from '../domain/WishlistItem';

const schema = z.object({
  title: z.string().trim().min(1, 'Escribe qué regalo te gustaría (ej. Polo, Colonia, Billetera).').max(120, 'Usa un nombre más corto.'),
  description: z.string().max(1000, 'Los detalles son muy largos. Resúmelos un poco.'),
  links: z.array(
    z.object({
      url: z.string().refine((v) => !v.trim() || isValidHttpUrl(normalizeUrl(v)), 'Este enlace no es válido. Cópialo de nuevo desde la tienda.'),
    }),
  ),
  price: z.string().refine((v) => !Number.isNaN(parseMoney(v)), 'Escribe el precio solo con números (ej. 45 o 45.50).'),
  priority: z.enum(['1', '2', '3']),
});
export type WishFormValues = z.infer<typeof schema>;

export interface WishFormResult {
  title: string;
  description: string | null;
  links: { url: string; label: null }[];
  priceEstimate: number | null;
  priority: WishPriority;
}

interface Props {
  initial?: WishlistItem;
  budget: number | null;
  currency: string;
  forName?: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (data: WishFormResult) => Promise<boolean>;
  onCancel: () => void;
}

function toDefaults(item?: WishlistItem): WishFormValues {
  return {
    title: item?.title ?? '',
    description: item?.description ?? '',
    links: item && item.links.length > 0 ? item.links.map((l) => ({ url: l.url })) : [{ url: '' }],
    price: item?.priceEstimate != null ? String(item.priceEstimate) : '',
    priority: String(item?.priority ?? 2) as WishFormValues['priority'],
  };
}

export function WishlistItemForm({ initial, budget, currency, forName, submitting, error, onSubmit, onCancel }: Props) {
  const [savedCount, setSavedCount] = useState(0);
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setFocus,
    formState: { errors },
  } = useForm<WishFormValues>({ resolver: zodResolver(schema), defaultValues: toDefaults(initial) });
  const { fields, append, remove } = useFieldArray({ control, name: 'links' });

  const price = parseMoney(watch('price'));
  const overBudget = budget != null && price != null && !Number.isNaN(price) && price > budget;

  const submit = async (v: WishFormValues) => {
    const ok = await onSubmit({
      title: v.title,
      description: v.description.trim() || null,
      links: v.links.map((l) => ({ url: normalizeUrl(l.url), label: null })).filter((l) => l.url),
      priceEstimate: parseMoney(v.price),
      priority: Number(v.priority) as WishPriority,
    });
    // Al crear, el formulario queda listo para el siguiente regalo
    if (ok && !initial) {
      reset(toDefaults());
      setSavedCount((c) => c + 1);
      setTimeout(() => setFocus('title'), 0);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
      {forName && (
        <p className="text-base text-ink-700">
          Para <strong className="text-ink-900">{forName}</strong>
        </p>
      )}

      {savedCount > 0 && !initial && <Notice tone="success">✅ ¡Regalo guardado! Ya aparece en tu lista. Si quieres, agrega otro aquí.</Notice>}

      <TextField
        label="¿Qué regalo te gustaría?"
        placeholder="ej. Polo, Colonia, Billetera, Juguete"
        autoFocus
        error={errors.title?.message}
        {...register('title')}
      />

      <TextArea
        label="Detalles"
        optional
        hint="Talla, color, marca, modelo… lo que nos ayude a acertar."
        placeholder="ej. Talla M, color azul"
        error={errors.description?.message}
        {...register('description')}
      />

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-ink-900">
          ¿Dónde lo encontramos? <span className="font-normal text-ink-500">(opcional)</span>
        </legend>
        <p className="text-sm text-ink-700">Pega el enlace de la tienda. Puedes poner varios.</p>
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <div className="flex-1">
              <TextField
                label={`Enlace ${index + 1}`}
                type="url"
                inputMode="url"
                autoCapitalize="none"
                placeholder="https://…"
                error={errors.links?.[index]?.url?.message}
                {...register(`links.${index}.url`)}
              />
            </div>
            {fields.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="mt-9 flex min-h-13 min-w-13 items-center justify-center rounded-xl border-2 border-mist-300 text-berry-700"
                aria-label={`Quitar enlace ${index + 1}`}
              >
                <X className="size-6" aria-hidden />
              </button>
            )}
          </div>
        ))}
        {fields.length < MAX_LINKS_PER_ITEM && (
          <Button variant="ghost" onClick={() => append({ url: '' })} icon={<Link2 className="size-5" aria-hidden />}>
            Agregar otro enlace
          </Button>
        )}
      </fieldset>

      <TextField
        label={`Precio aproximado (${currency === 'PEN' ? 'S/' : currency})`}
        optional
        inputMode="decimal"
        placeholder="ej. 45"
        error={errors.price?.message}
        {...register('price')}
      />
      {overBudget && budget != null && (
        <Notice tone="warning">Este regalo cuesta más que {formatMoney(budget, currency)}, el presupuesto del intercambio. Puedes guardarlo igual.</Notice>
      )}

      <fieldset>
        <legend className="mb-2 text-base font-semibold text-ink-900">¿Cuánto lo quieres?</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['1', '2', '3'] as const).map((p) => (
            <label key={p} className="cursor-pointer">
              <input type="radio" value={p} className="peer sr-only" {...register('priority')} />
              <span className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-mist-300 px-2 text-center text-base font-semibold peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-gold-400">
                {PRIORITY_LABELS[Number(p) as WishPriority]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" size="lg" loading={submitting} icon={initial ? <Save className="size-6" aria-hidden /> : <Plus className="size-6" aria-hidden />}>
          {initial ? 'Guardar cambios' : 'Guardar regalo'}
        </Button>
        <Button variant="secondary" size="lg" onClick={onCancel}>
          {savedCount > 0 ? 'Listo, terminé' : 'Cancelar'}
        </Button>
      </div>
    </form>
  );
}
