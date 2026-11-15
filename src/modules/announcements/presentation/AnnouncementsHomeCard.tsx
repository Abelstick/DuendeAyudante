import { ChevronRight, Megaphone } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { canEditContent } from '@/modules/events/domain/Event';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { announcementsForHome } from '../domain/Announcement';
import { AnnouncementFormModal } from './AnnouncementFormModal';
import { AnnouncementItem } from './AnnouncementItem';
import { useAnnouncements } from './hooks';

/** En Inicio: anuncios importantes primero. Si no hay anuncios, no ocupa espacio (salvo para quien publica). */
export function AnnouncementsHomeCard() {
  const { event, context } = useEventScope();
  const announcements = useAnnouncements(event.id);
  const [creating, setCreating] = useState(false);
  const isEditor = canEditContent(context.role);

  const all = announcements.data ?? [];
  if (all.length === 0 && !isEditor) return null;
  const shown = announcementsForHome(all);

  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-bold text-brand">
        <Megaphone className="size-6" aria-hidden /> Anuncios
      </h2>
      {shown.length === 0 ? (
        <p className="text-base text-ink-700">Todavía no publicaste anuncios. Úsalos para avisar cambios de horario, vestimenta o recordatorios.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((a) => (
            <AnnouncementItem key={a.id} announcement={a} eventName={event.name} timezone={event.timezone} canEdit={false} />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        {isEditor && (
          <Button onClick={() => setCreating(true)} icon={<Megaphone className="size-5" aria-hidden />}>
            Publicar anuncio
          </Button>
        )}
        {all.length > 0 && (
          <ButtonLink to={`/e/${event.id}/anuncios`} variant="secondary" icon={<ChevronRight className="size-5" aria-hidden />}>
            {all.length > shown.length ? `Ver los ${all.length} anuncios` : 'Ver anuncios'}
          </ButtonLink>
        )}
      </div>
      {creating && <AnnouncementFormModal eventId={event.id} initial={null} onClose={() => setCreating(false)} />}
    </Card>
  );
}
