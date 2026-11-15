import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatMoney } from '@/shared/lib/money';
import { hostnameOf } from '@/shared/lib/whatsapp';
import { Button } from '@/shared/ui/Button';
import { GiftBox, type GiftTone } from '@/shared/ui/illustrations';
import { isOverBudget, PRIORITY_LABELS, type WishlistItem } from '../domain/WishlistItem';

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

  return (
    <article className="group animate-pop-in space-y-3 rounded-2xl border-[3px] border-night-900 bg-white p-5 shadow-block">
      <div className="flex items-center gap-3">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-xl border-2 border-night-900 bg-sky-100">
          <GiftBox tone={priorityGift[item.priority]} className="w-10 motion-safe:group-hover:animate-float" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-xl font-extrabold leading-tight text-ink-900">{item.title}</h3>
          <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${priorityStyles[item.priority]}`}>{PRIORITY_LABELS[item.priority]}</span>
        </div>
      </div>

      {item.description && <p className="whitespace-pre-line text-base text-ink-700">{item.description}</p>}

      {item.priceEstimate !== null && (
        <p className="text-base">
          Precio aproximado: <strong className="text-lg">{formatMoney(item.priceEstimate, currency)}</strong>
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
    </article>
  );
}
