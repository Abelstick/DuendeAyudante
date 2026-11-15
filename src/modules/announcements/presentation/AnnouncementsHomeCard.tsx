import { ChevronRight, Megaphone } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { canEditContent } from '@/modules/events/domain/Event';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Pill } from '@/shared/ui/Card';
import { CollapsibleCard } from '@/shared/ui/CollapsibleCard';
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
    <CollapsibleCard
      id="inicio:anuncios"
      icon={<Megaphone className="size-6" />}
      tone="night"
      title="Anuncios"
      action={all.length > 0 ? <Pill tone="night">{all.length}</Pill> : undefined}
    >
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
          <Button variant={shown.length === 0 ? 'primary' : 'secondary'} onClick={() => setCreating(true)} icon={<Megaphone className="size-5" aria-hidden />}>
            Publicar anuncio
          </Button>
        )}
        {all.length > 0 && (
          <ButtonLink to={`/e/${event.id}/anuncios`} variant="ghost" icon={<ChevronRight className="size-5" aria-hidden />}>
            {all.length > shown.length ? `Ver los ${all.length} anuncios` : 'Ver anuncios'}
          </ButtonLink>
        )}
      </div>
      {creating && <AnnouncementFormModal eventId={event.id} initial={null} onClose={() => setCreating(false)} />}
    </CollapsibleCard>
  );
}
