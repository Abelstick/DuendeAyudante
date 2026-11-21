import { Copy, House, MapPin, Navigation } from 'lucide-react';
import { useEventScope } from '@/app/layout/EventLayout';
import { googleMapsUrl, wazeUrl } from '@/shared/lib/maps';
import { buttonClasses } from '@/shared/ui/Button';
import { CollapsibleCard } from '@/shared/ui/CollapsibleCard';
import { useToast } from '@/shared/ui/Toast';

/**
 * En Inicio: dónde es la celebración, de quién es la casa y cómo llegar.
 * Se abre y se cierra como las demás tarjetas; contraída sigue mostrando lo esencial.
 * Si no hay dirección, no ocupa espacio.
 */
export function AddressCard() {
  const { event } = useEventScope();
  const toast = useToast();
  if (!event.address) return null;
  const address = event.address;
  const host = event.addressHost;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Dirección copiada.');
    } catch {
      toast.error('No pudimos copiarla. Mantén presionada la dirección para copiarla.');
    }
  };

  return (
    <CollapsibleCard
      id="inicio:direccion"
      tourId="inicio-direccion"
      icon={<MapPin className="size-6" />}
      tone="berry"
      title="¿Dónde es?"
      action={<span className="line-clamp-2 text-sm font-semibold text-ink-700">{host ? `Casa de ${host}` : address}</span>}
    >
      {host && (
        <p className="flex items-center gap-2 text-lg font-extrabold text-ink-900">
          <House className="size-5 shrink-0 text-berry-700" aria-hidden />
          <span className="min-w-0 wrap-break-word">Casa de {host}</span>
        </p>
      )}
      <p className="wrap-break-word select-all text-base text-ink-700">{address}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <a href={googleMapsUrl(address)} target="_blank" rel="noopener noreferrer" className={buttonClasses('primary', 'md', 'justify-center')}>
          <MapPin className="size-5" aria-hidden />
          Google Maps
        </a>
        <a href={wazeUrl(address)} target="_blank" rel="noopener noreferrer" className={buttonClasses('secondary', 'md', 'justify-center')}>
          <Navigation className="size-5" aria-hidden />
          Waze
        </a>
        <button type="button" onClick={copy} className={buttonClasses('ghost', 'md', 'justify-center')}>
          <Copy className="size-5" aria-hidden />
          Copiar
        </button>
      </div>
    </CollapsibleCard>
  );
}
