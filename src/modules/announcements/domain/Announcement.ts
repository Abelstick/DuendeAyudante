export type AnnouncementPriority = 'normal' | 'important';

export interface Announcement {
  id: string;
  eventId: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  /** Fijado arriba en Inicio como banner destacado (como mucho uno por celebración). */
  pinned: boolean;
  authorName: string;
  publishedAt: Date;
}

export interface SaveAnnouncementData {
  id: string | null;
  eventId: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  pinned: boolean;
}

export interface IAnnouncementRepository {
  list(eventId: string): Promise<Announcement[]>;
  save(data: SaveAnnouncementData): Promise<void>;
  remove(id: string): Promise<void>;
}

/** El anuncio fijado (si por una carrera hubiera varios, el más nuevo). */
export function pinnedAnnouncement(items: readonly Announcement[]): Announcement | null {
  return items.filter((a) => a.pinned).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())[0] ?? null;
}

/**
 * Para la tarjeta de Anuncios en Inicio: primero los importantes (más nuevos
 * primero), luego los demás; hasta `max`. El fijado no entra: ya sale arriba.
 */
export function announcementsForHome(items: readonly Announcement[], max = 3): Announcement[] {
  const pinned = pinnedAnnouncement(items);
  const byDate = items.filter((a) => a !== pinned).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  return [...byDate.filter((a) => a.priority === 'important'), ...byDate.filter((a) => a.priority === 'normal')].slice(0, max);
}

export function announcementShareText(a: Announcement, eventName: string): string {
  return `📢 ${eventName}\n\n*${a.title}*\n${a.body}\n\n— ${a.authorName}`;
}
