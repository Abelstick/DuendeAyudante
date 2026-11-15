import { Check, Pencil, RotateCcw, Timer } from 'lucide-react';
import type { Family } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { formatDateOnly } from '@/shared/lib/datetime';
import { Button } from '@/shared/ui/Button';
import { CATEGORY_LABELS, KIND_LABELS, STATUS_LABELS, type Responsibility, type ResponsibilityStatus } from '../domain/Responsibility';

const statusStyles: Record<ResponsibilityStatus, string> = {
  pending: 'bg-gold-100 text-ink-900 border-gold-400',
  in_progress: 'bg-brand-soft text-brand border-brand',
  done: 'bg-brand text-white border-brand',
};

interface Props {
  item: Responsibility;
  families: Family[];
  participants: Participant[];
  canChangeStatus: boolean;
  canEdit: boolean;
  busy?: boolean;
  compact?: boolean;
  onStatus: (status: ResponsibilityStatus) => void;
  onEdit?: () => void;
}

export function ResponsibilityCard({ item, families, participants, canChangeStatus, canEdit, busy, compact, onStatus, onEdit }: Props) {
  const category = CATEGORY_LABELS[item.category];
  const status = STATUS_LABELS[item.status];
  const people = item.participantIds.map((id) => participants.find((p) => p.id === id)).filter((p): p is Participant => Boolean(p));
  const fams = item.familyIds.map((id) => families.find((f) => f.id === id)).filter((f): f is Family => Boolean(f));

  return (
    <article className={`animate-pop-in space-y-3 rounded-3xl border bg-white p-4 shadow-sm ${item.status === 'done' ? 'border-brand-soft' : 'border-cream-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-700">
            <span aria-hidden>{category.emoji}</span> {KIND_LABELS[item.kind].one} · {category.label}
          </p>
          <h3 className={`text-lg font-bold ${item.status === 'done' ? 'text-ink-700' : 'text-ink-900'}`}>{item.title}</h3>
        </div>
        <span className={`shrink-0 rounded-full border-2 px-3 py-1 text-sm font-bold ${statusStyles[item.status]}`}>
          <span aria-hidden>{status.emoji}</span> {status.label}
        </span>
      </div>

      {item.description && !compact && <p className="whitespace-pre-line text-base text-ink-700">{item.description}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-700">Responsables:</span>
        {fams.map((f) => (
          <FamilyBadge key={f.id} family={f} />
        ))}
        {people.map((p) => (
          <span key={p.id} className="rounded-full bg-cream-200 px-3 py-1 text-sm font-semibold">
            {displayName(p)}
          </span>
        ))}
        {fams.length === 0 && people.length === 0 && <span className="text-sm text-ink-500">Sin responsable</span>}
      </div>

      {item.dueDate && (
        <p className="text-base">
          📅 Para el <strong>{formatDateOnly(item.dueDate)}</strong>
        </p>
      )}
      {item.notes && !compact && <p className="rounded-xl bg-cream-50 px-3 py-2 text-base text-ink-700">📝 {item.notes}</p>}

      {(canChangeStatus || canEdit) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {canChangeStatus && item.status !== 'done' && (
            <Button onClick={() => onStatus('done')} loading={busy} icon={<Check className="size-5" aria-hidden />}>
              Ya lo hice
            </Button>
          )}
          {canChangeStatus && item.status === 'pending' && (
            <Button variant="secondary" onClick={() => onStatus('in_progress')} disabled={busy} icon={<Timer className="size-5" aria-hidden />}>
              Lo estoy haciendo
            </Button>
          )}
          {canChangeStatus && item.status === 'done' && (
            <Button variant="ghost" onClick={() => onStatus('pending')} disabled={busy} icon={<RotateCcw className="size-5" aria-hidden />}>
              Marcar como pendiente
            </Button>
          )}
          {canEdit && onEdit && (
            <Button variant="ghost" onClick={onEdit} icon={<Pencil className="size-5" aria-hidden />}>
              Editar
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
