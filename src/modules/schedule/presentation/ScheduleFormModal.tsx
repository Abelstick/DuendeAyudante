import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { instantToZonedParts, zonedDateTimeToInstant } from '@/shared/lib/datetime';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { TextArea, TextField } from '@/shared/ui/TextField';
import { SCHEDULE_STATUS_LABELS, type ScheduleItem, type ScheduleStatus } from '../domain/Schedule';
import { useScheduleMutations } from './hooks';

const schema = z.object({
  title: z.string().trim().min(1, 'Escribe el nombre de la actividad (ej. Cena navideña).').max(120, 'Usa un nombre más corto.'),
  date: z.string().min(1, 'Elige el día.'),
  start: z.string().min(1, 'Elige la hora de inicio.'),
  end: z.string(),
  description: z.string().max(1000, 'Es muy largo.'),
  responsibleId: z.string(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  eventId: string;
  timezone: string;
  celebrationAt: Date;
  initial: ScheduleItem | null;
  participants: Participant[];
  onClose: () => void;
}

export function ScheduleFormModal({ eventId, timezone, celebrationAt, initial, participants, onClose }: Props) {
  const { save, remove } = useScheduleMutations(eventId);
  const toast = useToast();
  const [status, setStatus] = useState<ScheduleStatus>(initial?.status ?? 'pending');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const start = instantToZonedParts(initial?.startsAt ?? celebrationAt, timezone);
  const end = initial?.endsAt ? instantToZonedParts(initial.endsAt, timezone) : null;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title ?? '',
      date: start.date,
      start: start.time,
      end: end?.time ?? '',
      description: initial?.description ?? '',
      responsibleId: initial?.responsibleId ?? '',
    },
  });
  const formId = 'schedule-form';

  const onSubmit = async (v: FormValues) => {
    setFormError(null);
    const startsAt = zonedDateTimeToInstant(v.date, v.start, timezone);
    let endsAt = v.end ? zonedDateTimeToInstant(v.date, v.end, timezone) : null;
    // Si termina "antes" de empezar, es que pasa de medianoche (ej. 11 p. m. → 1 a. m.)
    if (endsAt && endsAt < startsAt) endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
    try {
      await save.mutateAsync({
        id: initial?.id ?? null,
        eventId,
        title: v.title,
        description: v.description || null,
        startsAt,
        endsAt,
        responsibleId: v.responsibleId || null,
        status,
      });
      toast.success(initial ? 'Cronograma actualizado.' : 'Actividad agregada al cronograma.');
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    try {
      await remove.mutateAsync(initial.id);
      toast.success(`Quitamos «${initial.title}» del cronograma.`);
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={initial ? 'Editar actividad' : 'Nueva actividad'}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            form={formId}
            size="lg"
            loading={save.isPending}
            icon={initial ? <Save className="size-6" aria-hidden /> : <Plus className="size-6" aria-hidden />}
          >
            {initial ? 'Guardar cambios' : 'Agregar'}
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <TextField label="Actividad" placeholder="ej. Cena navideña" autoFocus error={errors.title?.message} {...register('title')} />
        <TextField label="Día" type="date" error={errors.date?.message} {...register('date')} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Empieza" type="time" error={errors.start?.message} {...register('start')} />
          <TextField label="Termina" type="time" optional error={errors.end?.message} {...register('end')} />
        </div>
        <TextArea label="Detalles" optional rows={2} error={errors.description?.message} {...register('description')} />
        <label className="flex flex-col gap-1.5 text-base font-semibold">
          <span>
            Responsable <span className="font-normal text-ink-500">(opcional)</span>
          </span>
          <select {...register('responsibleId')} className="min-h-13 w-full rounded-xl border-2 border-mist-300 bg-white px-3 text-lg font-normal text-ink-900">
            <option value="">Nadie en particular</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {displayName(p)}
              </option>
            ))}
          </select>
        </label>

        {initial && (
          <fieldset>
            <legend className="mb-2 text-base font-semibold">Estado</legend>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SCHEDULE_STATUS_LABELS) as ScheduleStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                  className={`min-h-12 rounded-xl border-2 px-3 text-base font-semibold ${
                    status === s ? 'border-brand bg-brand text-white' : 'border-mist-200 bg-white'
                  }`}
                >
                  <span aria-hidden>{SCHEDULE_STATUS_LABELS[s].emoji}</span> {SCHEDULE_STATUS_LABELS[s].label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {formError && <Notice tone="error">{formError}</Notice>}

        {initial && (
          <div className="border-t border-mist-200 pt-4">
            {confirmingDelete ? (
              <div className="space-y-2 rounded-xl bg-berry-50 p-3" role="alert">
                <p className="font-semibold text-berry-700">¿Quitar «{initial.title}» del cronograma?</p>
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
                Quitar actividad
              </Button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
