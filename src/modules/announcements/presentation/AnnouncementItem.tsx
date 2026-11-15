import { MessageCircle, Pencil } from 'lucide-react';
import { formatShortDateTime } from '@/shared/lib/datetime';
import { whatsappShareUrl } from '@/shared/lib/whatsapp';
import { Button, buttonClasses } from '@/shared/ui/Button';
import { type Announcement, announcementShareText } from '../domain/Announcement';

interface Props {
  announcement: Announcement;
  eventName: string;
  timezone: string;
  canEdit: boolean;
  onEdit?: () => void;
}

export function AnnouncementItem({ announcement: a, eventName, timezone, canEdit, onEdit }: Props) {
  const important = a.priority === 'important';
  return (
    <article className={`space-y-2 rounded-2xl border-2 p-4 ${important ? 'border-gold-400 bg-gold-100/60' : 'border-cream-200 bg-white'}`}>
      {important && <p className="text-sm font-bold text-ink-900">⚠️ IMPORTANTE</p>}
      <h3 className="text-lg font-bold text-ink-900">{a.title}</h3>
      <p className="whitespace-pre-line text-base text-ink-900">{a.body}</p>
      <p className="text-sm text-ink-700">
        {a.authorName} · {formatShortDateTime(a.publishedAt, timezone)}
      </p>
      {canEdit && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href={whatsappShareUrl(announcementShareText(a, eventName))} target="_blank" rel="noopener noreferrer" className={buttonClasses('whatsapp', 'md')}>
            <MessageCircle className="size-5" aria-hidden />
            <span>Compartir por WhatsApp</span>
          </a>
          {onEdit && (
            <Button variant="ghost" onClick={onEdit} icon={<Pencil className="size-5" aria-hidden />}>
              Editar
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
