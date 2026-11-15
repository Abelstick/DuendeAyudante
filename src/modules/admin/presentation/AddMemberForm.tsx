import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useEventScope } from '@/app/layout/EventLayout';
import type { EventRole } from '@/modules/events/domain/Event';
import { FAMILY_COLORS, type Family } from '@/modules/families/domain/Family';
import type { AssignableRole } from '@/modules/members/domain/IMemberAccountService';
import { displayName, type Member } from '@/modules/members/domain/Participant';
import { useMemberMutations } from '@/modules/members/presentation/hooks';
import { isAppError } from '@/shared/domain/errors';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';
import { TextField } from '@/shared/ui/TextField';
import { fullName, generateFriendlyPassword, isValidPersonName, suggestUsername, USERNAME_PATTERN } from '@/shared/validation/names';
import { AccessCard } from './AccessCard';

const schema = z
  .object({
    firstName: z.string().refine(isValidPersonName, 'Escribe el nombre usando solo letras.'),
    paternalSurname: z.string().refine(isValidPersonName, 'Escribe el apellido paterno usando solo letras.'),
    maternalSurname: z.string().refine((v) => !v.trim() || isValidPersonName(v), 'Usa solo letras, o déjalo vacío.'),
    distinguishingNote: z.string().max(40, 'Usa una o dos palabras.'),
    hasAccount: z.enum(['yes', 'no']),
    username: z.string(),
    password: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.hasAccount !== 'yes') return;
    if (!USERNAME_PATTERN.test(v.username.trim().toLowerCase())) {
      ctx.addIssue({ code: 'custom', path: ['username'], message: 'Entre 2 y 30 letras o números, sin espacios ni tildes (ej. rosa).' });
    }
    if (v.password.length < 8) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Al menos 8 caracteres.' });
  });
type FormValues = z.infer<typeof schema>;

const ROLE_OPTIONS: { value: AssignableRole; label: string; help: string }[] = [
  { value: 'participant', label: 'Participante', help: 'Agrega sus regalos y ve las actividades.' },
  { value: 'editor', label: 'Editor', help: 'Ayuda a organizar: responsabilidades, cronograma y juegos.' },
  { value: 'admin', label: 'Administrador', help: 'Igual que tú: también crea usuarios y contraseñas.' },
];

interface Props {
  families: Family[];
  members: Member[];
  myRole: EventRole;
}

