import { ChevronRight, Pin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { pinnedAnnouncement } from '../domain/Announcement';
import { useAnnouncements } from './hooks';

/**
 * En Inicio, debajo de la cuenta regresiva: el anuncio fijado (ej. la fecha
 * límite para enviar los regalos). No se contrae, para que nadie lo pase por
 * alto. Si no hay anuncio fijado, no ocupa espacio.
 */
export function PinnedAnnouncementBanner() {
  const { event } = useEventScope();
  const announcements = useAnnouncements(event.id);
  const pinned = pinnedAnnouncement(announcements.data ?? []);
  if (!pinned) return null;

  return (
    <section
      aria-label="Anuncio fijado"
      className="space-y-2 rounded-2xl border-2 border-line bg-gold-100 p-4 shadow-block"
    >
      <p className="font-display inline-flex items-center gap-1.5 rounded-lg border-2 border-line bg-berry-600 px-2.5 py-0.5 text-sm font-semibold uppercase tracking-wide text-white">
        <Pin className="size-4" aria-hidden /> Aviso importante
      </p>
      <h2 className="text-xl font-extrabold leading-snug text-heading">{pinned.title}</h2>
      <p className="whitespace-pre-line text-base text-ink-900">{pinned.body}</p>
      <Link to={`/e/${event.id}/anuncios`} className="inline-flex min-h-11 items-center gap-1 text-base font-bold text-brand-ink underline-offset-4 hover:underline">
        Ver todos los anuncios <ChevronRight className="size-5" aria-hidden />
      </Link>
    </section>
  );
}
