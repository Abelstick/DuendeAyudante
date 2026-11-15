import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useEventScope } from '@/app/layout/EventLayout';
import type { Family } from '@/modules/families/domain/Family';
import { displayName, type Member } from '@/modules/members/domain/Participant';
import { useMemberMutations } from '@/modules/members/presentation/hooks';
import { isAppError } from '@/shared/domain/errors';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { selectClasses } from '@/shared/ui/Tabs';
import { TextField } from '@/shared/ui/TextField';
import { useToast } from '@/shared/ui/Toast';
import { fullName, isValidPersonName } from '@/shared/validation/names';

const schema = z.object({
  firstName: z.string().refine(isValidPersonName, 'Escribe el nombre usando solo letras.'),
  paternalSurname: z.string().refine(isValidPersonName, 'Escribe el apellido paterno usando solo letras.'),
  maternalSurname: z.string().refine((v) => !v.trim() || isValidPersonName(v), 'Usa solo letras, o déjalo vacío.'),
  distinguishingNote: z.string().max(40, 'Usa una o dos palabras.'),
  familyId: z.string(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  member: Member;
  families: Family[];
  onClose: () => void;
}

/** Ventana para corregir los datos de un familiar: nombre, apellidos, dato para diferenciar y familia. */
export function EditMemberModal({ member, families, onClose }: Props) {
  const { event } = useEventScope();
  const { update } = useMemberMutations(event.id);
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: member.firstName,
      paternalSurname: member.paternalSurname,
      maternalSurname: member.maternalSurname ?? '',
      distinguishingNote: member.distinguishingNote ?? '',
      familyId: member.familyId ?? '',
    },
  });

  const onSubmit = async (v: FormValues) => {
    setFormError(null);
    try {
      await update.mutateAsync({
        participantId: member.id,
        details: {
          firstName: v.firstName,
          paternalSurname: v.paternalSurname,
          maternalSurname: v.maternalSurname || null,
          distinguishingNote: v.distinguishingNote || null,
          familyId: v.familyId || null,
        },
      });
      toast.success('Datos actualizados.');
      onClose();
    } catch (err) {
      if (isAppError(err) && err.code === 'DUPLICATE_NAME') setFocus('distinguishingNote');
      setFormError(errorMessage(err));
    }
  };

  const preview = fullName(watch('firstName'), watch('paternalSurname'), watch('maternalSurname'));

  return (
    <Modal open title={`Editar a ${displayName(member)}`} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <TextField label="Nombre" autoComplete="off" error={errors.firstName?.message} {...register('firstName')} />
        <TextField label="Apellido paterno" autoComplete="off" error={errors.paternalSurname?.message} {...register('paternalSurname')} />
        <TextField label="Apellido materno" optional autoComplete="off" error={errors.maternalSurname?.message} {...register('maternalSurname')} />
        {preview && (
          <p className="text-base text-ink-700">
            Se guardará como: <strong>{preview}</strong>
          </p>
        )}
        <TextField
          label="Dato para diferenciar"
          optional
          hint="Solo si hay otra persona con el mismo nombre, por ejemplo HIJO o MADRE."
          autoComplete="off"
          error={errors.distinguishingNote?.message}
          {...register('distinguishingNote')}
        />

        {families.length > 0 && (
          <label className="flex flex-col gap-1.5 text-base font-bold text-ink-900">
            Familia
            <select className={selectClasses} {...register('familyId')}>
              <option value="">Sin familia</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {member.username && (
          <p className="text-sm text-ink-700">
            Su usuario (<strong className="text-ink-900">{member.username}</strong>) y su contraseña no cambian.
          </p>
        )}

        {formError && <Notice tone="error">{formError}</Notice>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" loading={update.isPending} disabled={!isDirty} icon={<Save className="size-5" aria-hidden />}>
            Guardar cambios
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
