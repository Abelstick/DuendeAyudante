import { zodResolver } from '@hookform/resolvers/zod';
import { TreePine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { PublicLayout } from '@/app/layout/PublicLayout';
import { isAppError } from '@/shared/domain/errors';
import { parseMoney } from '@/shared/lib/money';
import { Button } from '@/shared/ui/Button';
import { Card, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { TextArea, TextField } from '@/shared/ui/TextField';
import { isValidPersonName, JOIN_CODE_PATTERN, normalizeJoinCode, suggestJoinCode } from '@/shared/validation/names';
import { useCreateEvent, useJoinCodeChecker } from './hooks';

const nameField = (message: string) => z.string().refine(isValidPersonName, message);

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre para tu Navidad.').max(120),
  joinCode: z
    .string()
    .refine((v) => JOIN_CODE_PATTERN.test(normalizeJoinCode(v)), 'Usa entre 4 y 20 letras o números, sin espacios (ej. GARCIA25).'),
  firstName: nameField('Escribe tu nombre usando solo letras.'),
  paternalSurname: nameField('Escribe tu apellido paterno usando solo letras.'),
  maternalSurname: z.string().refine((v) => !v.trim() || isValidPersonName(v), 'Usa solo letras, o déjalo vacío.'),
  date: z.string().min(1, 'Elige la fecha de la celebración.'),
  time: z.string().min(1, 'Elige la hora de la celebración.'),
  budget: z.string().refine((v) => {
    const n = parseMoney(v);
    return n !== null && n > 0;
  }, 'Escribe el presupuesto solo con números (ej. 65).'),
  description: z.string().max(1000),
});
type FormValues = z.infer<typeof schema>;

export function CreateEventPage() {
  const navigate = useNavigate();
  const createEvent = useCreateEvent();
  const checkCode = useJoinCodeChecker();
  const [formError, setFormError] = useState<string | null>(null);
  const [codeTouched, setCodeTouched] = useState(false);
  const [codeStatus, setCodeStatus] = useState<'unknown' | 'checking' | 'free' | 'taken'>('unknown');
  const year = new Date().getFullYear();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: `Navidad en Familia ${year}`,
      joinCode: suggestJoinCode(`Navidad en Familia`, year),
      firstName: '',
      paternalSurname: '',
      maternalSurname: '',
      date: `${year}-12-24`,
      time: '19:00',
      budget: '65',
      description: '',
    },
  });

  const eventName = watch('name');
  const joinCode = watch('joinCode');

  // Sugiere el código a partir del nombre mientras no lo cambien a mano
  useEffect(() => {
    if (!codeTouched) setValue('joinCode', suggestJoinCode(eventName, year));
  }, [eventName, codeTouched, setValue, year]);

  useEffect(() => setCodeStatus('unknown'), [joinCode]);

  const verifyCode = async () => {
    const code = normalizeJoinCode(joinCode);
    if (!JOIN_CODE_PATTERN.test(code)) return;
    setValue('joinCode', code);
    setCodeStatus('checking');
    try {
      setCodeStatus((await checkCode(code)) ? 'free' : 'taken');
    } catch {
      setCodeStatus('unknown');
    }
  };

  const onSubmit = async (v: FormValues) => {
    setFormError(null);
    try {
      const id = await createEvent.mutateAsync({
        name: v.name,
        joinCode: v.joinCode,
        firstName: v.firstName,
        paternalSurname: v.paternalSurname,
        maternalSurname: v.maternalSurname || null,
        date: v.date,
        time: v.time,
        timezone: 'America/Lima',
        budget: parseMoney(v.budget) ?? 65,
        description: v.description || null,
      });
      navigate(`/e/${id}/organizar`, { replace: true });
    } catch (err) {
      const message = errorMessage(err);
      if (isAppError(err) && err.code === 'JOIN_CODE_TAKEN') setCodeStatus('taken');
      if (isAppError(err) && err.code.startsWith('JOIN_CODE')) setError('joinCode', { message });
      else setFormError(message);
    }
  };

  return (
    <PublicLayout>
      <Card>
        <h1 className="mb-1 text-2xl font-bold text-brand">Crea tu Navidad 🎄</h1>
        <p className="mb-5 text-lg text-ink-700">Solo necesitamos unos datos. Podrás cambiarlos después.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <TextField label="Nombre de la celebración" error={errors.name?.message} {...register('name')} />

          <div className="space-y-2 rounded-2xl border-2 border-gold-400 bg-gold-100/50 p-4">
            <TextField
              label="Código de tu Navidad"
              hint="Tus familiares lo usarán para entrar (va incluido en el mensaje de WhatsApp). Elige una palabra sencilla, sin espacios. No se podrá cambiar después."
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="uppercase tracking-wider"
              error={errors.joinCode?.message}
              {...register('joinCode', { onChange: () => setCodeTouched(true), onBlur: verifyCode })}
            />
            {codeStatus === 'checking' && <p className="text-base text-ink-700">Revisando si está libre…</p>}
            {codeStatus === 'free' && <p className="text-base font-semibold text-brand">✅ ¡Ese código está libre!</p>}
            {codeStatus === 'taken' && (
              <p className="text-base font-semibold text-berry-700">⚠️ Ese código ya lo usa otra Navidad. Agrega un número o una palabra.</p>
            )}
          </div>

          <fieldset className="space-y-4 rounded-2xl bg-cream-50 p-4">
            <legend className="px-1 text-lg font-bold text-brand">¿Quién organiza?</legend>
            <TextField label="Tu nombre" autoComplete="given-name" error={errors.firstName?.message} {...register('firstName')} />
            <TextField label="Tu apellido paterno" autoComplete="family-name" error={errors.paternalSurname?.message} {...register('paternalSurname')} />
            <TextField label="Tu apellido materno" optional error={errors.maternalSurname?.message} {...register('maternalSurname')} />
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <TextField label="Fecha" type="date" error={errors.date?.message} {...register('date')} />
            <TextField label="Hora" type="time" error={errors.time?.message} {...register('time')} />
          </div>

          <TextField
            label="Presupuesto del intercambio (S/)"
            hint="Monto máximo para cada regalo del amigo secreto."
            inputMode="decimal"
            error={errors.budget?.message}
            {...register('budget')}
          />

          <TextArea label="Descripción" optional error={errors.description?.message} {...register('description')} />

          {formError && <Notice tone="error">{formError}</Notice>}

          <Button type="submit" size="lg" loading={createEvent.isPending} icon={<TreePine className="size-6" aria-hidden />}>
            Crear mi Navidad
          </Button>
        </form>
      </Card>
    </PublicLayout>
  );
}
