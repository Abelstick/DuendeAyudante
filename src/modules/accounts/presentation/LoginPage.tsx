import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/app/AuthContext';
import { useServices } from '@/app/ContainerContext';
import { PublicLayout } from '@/app/layout/PublicLayout';
import { Button } from '@/shared/ui/Button';
import { Card, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { TextField } from '@/shared/ui/TextField';
import { JOIN_CODE_PATTERN, normalizeJoinCode } from '@/shared/validation/names';

const LAST_CODE_KEY = 'nf-last-code';

function readLastCode(): string {
  try {
    return localStorage.getItem(LAST_CODE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveLastCode(code: string) {
  try {
    localStorage.setItem(LAST_CODE_KEY, code);
  } catch {
    // modo privado: no se recuerda
  }
}

const schema = z
  .object({
    mode: z.enum(['family', 'organizer']),
    code: z.string(),
    user: z.string().trim(),
    password: z.string().min(1, 'Escribe tu contraseña.'),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'family') {
      if (!JOIN_CODE_PATTERN.test(normalizeJoinCode(v.code))) {
        ctx.addIssue({ code: 'custom', path: ['code'], message: 'Escribe el código de tu Navidad (está en el mensaje de WhatsApp).' });
      }
      if (!v.user) ctx.addIssue({ code: 'custom', path: ['user'], message: 'Escribe tu usuario (está en el mensaje de WhatsApp).' });
    } else if (!v.user.includes('@')) {
      ctx.addIssue({ code: 'custom', path: ['user'], message: 'Escribe tu correo (ej. nombre@gmail.com).' });
    }
  });
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { auth } = useServices();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  // Por defecto la contraseña se ve: a las personas mayores les cuesta escribir "a ciegas".
  const [showPassword, setShowPassword] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const codeFromLink = params.get('c') ?? '';
  const userFromLink = params.get('u') ?? '';
  const prefilled = Boolean(codeFromLink && userFromLink);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: params.get('modo') === 'organizador' ? 'organizer' : 'family',
      code: codeFromLink || readLastCode(),
      user: userFromLink,
      password: '',
    },
  });
  const mode = watch('mode');

  if (user) return <Navigate to="/" replace />;

  const switchMode = (next: FormValues['mode']) => {
    setValue('mode', next);
    setValue('user', next === 'family' ? userFromLink : '');
    clearErrors();
    setFormError(null);
  };

  const onSubmit = async (v: FormValues) => {
    setFormError(null);
    try {
      const code = v.mode === 'family' ? normalizeJoinCode(v.code) : null;
      await auth.signIn({ eventCode: code, user: v.user, password: v.password });
      if (code) saveLastCode(code);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/', { replace: true });
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <PublicLayout>
      <Card>
        <h1 className="mb-1 text-2xl font-extrabold text-ink-900">Entrar</h1>
        <p className="mb-5 text-lg text-ink-700">
          {mode === 'organizer'
            ? 'Escribe el correo y la contraseña con los que creaste tu Navidad.'
            : prefilled
              ? 'Solo escribe tu contraseña y toca «Entrar».'
              : 'Escribe los datos que te enviaron por WhatsApp.'}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {mode === 'family' ? (
            <>
              <TextField
                label="Código de tu Navidad" enterKeyHint="next"
                placeholder="ej. GARCIA25"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="uppercase tracking-wider"
                error={errors.code?.message}
                {...register('code')}
              />
              <TextField
                label="Usuario" enterKeyHint="next"
                placeholder="ej. rosa"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                error={errors.user?.message}
                {...register('user')}
              />
            </>
          ) : (
            <TextField label="Correo" enterKeyHint="next" type="email" autoComplete="email" error={errors.user?.message} {...register('user')} />
          )}

          <TextField
            label="Contraseña" enterKeyHint="go"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={prefilled}
            error={errors.password?.message}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="flex min-h-13 min-w-24 items-center justify-center gap-1 rounded-xl border-2 border-mist-300 bg-surface px-3 text-base font-semibold text-brand-ink"
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            }
            {...register('password')}
          />

          {formError && <Notice tone="error">{formError}</Notice>}

          <Button type="submit" size="lg" loading={isSubmitting} icon={<LogIn className="size-6" aria-hidden />}>
            Entrar
          </Button>
        </form>

        <div className="mt-6 space-y-2 border-t border-mist-200 pt-4">
          <button type="button" className="block min-h-12 text-base font-semibold text-brand-ink underline" onClick={() => setShowHelp((v) => !v)}>
            ¿Olvidaste tu contraseña?
          </button>
          {showHelp && (
            <div className="space-y-2 text-base text-ink-700">
              <p>Pídele una nueva a la persona que organiza tu Navidad. Te la enviará por WhatsApp.</p>
              <p>
                Si eres organizador y entras con tu correo,{' '}
                <Link to="/recuperar" className="font-semibold text-brand-ink underline">
                  recupera tu contraseña aquí
                </Link>
                .
              </p>
            </div>
          )}
          <button
            type="button"
            className="block min-h-12 text-base font-semibold text-brand-ink underline"
            onClick={() => switchMode(mode === 'family' ? 'organizer' : 'family')}
          >
            {mode === 'family' ? 'Soy organizador: entrar con mi correo' : 'Soy familiar: entrar con código y usuario'}
          </button>
        </div>
      </Card>
    </PublicLayout>
  );
}
