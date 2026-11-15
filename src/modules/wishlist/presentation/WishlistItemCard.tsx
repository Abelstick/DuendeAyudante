import { ChevronDown, ExternalLink, Images, Pencil, Tag, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { formatMoney } from '@/shared/lib/money';
import { hostnameOf } from '@/shared/lib/whatsapp';
import { Button } from '@/shared/ui/Button';
import { GiftBox, type GiftTone } from '@/shared/ui/illustrations';
import { describePrice, isOverBudget, PRIORITY_LABELS, type WishlistItem } from '../domain/WishlistItem';
import { DrivePhoto } from './DrivePhoto';
import { PhotoViewer } from './PhotoViewer';

interface Props {
  item: WishlistItem;
  budget: number | null;
  currency: string;
  canEdit: boolean;
  deleting?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const priorityStyles = {
  1: 'bg-berry-50 text-berry-700',
  2: 'bg-pine-100 text-pine-700',
  3: 'bg-night-50 text-night-700',
} as const;

/** Cada prioridad tiene su caja de regalo (además de la etiqueta con texto). */
const priorityGift: Record<1 | 2 | 3, GiftTone> = { 1: 'berry', 2: 'pine', 3: 'night' };

export function WishlistItemCard({ item, budget, currency, canEdit, deleting, onEdit, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const photosId = useId();
  const price = describePrice(item, (n) => formatMoney(n, currency));
  const isRange = item.priceMin !== null && item.priceMax !== null && item.priceMin !== item.priceMax;

  const cover = item.photos[0];
  const photoCount = item.photos.length;

  return (
    <article className="group animate-pop-in space-y-3 rounded-2xl border-2 border-night-900 bg-white p-5 shadow-block">
      <div className="flex items-center gap-3">
        {/* Con fotos: la primera como miniatura (al tocarla se ven en grande). Sin fotos: la caja de regalo. */}
        {cover ? (
          <button
            type="button"
            onClick={() => setViewing(0)}
            className="relative size-20 shrink-0 overflow-hidden rounded-xl border-2 border-night-900 bg-mist-100 focus-visible:outline-3 focus-visible:outline-gold-400"
            aria-label={photoCount === 1 ? `Ver la foto de ${item.title}` : `Ver las ${photoCount} fotos de ${item.title}`}
          >
            <DrivePhoto driveFileId={cover.driveFileId} alt="" width={240} className="size-full" />
            {photoCount > 1 && (
              <span className="absolute bottom-0.5 right-0.5 rounded-md bg-night-900/85 px-1.5 text-xs font-bold text-white" aria-hidden>
                +{photoCount - 1}
              </span>
            )}
          </button>
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-xl border-2 border-night-900 bg-sky-100">
            <GiftBox tone={priorityGift[item.priority]} className="w-10 motion-safe:group-hover:animate-float" />
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-xl font-extrabold leading-tight text-ink-900">{item.title}</h3>
          <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${priorityStyles[item.priority]}`}>{PRIORITY_LABELS[item.priority]}</span>
        </div>
      </div>

      {item.description && <p className="whitespace-pre-line text-base text-ink-700">{item.description}</p>}

      {/* Fotos en un desplegable: se ven completas (sin recortar) y al tocar una se abre en grande */}
      {photoCount > 0 && (
        <div className="rounded-xl border-2 border-night-900/15 bg-mist-100">
          <button
            type="button"
            onClick={() => setPhotosOpen((v) => !v)}
            aria-expanded={photosOpen}
            aria-controls={photosId}
            className="flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left text-base font-bold text-night-900 hover:bg-mist-200"
          >
            <Images className="size-5 shrink-0" aria-hidden />
            <span className="flex-1">{photosOpen ? 'Ocultar fotos' : photoCount === 1 ? 'Ver la foto' : `Ver las ${photoCount} fotos`}</span>
            <ChevronDown className={`size-5 shrink-0 motion-safe:transition-transform ${photosOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {photosOpen && (
            <ul id={photosId} className="animate-pop-in flex snap-x gap-2 overflow-x-auto px-3 pb-3" aria-label={`Fotos de ${item.title}`}>
              {item.photos.map((photo, i) => (
                <li key={photo.id} className="shrink-0 snap-start">
                  <button
                    type="button"
                    onClick={() => setViewing(i)}
                    aria-label={`Ver en grande la foto ${i + 1} de ${photoCount}`}
                    className="block h-48 w-40 overflow-hidden rounded-lg border-2 border-night-900 bg-white sm:h-56 sm:w-48"
                  >
                    <DrivePhoto driveFileId={photo.driveFileId} alt="" width={480} fit="contain" className="size-full" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {item.brands.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-bold uppercase tracking-wide text-ink-500">{item.brands.length === 1 ? 'Marca' : 'Marcas'}</p>
          <ul className="flex flex-wrap gap-2">
            {item.brands.map((brand) => (
              <li key={brand} className="inline-flex items-center gap-1 rounded-full border-2 border-night-900 bg-gold-50 px-3 py-0.5 text-base font-bold text-night-900">
                <Tag className="size-4 shrink-0" aria-hidden />
                {brand}
              </li>
            ))}
          </ul>
        </div>
      )}

      {price !== null && (
        <p className="text-base">
          {isRange ? 'Rango de precio' : 'Precio aproximado'}: <strong className="text-lg">{price}</strong>
          {isOverBudget(item, budget) && <span className="mt-1 block w-fit rounded-full bg-gold-100 px-3 py-0.5 text-sm font-bold text-gold-700">Más que el presupuesto</span>}
        </p>
      )}

      {item.links.length > 0 && (
        <ul className="space-y-2">
          {item.links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-night-50 px-4 text-base font-bold text-night-700 underline underline-offset-4 hover:bg-night-100"
              >
                <ExternalLink className="size-5 shrink-0" aria-hidden />
                Ver en {link.label ?? hostnameOf(link.url)}
              </a>
            </li>
          ))}
        </ul>
      )}

      {canEdit &&
        (confirming ? (
          <div className="space-y-3 rounded-2xl bg-berry-50 p-4" role="alert">
            <p className="text-base font-semibold text-berry-700">¿Seguro que quieres quitar «{item.title}»?</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="danger" loading={deleting} onClick={onDelete} icon={<Trash2 className="size-5" aria-hidden />}>
                Sí, quitar
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                No, dejarlo
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onEdit} icon={<Pencil className="size-5" aria-hidden />}>
              Cambiar
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(true)} icon={<Trash2 className="size-5" aria-hidden />} className="text-berry-700! hover:border-berry-600! hover:bg-berry-50!">
              Quitar
            </Button>
          </div>
        ))}

      {viewing !== null && <PhotoViewer title={item.title} photos={item.photos} startAt={viewing} onClose={() => setViewing(null)} />}
    </article>
  );
}
