import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useServices } from '@/app/ContainerContext';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';
import { TextField } from '@/shared/ui/TextField';

const schema = z
  .object({
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las dos contraseñas no son iguales. Escríbelas de nuevo.' });
type FormValues = z.infer<typeof schema>;

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { auth } = useServices();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }: FormValues) => {
    setFormError(null);
    try {
      await auth.changePassword(password);
      reset();
      toast.success('¡Listo! Tu contraseña fue cambiada.');
      onDone?.();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <TextField label="Nueva contraseña" type="text" autoComplete="new-password" autoCapitalize="none" error={errors.password?.message} {...register('password')} />
      <TextField label="Escríbela otra vez" type="text" autoComplete="new-password" autoCapitalize="none" error={errors.confirm?.message} {...register('confirm')} />
      {formError && <Notice tone="error">{formError}</Notice>}
      <Button type="submit" loading={isSubmitting} icon={<KeyRound className="size-5" aria-hidden />}>
        Guardar nueva contraseña
      </Button>
    </form>
  );
}
