import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useServices } from '@/app/ContainerContext';
import { PublicLayout } from '@/app/layout/PublicLayout';
import { Button } from '@/shared/ui/Button';
import { Card, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { TextField } from '@/shared/ui/TextField';

const schema = z.object({ email: z.email('Escribe un correo válido.') });
type FormValues = z.infer<typeof schema>;

/** Recuperación por correo: solo para organizadores (los familiares piden una nueva al organizador). */
export function RecoverPage() {
  const { auth } = useServices();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: FormValues) => {
    setFormError(null);
    try {
      await auth.requestPasswordReset(email);
      setDone(true);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <PublicLayout>
      <Card className="space-y-4">
        <h1 className="text-2xl font-extrabold text-ink-900">Recuperar contraseña</h1>
        {done ? (
          <Notice tone="success">Si el correo está registrado, te llegará un enlace para crear una nueva contraseña.</Notice>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <TextField label="Tu correo de organizador" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            {formError && <Notice tone="error">{formError}</Notice>}
            <Button type="submit" size="lg" loading={isSubmitting}>
              Enviarme el enlace
            </Button>
          </form>
        )}
        <Link to="/entrar" className="inline-block min-h-12 text-base font-semibold text-brand underline">
          Volver a Entrar
        </Link>
      </Card>
    </PublicLayout>
  );
}
