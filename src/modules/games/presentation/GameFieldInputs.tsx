import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { z } from 'zod';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { TextArea, TextField } from '@/shared/ui/TextField';
import { CATEGORY_LABELS, type Game, type GameCategory, type GameFields } from '../domain/Game';

const intField = z.string().refine((v) => !v.trim() || /^\d{1,3}$/.test(v.trim()), 'Escribe solo números (ej. 15).');

export const gameFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Escribe el nombre del juego o actividad.').max(100, 'Usa un nombre más corto.'),
    category: z.enum(['competition', 'family_bonding', 'board', 'movement', 'trivia_challenges', 'kids', 'adults']),
    description: z.string().max(1000, 'La descripción es muy larga.'),
    duration: intField,
    minPlayers: intField,
    maxPlayers: intField,
    materials: z.string().max(1000, 'Es muy largo.'),
    instructions: z.string().max(3000, 'Las instrucciones son muy largas.'),
    responsibleId: z.string(),
  })
  .refine((v) => !v.minPlayers.trim() || !v.maxPlayers.trim() || Number(v.minPlayers) <= Number(v.maxPlayers), {
    path: ['maxPlayers'],
    message: 'El máximo debe ser mayor o igual que el mínimo.',
  });

export type GameFormValues = z.infer<typeof gameFormSchema>;

const toInt = (v: string) => (v.trim() ? Number(v.trim()) : null);

export function formToFields(v: GameFormValues): GameFields {
  return {
    name: v.name,
    category: v.category as GameCategory,
    description: v.description || null,
    durationMinutes: toInt(v.duration),
    minPlayers: toInt(v.minPlayers),
    maxPlayers: toInt(v.maxPlayers),
    materials: v.materials || null,
    instructions: v.instructions || null,
    responsibleId: v.responsibleId || null,
  };
}

export function fieldsToForm(f: Partial<GameFields> | Game | null): GameFormValues {
  return {
    name: f?.name ?? '',
    category: (f?.category ?? 'family_bonding') as GameFormValues['category'],
    description: f?.description ?? '',
    duration: f?.durationMinutes != null ? String(f.durationMinutes) : '',
    minPlayers: f?.minPlayers != null ? String(f.minPlayers) : '',
    maxPlayers: f?.maxPlayers != null ? String(f.maxPlayers) : '',
    materials: f?.materials ?? '',
    instructions: f?.instructions ?? '',
    responsibleId: f?.responsibleId ?? '',
  };
}

interface Props {
  register: UseFormRegister<GameFormValues>;
  errors: FieldErrors<GameFormValues>;
  participants: Participant[];
  /** Se muestra debajo del nombre (aviso de juegos parecidos). */
  afterName?: React.ReactNode;
  autoFocus?: boolean;
}

export function GameFieldInputs({ register, errors, participants, afterName, autoFocus = true }: Props) {
  return (
    <>
      <div className="space-y-2">
        <TextField label="Nombre del juego o actividad" enterKeyHint="next" placeholder="ej. Charadas navideñas" autoFocus={autoFocus} error={errors.name?.message} {...register('name')} />
        {afterName}
      </div>

      <fieldset>
        <legend className="mb-2 text-base font-semibold">Tipo</legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CATEGORY_LABELS) as GameCategory[]).map((c) => (
            <label key={c} className="relative cursor-pointer">
              <input type="radio" value={c} className="peer sr-only" {...register('category')} />
              <span className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-mist-300 bg-white px-3 text-base font-semibold peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-gold-400">
                <span aria-hidden>{CATEGORY_LABELS[c].emoji}</span> {CATEGORY_LABELS[c].label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <TextArea label="¿De qué se trata?" optional rows={2} error={errors.description?.message} {...register('description')} />

      <div className="grid grid-cols-3 gap-2">
        <TextField label="Minutos" optional inputMode="numeric" placeholder="15" error={errors.duration?.message} {...register('duration')} />
        <TextField label="Mín. personas" optional inputMode="numeric" placeholder="2" error={errors.minPlayers?.message} {...register('minPlayers')} />
        <TextField label="Máx. personas" optional inputMode="numeric" placeholder="20" error={errors.maxPlayers?.message} {...register('maxPlayers')} />
      </div>

      <TextArea label="Materiales" optional rows={2} placeholder="ej. Papelitos, un sombrero" error={errors.materials?.message} {...register('materials')} />
      <TextArea label="¿Cómo se juega?" optional rows={4} placeholder="Explica las reglas paso a paso" error={errors.instructions?.message} {...register('instructions')} />

      <label className="flex flex-col gap-1.5 text-base font-semibold">
        <span>
          ¿Quién lo dirige? <span className="font-normal text-ink-500">(opcional)</span>
        </span>
        <select {...register('responsibleId')} className="min-h-13 w-full rounded-xl border-2 border-mist-300 bg-white px-3 text-lg font-normal text-ink-900">
          <option value="">Todavía nadie</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {displayName(p)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
