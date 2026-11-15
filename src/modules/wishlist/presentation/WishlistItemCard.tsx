import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatMoney } from '@/shared/lib/money';
import { hostnameOf } from '@/shared/lib/whatsapp';
import { Button } from '@/shared/ui/Button';
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
  2: 'bg-brand-soft text-brand',
  3: 'bg-cream-200 text-ink-700',
} as const;

export function WishlistItemCard({ item, budget, currency, canEdit, deleting, onEdit, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <article className="animate-pop-in space-y-3 rounded-3xl border border-cream-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-xl font-bold text-ink-900">🎁 {item.title}</h3>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${priorityStyles[item.priority]}`}>{PRIORITY_LABELS[item.priority]}</span>
      </div>

      {item.description && <p className="whitespace-pre-line text-base text-ink-700">{item.description}</p>}

      {item.priceEstimate !== null && (
        <p className="text-base">
          Precio aproximado: <strong>{formatMoney(item.priceEstimate, currency)}</strong>
          {isOverBudget(item, budget) && <span className="ml-2 text-sm font-semibold text-gold-600">(más que el presupuesto)</span>}
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
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-cream-50 px-3 text-base font-semibold text-brand underline underline-offset-2"
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
            <Button variant="secondary" onClick={() => setConfirming(true)} icon={<Trash2 className="size-5" aria-hidden />} className="!border-berry-600 !text-berry-700">
              Quitar
            </Button>
          </div>
        ))}
    </article>
  );
}
