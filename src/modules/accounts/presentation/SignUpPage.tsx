import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/app/AuthContext';
import { useServices } from '@/app/ContainerContext';
import { PublicLayout } from '@/app/layout/PublicLayout';
import { Button } from '@/shared/ui/Button';
import { Card, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { TextField } from '@/shared/ui/TextField';

const schema = z.object({
  email: z.email('Escribe un correo válido (ej. nombre@gmail.com).'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});
type FormValues = z.infer<typeof schema>;

/** Registro del ORGANIZADOR (los familiares no se registran: el organizador los crea). */
export function SignUpPage() {
  const { auth } = useServices();
  const { user } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      const result = await auth.signUpOrganizer(values.email, values.password);
      if (result.needsEmailConfirmation) setSentTo(values.email);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  if (sentTo) {
    return (
      <PublicLayout>
        <Card className="space-y-3 text-center">
          <p className="text-5xl" aria-hidden>
            📬
          </p>
          <h1 className="text-2xl font-extrabold text-ink-900">Revisa tu correo</h1>
          <p className="text-lg text-ink-700">
            Te enviamos un enlace a <strong>{sentTo}</strong>. Ábrelo para confirmar tu cuenta y luego entra.
          </p>
          <Link to="/entrar?modo=organizador" className="inline-block min-h-12 text-lg font-semibold text-brand underline">
            Ir a Entrar
          </Link>
        </Card>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <Card>
        <h1 className="mb-1 text-2xl font-extrabold text-ink-900">Crear mi Navidad</h1>
        <p className="mb-5 text-lg text-ink-700">
          Primero crea tu cuenta de organizador. Después podrás agregar a tu familia; ellos no necesitan correo.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <TextField label="Tu correo" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <TextField
            label="Crea una contraseña"
            hint="Al menos 8 caracteres."
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          {formError && <Notice tone="error">{formError}</Notice>}
          <Button type="submit" size="lg" loading={isSubmitting} icon={<Sparkles className="size-6" aria-hidden />}>
            Crear mi cuenta
          </Button>
        </form>
        <p className="mt-5 text-center text-base">
          ¿Ya tienes cuenta?{' '}
          <Link to="/entrar?modo=organizador" className="font-semibold text-brand underline">
            Entrar
          </Link>
        </p>
      </Card>
    </PublicLayout>
  );
}