export function AddMemberForm({ families, members, myRole }: Props) {
  const { event } = useEventScope();
  const { add } = useMemberMutations(event.id);
  const toast = useToast();
  const [familyId, setFamilyId] = useState<string | null>(families[0]?.id ?? null);
  const [role, setRole] = useState<AssignableRole>('participant');
  const [guardianIds, setGuardianIds] = useState<string[]>([]);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ firstName: string; username: string; password: string } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      paternalSurname: '',
      maternalSurname: '',
      distinguishingNote: '',
      hasAccount: 'yes',
      username: '',
      password: generateFriendlyPassword(),
    },
  });

  const [firstName, paternal, hasAccount] = watch(['firstName', 'paternalSurname', 'hasAccount']);
  const takenUsernames = useMemo(() => new Set(members.map((m) => m.username).filter((u): u is string => Boolean(u))), [members]);

  // Sugiere un usuario corto y libre en esta Navidad ("rosa", "rosa.garcia", "rosa2"…)
  useEffect(() => {
    if (!usernameTouched) setValue('username', firstName || paternal ? suggestUsername(firstName, paternal, takenUsernames) : '');
  }, [firstName, paternal, usernameTouched, setValue, takenUsernames]);

  // Si la familia elegida se borra, se limpia la selección
  useEffect(() => {
    if (familyId && !families.some((f) => f.id === familyId)) setFamilyId(families[0]?.id ?? null);
  }, [families, familyId]);

  const possibleGuardians = members.filter((m) => m.hasAccount && m.status === 'active');

  const onSubmit = async (v: FormValues) => {
    setFormError(null);
    try {
      const result = await add.mutateAsync({
        eventId: event.id,
        firstName: v.firstName,
        paternalSurname: v.paternalSurname,
        maternalSurname: v.maternalSurname || null,
        distinguishingNote: v.distinguishingNote || null,
        familyId,
        role: v.hasAccount === 'yes' ? role : 'participant',
        account: v.hasAccount === 'yes' ? { username: v.username, password: v.password, autoSuffix: !usernameTouched } : null,
        guardianParticipantIds: guardianIds,
      });

      if (result.username) {
        setCreated({ firstName: v.firstName, username: result.username, password: v.password });
      } else {
        toast.success(`${result.fullName} fue agregado. Sus regalos los manejarán sus familiares.`);
      }
      reset({ ...v, firstName: '', maternalSurname: '', distinguishingNote: '', username: '', password: generateFriendlyPassword() });
      setUsernameTouched(false);
      setShowNote(false);
      setGuardianIds([]);
      setRole('participant');
      setTimeout(() => setFocus('firstName'), 0);
    } catch (err) {
      if (isAppError(err) && err.code === 'DUPLICATE_NAME') setShowNote(true);
      if (isAppError(err) && err.code === 'USERNAME_TAKEN' && typeof err.details.suggestion === 'string') {
        setValue('username', err.details.suggestion);
      }
      setFormError(errorMessage(err));
    }
  };

  const preview = fullName(firstName, paternal, watch('maternalSurname'));

  return (
    <div className="space-y-4">
      {created && (
        <div className="space-y-2">
          <Notice tone="success">✅ ¡{fullName(created.firstName, '')} ya tiene su usuario! Envíale su acceso:</Notice>
          <AccessCard firstName={created.firstName} username={created.username} password={created.password} onClose={() => setCreated(null)} />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 rounded-3xl bg-cream-50 p-4" noValidate>
        <h3 className="text-lg font-bold text-pine-900">Agregar a un familiar</h3>

        <TextField label="Nombre" autoComplete="off" error={errors.firstName?.message} {...register('firstName')} />
        <TextField label="Apellido paterno" autoComplete="off" error={errors.paternalSurname?.message} {...register('paternalSurname')} />
        <TextField label="Apellido materno" optional autoComplete="off" error={errors.maternalSurname?.message} {...register('maternalSurname')} />
        {preview && (
          <p className="text-base text-ink-700">
            Se guardará como: <strong>{preview}</strong>
          </p>
        )}

        {showNote ? (
          <TextField
            label="Dato para diferenciar"
            hint="Hay otra persona con el mismo nombre. Escribe algo que los distinga, por ejemplo HIJO, MADRE o DE AREQUIPA."
            error={errors.distinguishingNote?.message}
            {...register('distinguishingNote')}
          />
        ) : (
          <button type="button" className="min-h-12 text-base font-semibold text-pine-800 underline" onClick={() => setShowNote(true)}>
            ¿Hay otra persona con el mismo nombre?
          </button>
        )}

        {families.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-base font-semibold">Familia</legend>
            <div className="flex flex-wrap gap-2">
              {families.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={familyId === f.id}
                  onClick={() => setFamilyId(f.id)}
                  className={`flex min-h-12 items-center gap-2 rounded-full border-2 px-4 text-base font-semibold ${
                    familyId === f.id ? 'border-ink-900 ring-2 ring-gold-400' : 'border-cream-200'
                  }`}
                  style={{ backgroundColor: FAMILY_COLORS[f.color].soft, color: FAMILY_COLORS[f.color].text }}
                >
                  <span className="size-3 rounded-full" style={{ backgroundColor: FAMILY_COLORS[f.color].swatch }} aria-hidden />
                  {familyId === f.id ? '✓ ' : ''}
                  {f.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className="mb-2 text-base font-semibold">¿Tendrá su propio usuario?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['yes', 'Sí, entrará desde su teléfono'],
                ['no', 'No, sus familiares manejarán sus regalos'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" value={value} className="peer sr-only" {...register('hasAccount')} />
                <span className="flex min-h-14 items-center rounded-2xl border-2 border-cream-200 bg-white px-4 text-base font-semibold peer-checked:border-pine-700 peer-checked:bg-pine-700 peer-checked:text-white">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {hasAccount === 'yes' && (
          <div className="space-y-4 rounded-2xl border-2 border-cream-200 bg-white p-4">
            <TextField
              label="Usuario"
              hint="Corto y fácil (ej. rosa). Si ya hay otra persona con ese usuario en tu Navidad, agrega el apellido o un número."
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              error={errors.username?.message}
              {...register('username', { onChange: () => setUsernameTouched(true) })}
            />
            <TextField
              label="Contraseña"
              hint="Fácil de dictar por teléfono. Puedes escribir otra."
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              error={errors.password?.message}
              trailing={
                <button
                  type="button"
                  onClick={() => setValue('password', generateFriendlyPassword(), { shouldValidate: true })}
                  className="flex min-h-13 min-w-13 items-center justify-center rounded-xl border-2 border-cream-200 bg-white text-pine-800"
                  aria-label="Generar otra contraseña"
                  title="Generar otra contraseña"
                >
                  <RefreshCw className="size-6" aria-hidden />
                </button>
              }
              {...register('password')}
            />
            <fieldset>
              <legend className="mb-2 text-base font-semibold">¿Qué podrá hacer?</legend>
              <div className="space-y-2">
                {ROLE_OPTIONS.filter((o) => o.value !== 'admin' || myRole === 'owner').map((o) => (
                  <label
                    key={o.value}
                    className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 ${
                      role === o.value ? 'border-pine-700 bg-pine-50' : 'border-cream-200'
                    }`}
                  >
                    <input type="radio" name="role" className="mt-1 size-5 accent-pine-700" checked={role === o.value} onChange={() => setRole(o.value)} />
                    <span>
                      <span className="block font-semibold">{o.label}</span>
                      <span className="block text-sm text-ink-700">{o.help}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {possibleGuardians.length > 0 && (
          <fieldset>
            <legend className="mb-1 text-base font-semibold">
              {hasAccount === 'no' ? '¿Quién manejará sus regalos?' : '¿Algún familiar también podrá manejar sus regalos?'}{' '}
              <span className="font-normal text-ink-500">(opcional)</span>
            </legend>
            <p className="mb-2 text-sm text-ink-700">Por ejemplo, su papá o su mamá.</p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {possibleGuardians.map((m) => (
                <label key={m.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-cream-200 bg-white px-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-pine-700"
                    checked={guardianIds.includes(m.id)}
                    onChange={(e) => setGuardianIds((ids) => (e.target.checked ? [...ids, m.id] : ids.filter((id) => id !== m.id)))}
                  />
                  <span className="text-base">{displayName(m)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {formError && <Notice tone="error">{formError}</Notice>}

        <Button type="submit" size="lg" loading={add.isPending} icon={<UserPlus className="size-6" aria-hidden />}>
          {hasAccount === 'yes' ? 'Agregar y crear su usuario' : 'Agregar familiar'}
        </Button>
      </form>
    </div>
  );
}
