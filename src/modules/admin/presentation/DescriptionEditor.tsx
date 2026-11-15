import { FileText, Pencil, Save } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { useUpdateDescription } from '@/modules/events/presentation/hooks';
import { Button } from '@/shared/ui/Button';
import { errorMessage } from '@/shared/ui/errorMessages';
import { TextArea } from '@/shared/ui/TextField';
import { useToast } from '@/shared/ui/Toast';

/** Descripción que se ve en la cuenta regresiva del inicio; se puede cambiar o borrar. */
export function DescriptionEditor() {
  const { event } = useEventScope();
  const update = useUpdateDescription(event.id);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(event.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync(value);
      toast.success(value.trim() ? '¡Listo! Descripción actualizada.' : 'Listo, se quitó la descripción.');
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white px-4 py-3 text-base">
        <span className="flex min-w-0 flex-1 items-start gap-2">
          <FileText className="mt-0.5 size-5 shrink-0 text-night-700" aria-hidden />
          <span className="min-w-0 wrap-break-word">
            {event.description ? (
              <>
                Descripción: <span className="text-ink-700">{event.description}</span>
              </>
            ) : (
              <span className="text-ink-700">Sin descripción</span>
            )}
          </span>
        </span>
        <Button
          variant="ghost"
          onClick={() => {
            setValue(event.description ?? '');
            setError(null);
            setEditing(true);
          }}
          icon={<Pencil className="size-5" aria-hidden />}
        >
          {event.description ? 'Cambiar' : 'Agregar'}
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-pop-in space-y-3 rounded-2xl border-2 border-gold-400 bg-white p-4">
      <TextArea
        label="Descripción"
        optional
        hint="Se ve en la cuenta regresiva del inicio. Déjala vacía para quitarla."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={1000}
        error={error ?? undefined}
        autoFocus
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={save} loading={update.isPending} disabled={value.trim() === (event.description ?? '')} icon={<Save className="size-5" aria-hidden />}>
          Guardar descripción
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
