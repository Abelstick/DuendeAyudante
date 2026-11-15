import { Copy, MapPin, Navigation } from 'lucide-react';
import { useEventScope } from '@/app/layout/EventLayout';
import { googleMapsUrl, wazeUrl } from '@/shared/lib/maps';
import { buttonClasses } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';

/** En Inicio: dónde es la celebración y cómo llegar. Si no hay dirección, no ocupa espacio. */
export function AddressCard() {
  const { event } = useEventScope();
  const toast = useToast();
  if (!event.address) return null;
  const address = event.address;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Dirección copiada.');
    } catch {
      toast.error('No pudimos copiarla. Mantén presionada la dirección para copiarla.');
    }
  };

  return (
    <section aria-labelledby="direccion-title" className="space-y-3 rounded-2xl border-2 border-night-900 bg-white p-4 shadow-block">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-night-900 bg-berry-500 text-white" aria-hidden>
          <MapPin className="size-6" />
        </span>
        <div className="min-w-0">
          <h2 id="direccion-title" className="text-lg font-extrabold text-ink-900">
            ¿Dónde es?
          </h2>
          <p className="wrap-break-word select-all text-base text-ink-700">{address}</p>
        </div>
      </div>
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
    </section>
  );
}
