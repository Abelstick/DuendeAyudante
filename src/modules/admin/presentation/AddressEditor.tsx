import { MapPin, Pencil, Save } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { useUpdateAddress } from '@/modules/events/presentation/hooks';
import { Button } from '@/shared/ui/Button';
import { errorMessage } from '@/shared/ui/errorMessages';
import { TextArea, TextField } from '@/shared/ui/TextField';
import { useToast } from '@/shared/ui/Toast';

/**
 * Dirección de la celebración y de quién es la casa: todos las ven en el inicio,
 * con botones para Google Maps y Waze.
 */
export function AddressEditor() {
  const { event } = useEventScope();
  const update = useUpdateAddress(event.id);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(event.address ?? '');
  const [host, setHost] = useState(event.addressHost ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({ address: value, host });
      toast.success(value.trim() ? '¡Listo! Todos verán la dirección en el inicio.' : 'Listo, se quitó la dirección.');
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white px-4 py-3 text-base">
        <span className="flex min-w-0 flex-1 items-start gap-2">
          <MapPin className="mt-0.5 size-5 shrink-0 text-night-700" aria-hidden />
          <span className="min-w-0 wrap-break-word">
            {event.address ? (
              <>
                Dirección:{' '}
                <span className="text-ink-700">
                  {event.addressHost && <strong className="text-ink-900">Casa de {event.addressHost} · </strong>}
                  {event.address}
                </span>
                {!event.addressHost && <span className="block text-sm text-ink-700">Falta indicar de quién es la casa.</span>}
              </>
            ) : (
              <span className="text-ink-700">Sin dirección (agrégala para que todos sepan cómo llegar)</span>
            )}
          </span>
        </span>
        <Button
          variant="ghost"
          onClick={() => {
            setValue(event.address ?? '');
            setHost(event.addressHost ?? '');
            setError(null);
            setEditing(true);
          }}
          icon={<Pencil className="size-5" aria-hidden />}
        >
          {event.address ? 'Cambiar' : 'Agregar'}
        </Button>
      </div>
    );
  }

  const unchanged = value.trim() === (event.address ?? '') && host.trim() === (event.addressHost ?? '');

  return (
    <div className="animate-pop-in space-y-3 rounded-2xl border-2 border-gold-400 bg-white p-4">
      <TextField
        label="¿De quién es la casa?"
        optional
        hint="Escribe solo el nombre. Se mostrará como «Casa de la abuela Rosa»."
        placeholder="ej. la abuela Rosa"
        value={host}
        onChange={(e) => setHost(e.target.value)}
        maxLength={80}
        autoFocus
      />
      <TextArea
        label="Dirección de la celebración"
        optional
        rows={2}
        hint="Calle, número, distrito y una referencia. Así se busca en Google Maps y Waze."
        placeholder="ej. Av. Larco 123, Miraflores (frente al parque)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={300}
        error={error ?? undefined}
      />
      {host.trim() && !value.trim() && <p className="text-sm font-semibold text-ink-700">Escribe también la dirección: sin ella no se muestra de quién es la casa.</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={save} loading={update.isPending} disabled={unchanged} icon={<Save className="size-5" aria-hidden />}>
          Guardar dirección
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
