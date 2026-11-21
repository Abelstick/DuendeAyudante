import { ArrowLeft, Megaphone } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { canEditContent } from '@/modules/events/domain/Event';
import { applySort, DEFAULT_LIST_PREFS, matchesSearch, type ListPrefs, type SortValue } from '@/shared/lib/listing';
import { useSessionState } from '@/shared/lib/useSessionState';
import { Button, ButtonLink, Spinner } from '@/shared/ui/Button';
import { EmptyState, Notice, PageTitle } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { FilterSelect, ListToolbar } from '@/shared/ui/ListToolbar';
import type { Announcement } from '../domain/Announcement';
import { AnnouncementFormModal } from './AnnouncementFormModal';
import { AnnouncementItem } from './AnnouncementItem';
import { useAnnouncements } from './hooks';

interface AnnouncementPrefs extends ListPrefs {
  /** '' = todos · prioridad */
  priority: string;
}

// Por defecto, los más nuevos primero
const DEFAULT_PREFS: AnnouncementPrefs = { ...DEFAULT_LIST_PREFS, sort: 'date', dir: 'desc', priority: '' };

const SORTERS: Record<string, (a: Announcement) => SortValue> = {
  date: (a) => a.publishedAt.getTime(),
  title: (a) => a.title,
  author: (a) => a.authorName,
};

export function AnnouncementsPage() {
  const { event, context } = useEventScope();
  const announcements = useAnnouncements(event.id);
  const [editing, setEditing] = useState<{ item: Announcement | null } | null>(null);
  const [prefs, setPrefs] = useSessionState<AnnouncementPrefs>(`${event.id}:anuncios`, DEFAULT_PREFS);
  const isEditor = canEditContent(context.role);
  const all = announcements.data ?? [];
  const patch = (p: Partial<AnnouncementPrefs>) => setPrefs((prev) => ({ ...prev, ...p }));
  const sorted = applySort(
    all.filter((a) => (!prefs.priority || a.priority === prefs.priority) && matchesSearch(prefs.q, a.title, a.body, a.authorName)),
    SORTERS,
    prefs.sort,
    prefs.dir,
  );
  // El fijado siempre va primero
  const visible = [...sorted.filter((a) => a.pinned), ...sorted.filter((a) => !a.pinned)];
  const hasFilters = Boolean(prefs.q || prefs.priority);

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

      {all.length > 1 && (
        <ListToolbar
          prefs={prefs}
          onChange={patch}
          searchLabel="Buscar anuncio"
          sortOptions={[
            { value: 'date', label: 'Fecha' },
            { value: 'title', label: 'Título' },
            { value: 'author', label: 'Autor' },
          ]}
          summary={hasFilters ? `${visible.length} de ${all.length} anuncios` : undefined}
          onReset={hasFilters ? () => patch({ q: '', priority: '' }) : null}
          activeFilters={prefs.priority ? 1 : 0}
        >
          <FilterSelect label="Importancia" value={prefs.priority} onChange={(priority) => patch({ priority })}>
            <option value="">Todos</option>
            <option value="important">Solo importantes</option>
            <option value="normal">Solo normales</option>
          </FilterSelect>
        </ListToolbar>
      )}
      {all.length > 0 && visible.length === 0 && <Notice>No hay anuncios con esos filtros.</Notice>}

      <div className="stagger space-y-3">
        {visible.map((a) => (
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
