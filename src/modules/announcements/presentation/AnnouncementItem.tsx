import { MessageCircle, Pencil, Pin } from 'lucide-react';
import { formatShortDateTime } from '@/shared/lib/datetime';
import { whatsappShareUrl } from '@/shared/lib/whatsapp';
import { Avatar } from '@/shared/ui/Avatar';
import { Button, buttonClasses } from '@/shared/ui/Button';
import { type Announcement, announcementShareText } from '../domain/Announcement';

interface Props {
  announcement: Announcement;
  eventName: string;
  timezone: string;
  canEdit: boolean;
  onEdit?: () => void;
}

/** Un anuncio. Los importantes van en dorado y con la etiqueta "Importante" (no dependen solo del color). */
export function AnnouncementItem({ announcement: a, eventName, timezone, canEdit, onEdit }: Props) {
  const important = a.priority === 'important';
  return (
    <article
      className={`relative space-y-2 overflow-hidden rounded-2xl border-2 p-4 pl-5 ${
        important ? 'border-gold-400 bg-gold-50 shadow-card' : 'border-mist-200 bg-white'
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${important ? 'bg-gold-400' : 'bg-night-100'}`} aria-hidden />
      {important && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-400 px-3 py-1 text-sm font-black uppercase tracking-wide text-night-900">
          <Pin className="size-4" aria-hidden /> Importante
        </p>
      )}
      <h3 className="text-lg font-extrabold leading-snug text-ink-900">{a.title}</h3>
      <p className="whitespace-pre-line text-base text-ink-900">{a.body}</p>
      <p className="flex items-center gap-2 text-sm text-ink-700">
        <Avatar name={a.authorName} size="sm" />
        <span>
          <span className="font-bold">{a.authorName}</span> · {formatShortDateTime(a.publishedAt, timezone)}
        </span>
      </p>
      {canEdit && (
        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
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
