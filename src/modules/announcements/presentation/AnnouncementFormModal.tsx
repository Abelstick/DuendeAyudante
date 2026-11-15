import { zodResolver } from '@hookform/resolvers/zod';
import { Megaphone, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { TextArea, TextField } from '@/shared/ui/TextField';
import type { Announcement, AnnouncementPriority } from '../domain/Announcement';
import { useAnnouncementMutations } from './hooks';

const schema = z.object({
  title: z.string().trim().min(1, 'Escribe un título corto (ej. Cambio de horario).').max(120, 'Usa un título más corto.'),
  body: z.string().trim().min(1, 'Escribe el mensaje del anuncio.').max(2000, 'El mensaje es muy largo.'),
});
type FormValues = z.infer<typeof schema>;

export function AnnouncementFormModal({ eventId, initial, onClose }: { eventId: string; initial: Announcement | null; onClose: () => void }) {
  const { save, remove } = useAnnouncementMutations(eventId);
  const toast = useToast();
  const [priority, setPriority] = useState<AnnouncementPriority>(initial?.priority ?? 'normal');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { title: initial?.title ?? '', body: initial?.body ?? '' } });
  const formId = 'announcement-form';

  const onSubmit = async (v: FormValues) => {
    setFormError(null);
    try {
      await save.mutateAsync({ id: initial?.id ?? null, eventId, title: v.title, body: v.body, priority });
      toast.success(initial ? 'Anuncio actualizado.' : '¡Anuncio publicado! Ya lo ven todos. 📢');
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    try {
      await remove.mutateAsync(initial.id);
      toast.success('Anuncio quitado.');
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={initial ? 'Editar anuncio' : 'Nuevo anuncio'}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            form={formId}
            size="lg"
            loading={save.isPending}
            icon={initial ? <Save className="size-6" aria-hidden /> : <Megaphone className="size-6" aria-hidden />}
          >
            {initial ? 'Guardar cambios' : 'Publicar'}
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <TextField label="Título" placeholder="ej. Cambio de horario" autoFocus error={errors.title?.message} {...register('title')} />
        <TextArea label="Mensaje" rows={5} placeholder="ej. La cena empieza a las 8:30 p. m." error={errors.body?.message} {...register('body')} />
        <fieldset>
          <legend className="mb-2 text-base font-semibold">¿Es importante?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['normal', '📝 Normal'],
                ['important', '⚠️ Importante (sale primero en Inicio)'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={priority === value}
                onClick={() => setPriority(value)}
                className={`min-h-13 rounded-xl border-2 px-3 text-base font-semibold ${
                  priority === value ? 'border-brand bg-brand text-white' : 'border-mist-200 bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {formError && <Notice tone="error">{formError}</Notice>}

        {initial && (
          <div className="border-t border-mist-200 pt-4">
            {confirmingDelete ? (
              <div className="space-y-2 rounded-xl bg-berry-50 p-3" role="alert">
                <p className="font-semibold text-berry-700">¿Quitar este anuncio?</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="danger" loading={remove.isPending} onClick={onDelete}>
                    Sí, quitar
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                    No
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmingDelete(true)} icon={<Trash2 className="size-5" aria-hidden />} className="text-berry-700! hover:bg-berry-50!">
                Quitar anuncio
              </Button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
