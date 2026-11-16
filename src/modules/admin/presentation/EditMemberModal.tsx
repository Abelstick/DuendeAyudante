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
  /** Todos los integrantes: de aquí se eligen quienes pueden ayudarle con sus regalos. */
  members: Member[];
  families: Family[];
  onClose: () => void;
}

/**
 * Ventana para corregir los datos de un familiar: nombre, apellidos, dato para diferenciar,
 * familia y quién puede ayudarle con sus regalos desde su propia cuenta.
 */
export function EditMemberModal({ member, members, families, onClose }: Props) {
  const { event } = useEventScope();
  const { update, setGuardians } = useMemberMutations(event.id);
  const [guardianIds, setGuardianIds] = useState<string[]>(member.guardianIds);
  // Puede ayudar cualquiera con usuario propio (y quien ya estaba elegido, aunque ya no cumpla)
  const possibleGuardians = members.filter((m) => m.id !== member.id && ((m.hasAccount && m.status === 'active') || member.guardianIds.includes(m.id)));
  const guardiansChanged = guardianIds.length !== member.guardianIds.length || guardianIds.some((id) => !member.guardianIds.includes(id));
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
      if (isDirty) {
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
      }
      if (guardiansChanged) await setGuardians.mutateAsync({ participantId: member.id, guardianIds });
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
        <TextField label="Nombre" enterKeyHint="next" autoCapitalize="words" autoComplete="off" error={errors.firstName?.message} {...register('firstName')} />
        <TextField label="Apellido paterno" enterKeyHint="next" autoCapitalize="words" autoComplete="off" error={errors.paternalSurname?.message} {...register('paternalSurname')} />
        <TextField label="Apellido materno" enterKeyHint="next" autoCapitalize="words" optional autoComplete="off" error={errors.maternalSurname?.message} {...register('maternalSurname')} />
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

        {possibleGuardians.length > 0 && (
          <fieldset>
            <legend className="mb-1 text-base font-bold text-ink-900">
              ¿Quién puede ayudarle con sus regalos? <span className="font-normal text-ink-500">(opcional)</span>
            </legend>
            <p className="mb-2 text-sm text-ink-700">
              Las personas que marques podrán agregar y cambiar sus regalos desde su propia cuenta, sin cerrar sesión. Por ejemplo, su mamá, su papá o un hijo.
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {possibleGuardians.map((m) => (
                <label key={m.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-mist-300 bg-white px-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-brand"
                    checked={guardianIds.includes(m.id)}
                    onChange={(e) => setGuardianIds((ids) => (e.target.checked ? [...ids, m.id] : ids.filter((id) => id !== m.id)))}
                  />
                  <span className="text-base">{displayName(m)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {member.username && (
          <p className="text-sm text-ink-700">
            Su usuario (<strong className="text-ink-900">{member.username}</strong>) y su contraseña no cambian.
          </p>
        )}

        {formError && <Notice tone="error">{formError}</Notice>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" loading={update.isPending || setGuardians.isPending} disabled={!isDirty && !guardiansChanged} icon={<Save className="size-5" aria-hidden />}>
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
