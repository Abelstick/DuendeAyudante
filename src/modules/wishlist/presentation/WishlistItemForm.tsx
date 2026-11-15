import { zodResolver } from '@hookform/resolvers/zod';
import { Lightbulb, Link2, ListPlus, Plus, Save, Sparkles, Tag, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { PhotoUploadStatus } from '@/modules/family-drive/domain/FamilyDrive';
import { formatMoney, parseMoney } from '@/shared/lib/money';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import type { GiftIdea } from '../domain/GiftIdeas';
import { GiftIdeasModal } from './GiftIdeasModal';
import { SegmentedTabs } from '@/shared/ui/Tabs';
import { TextArea, TextField } from '@/shared/ui/TextField';
import {
  isValidHttpUrl,
  MAX_BRAND_LENGTH,
  MAX_BRANDS_PER_ITEM,
  MAX_LINKS_PER_ITEM,
  normalizeBrands,
  normalizeUrl,
  PRIORITY_LABELS,
  type WishlistItem,
  type WishPriority,
} from '../domain/WishlistItem';
import type { WishlistPhoto } from '../domain/WishlistPhoto';
import { useQueuedPhotos } from './photoQueue';
import { WishPhotosField } from './WishPhotosField';
import { useWishFormMode } from './wishFormMode';

const priceText = z.string().refine((v) => !Number.isNaN(parseMoney(v)), 'Escribe el precio solo con números (ej. 45 o 45.50).');

const schema = z
  .object({
  title: z.string().trim().min(1, 'Escribe qué regalo te gustaría (ej. Polo, Colonia, Billetera).').max(120, 'Usa un nombre más corto.'),
  description: z.string().max(1000, 'Los detalles son muy largos. Resúmelos un poco.'),
  links: z.array(
    z.object({
      url: z.string().refine((v) => !v.trim() || isValidHttpUrl(normalizeUrl(v)), 'Este enlace no es válido. Cópialo de nuevo desde la tienda.'),
    }),
  ),
  brands: z.array(z.string()).max(MAX_BRANDS_PER_ITEM),
  priceMin: priceText,
  priceMax: priceText,
  priority: z.enum(['1', '2', '3']),
})
  .refine(
    (v) => {
      const min = parseMoney(v.priceMin);
      const max = parseMoney(v.priceMax);
      return min === null || max === null || Number.isNaN(min) || Number.isNaN(max) || max >= min;
    },
    { path: ['priceMax'], message: 'Debe ser igual o mayor que el precio «desde».' },
  );
export type WishFormValues = z.infer<typeof schema>;

export interface WishFormResult {
  title: string;
  description: string | null;
  links: { url: string; label: null }[];
  brands: string[];
  priceMin: number | null;
  priceMax: number | null;
  priority: WishPriority;
  /** Fotos elegidas para subir después de guardar. */
  newPhotos: File[];
}

export interface WishFormPhotos {
  status: PhotoUploadStatus;
  removingId: string | null;
  onRemoveExisting: (photo: WishlistPhoto) => void;
}

interface Props {
  initial?: WishlistItem;
  budget: number | null;
  currency: string;
  forName?: string;
  submitting: boolean;
  error: string | null;
  photos: WishFormPhotos;
  onSubmit: (data: WishFormResult) => Promise<boolean>;
  onCancel: () => void;
}

function toDefaults(item?: WishlistItem): WishFormValues {
  return {
    title: item?.title ?? '',
    description: item?.description ?? '',
    links: item && item.links.length > 0 ? item.links.map((l) => ({ url: l.url })) : [{ url: '' }],
    brands: item?.brands ?? [],
    priceMin: item?.priceMin != null ? String(item.priceMin) : '',
    priceMax: item?.priceMax != null ? String(item.priceMax) : '',
    priority: String(item?.priority ?? 2) as WishFormValues['priority'],
  };
}

export function WishlistItemForm({ initial, budget, currency, forName, submitting, error, photos, onSubmit, onCancel }: Props) {
  const [savedCount, setSavedCount] = useState(0);
  const [brandDraft, setBrandDraft] = useState('');
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [mode, setMode] = useWishFormMode();
  // Fotos de este regalo que todavía esperan subir en este dispositivo (cuentan para el máximo)
  const queued = useQueuedPhotos(initial?.id);
  const easy = mode === 'easy';
  // Al cambiar un regalo en modo fácil: avisar si tiene datos que ese modo no muestra (se conservan)
  const hasExtras = Boolean(initial && (initial.brands.length > 0 || initial.links.length > 0 || initial.priceMin !== null || initial.priceMax !== null || initial.priority !== 2));
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    setFocus,
    formState: { errors },
  } = useForm<WishFormValues>({ resolver: zodResolver(schema), defaultValues: toDefaults(initial) });
  const { fields, append, remove } = useFieldArray({ control, name: 'links' });
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [ideaTip, setIdeaTip] = useState<string | null>(null);

  const pickIdea = (idea: GiftIdea) => {
    setValue('title', idea.title, { shouldDirty: true, shouldValidate: true });
    // En modo completo también un precio aproximado (en modo fácil no se ve, mejor no llenarlo)
    if (!easy && currency === 'PEN' && !getValues('priceMin').trim() && !getValues('priceMax').trim()) {
      setValue('priceMin', String(idea.min), { shouldDirty: true });
      setValue('priceMax', String(idea.max), { shouldDirty: true });
    }
    setIdeaTip(`${idea.emoji} En «Detalles» cuéntanos: ${idea.detail.charAt(0).toLowerCase()}${idea.detail.slice(1)}.`);
    setIdeasOpen(false);
    setTimeout(() => setFocus('description'), 0);
  };

  // Está sobre el presupuesto si hasta el precio más bajo lo supera
  const lowest = parseMoney(watch('priceMin'));
  const overBudget = budget != null && lowest != null && !Number.isNaN(lowest) && lowest > budget;

  const brands = watch('brands');
  const brandsFull = brands.length >= MAX_BRANDS_PER_ITEM;
  // Acepta varias separadas por coma: "Nike, Adidas"
  const addBrands = () => {
    const next = normalizeBrands([...brands, ...brandDraft.split(',')]).slice(0, MAX_BRANDS_PER_ITEM);
    setValue('brands', next, { shouldDirty: true });
    setBrandDraft('');
  };
  const removeBrand = (brand: string) =>
    setValue(
      'brands',
      brands.filter((b) => b !== brand),
      { shouldDirty: true },
    );

  const submit = async (v: WishFormValues) => {
    const ok = await onSubmit({
      title: v.title,
      description: v.description.trim() || null,
      links: v.links.map((l) => ({ url: normalizeUrl(l.url), label: null })).filter((l) => l.url),
      // Si quedó una marca escrita sin tocar «Agregar», también se guarda
      brands: normalizeBrands([...v.brands, ...brandDraft.split(',')]).slice(0, MAX_BRANDS_PER_ITEM),
      priceMin: parseMoney(v.priceMin),
      priceMax: parseMoney(v.priceMax),
      priority: Number(v.priority) as WishPriority,
      newPhotos,
    });
    if (ok) setNewPhotos([]);
    // Al crear, el formulario queda listo para el siguiente regalo
    if (ok && !initial) {
      reset(toDefaults());
      setBrandDraft('');
      setIdeaTip(null);
      setSavedCount((c) => c + 1);
      setTimeout(() => setFocus('title'), 0);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(submit, (errs) => {
        // Si el error está en un campo que el modo fácil no muestra, se pasa a Completo para verlo
        if (easy && (errs.links || errs.brands || errs.priceMin || errs.priceMax || errs.priority)) setMode('full');
      })}
      className="space-y-5"
      noValidate
    >
      {forName && (
        <p className="text-base text-ink-700">
          Para <strong className="text-ink-900">{forName}</strong>
        </p>
      )}

      {/* Modo fácil: solo qué regalo, detalles y fotos. Completo: también marcas, enlaces, precio y prioridad. */}
      <SegmentedTabs
        label="Cómo quieres llenar el regalo"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'easy', label: 'Modo fácil', icon: <Sparkles className="size-5" aria-hidden /> },
          { value: 'full', label: 'Completo', icon: <ListPlus className="size-5" aria-hidden /> },
        ]}
      />

      {savedCount > 0 && !initial && <Notice tone="success">✅ ¡Regalo guardado! Ya aparece en tu lista. Si quieres, agrega otro aquí.</Notice>}

      {/* Atajo para quien no sabe qué pedir */}
      <div>
        <Button variant="secondary" onClick={() => setIdeasOpen(true)} icon={<Lightbulb className="size-5" aria-hidden />}>
          ¿No sabes qué pedir? Ver ideas
        </Button>
      </div>

      <TextField
        label={easy ? '1. ¿Qué regalo te gustaría?' : '¿Qué regalo te gustaría?'}
        placeholder="ej. Polo, Colonia, Billetera, Juguete"
        enterKeyHint="next"
        autoFocus
        error={errors.title?.message}
        {...register('title')}
      />

      <TextArea
        label={easy ? '2. Detalles' : 'Detalles'}
        optional
        hint={easy ? 'Talla, color, modelo o dónde lo viste.' : 'Talla, color, modelo… lo que nos ayude a acertar.'}
        placeholder="ej. Talla M, color azul"
        error={errors.description?.message}
        {...register('description')}
      />
      {ideaTip && <p className="-mt-3 text-sm font-semibold text-ink-700">{ideaTip}</p>}

      <WishPhotosField
        step={easy ? 3 : undefined}
        status={photos.status}
        existing={initial?.photos ?? []}
        removingId={photos.removingId}
        onRemoveExisting={photos.onRemoveExisting}
        pending={newPhotos}
        onPendingChange={setNewPhotos}
        queued={queued}
      />

      {easy && (
        <div className="space-y-2">
          {hasExtras && (
            <p className="text-sm text-ink-700">Este regalo también tiene marcas, enlaces, precio o prioridad. Se guardan igual; para verlos, toca «Completo».</p>
          )}
          <Button variant="ghost" onClick={() => setMode('full')} icon={<ListPlus className="size-5" aria-hidden />}>
            Agregar marca, enlace o precio
          </Button>
        </div>
      )}

      {!easy && (
        <>
      <fieldset className="space-y-3">
        <legend className="text-base font-bold text-ink-900">
          Marcas que te gustan <span className="font-normal text-ink-500">(opcional)</span>
        </legend>
        <p className="text-sm text-ink-700">Escribe una marca y toca «Agregar». Puedes poner varias. Si no pones ninguna, cualquier marca está bien.</p>
        {brands.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Marcas elegidas">
            {brands.map((brand) => (
              <li key={brand}>
                <span className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-night-900 bg-gold-50 py-1 pl-3 pr-1 text-base font-bold text-night-900">
                  <Tag className="size-4 shrink-0" aria-hidden />
                  {brand}
                  <button
                    type="button"
                    onClick={() => removeBrand(brand)}
                    className="flex size-9 items-center justify-center rounded-full text-berry-700 hover:bg-berry-50"
                    aria-label={`Quitar la marca ${brand}`}
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {brandsFull ? (
          <p className="text-sm text-ink-700">Llegaste al máximo de {MAX_BRANDS_PER_ITEM} marcas.</p>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextField
                label="Marca" enterKeyHint="enter" autoCapitalize="words"
                placeholder="ej. Nike, Adidas, Samsung"
                maxLength={MAX_BRAND_LENGTH * 3}
                value={brandDraft}
                onChange={(e) => setBrandDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // no enviar el formulario
                    addBrands();
                  }
                }}
              />
            </div>
            <Button variant="secondary" onClick={addBrands} disabled={!brandDraft.trim()} icon={<Plus className="size-5" aria-hidden />}>
              Agregar
            </Button>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-ink-900">
          ¿Dónde lo encontramos? <span className="font-normal text-ink-500">(opcional)</span>
        </legend>
        <p className="text-sm text-ink-700">Pega el enlace de la tienda. Puedes poner varios.</p>
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <div className="flex-1">
              <TextField
                label={`Enlace ${index + 1}`} autoCorrect="off" spellCheck={false}
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

      <fieldset className="space-y-2">
        <legend className="text-base font-bold text-ink-900">
          Rango de precio ({currency === 'PEN' ? 'S/' : currency}) <span className="font-normal text-ink-500">(opcional)</span>
        </legend>
        <p className="text-sm text-ink-700">Si sabes el precio exacto, llena solo «Desde».</p>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Desde" inputMode="decimal" placeholder="ej. 50" error={errors.priceMin?.message} {...register('priceMin')} />
          <TextField label="Hasta" inputMode="decimal" placeholder="ej. 80" error={errors.priceMax?.message} {...register('priceMax')} />
        </div>
      </fieldset>
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

        </>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" size="lg" loading={submitting} icon={initial ? <Save className="size-6" aria-hidden /> : <Plus className="size-6" aria-hidden />}>
          {initial ? 'Guardar cambios' : 'Guardar regalo'}
        </Button>
        <Button variant="secondary" size="lg" onClick={onCancel} disabled={submitting}>
          {savedCount > 0 ? 'Listo, terminé' : 'Cancelar'}
        </Button>
      </div>

      {ideasOpen && <GiftIdeasModal budget={budget} currency={currency} onPick={pickIdea} onClose={() => setIdeasOpen(false)} />}
    </form>
  );
}

