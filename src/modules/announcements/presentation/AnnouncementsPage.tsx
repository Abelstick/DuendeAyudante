import { ArrowLeft, Megaphone } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { canEditContent } from '@/modules/events/domain/Event';
import { Button, ButtonLink, Spinner } from '@/shared/ui/Button';
import { EmptyState, Notice, PageTitle } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import type { Announcement } from '../domain/Announcement';
import { AnnouncementFormModal } from './AnnouncementFormModal';
import { AnnouncementItem } from './AnnouncementItem';
import { useAnnouncements } from './hooks';

export function AnnouncementsPage() {
  const { event, context } = useEventScope();
  const announcements = useAnnouncements(event.id);
  const [editing, setEditing] = useState<{ item: Announcement | null } | null>(null);
  const isEditor = canEditContent(context.role);

  return (
    <div className="space-y-5">
      <ButtonLink to={`/e/${event.id}`} variant="ghost" icon={<ArrowLeft className="size-5" aria-hidden />}>
        Volver al inicio
      </ButtonLink>
      <PageTitle icon={<Megaphone className="size-8" aria-hidden />} title="Anuncios" subtitle="Avisos y recordatorios para toda la familia" />

      {isEditor && (
        <Button size="lg" onClick={() => setEditing({ item: null })} icon={<Megaphone className="size-6" aria-hidden />}>
          Publicar anuncio
        </Button>
      )}

      {announcements.isLoading && <Spinner label="Cargando…" />}
      {announcements.error && <Notice tone="error">{errorMessage(announcements.error)}</Notice>}
      {announcements.data?.length === 0 && <EmptyState emoji="📢" title="Todavía no hay anuncios." />}

      <div className="stagger space-y-3">
        {(announcements.data ?? []).map((a) => (
          <AnnouncementItem
            key={a.id}
            announcement={a}
            eventName={event.name}
            timezone={event.timezone}
            canEdit={isEditor}
            onEdit={() => setEditing({ item: a })}
          />
        ))}
      </div>

      {editing && <AnnouncementFormModal key={editing.item?.id ?? 'new'} eventId={event.id} initial={editing.item} onClose={() => setEditing(null)} />}
    </div>
  );
}
