export type AnnouncementPriority = 'normal' | 'important';

export interface Announcement {
  id: string;
  eventId: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  authorName: string;
  publishedAt: Date;
}

export interface SaveAnnouncementData {
  id: string | null;
  eventId: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
}

export interface IAnnouncementRepository {
  list(eventId: string): Promise<Announcement[]>;
  save(data: SaveAnnouncementData): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Para Inicio: primero los importantes (más nuevos primero), luego los demás; hasta `max`. */
export function announcementsForHome(items: Announcement[], max = 3): Announcement[] {
  const byDate = [...items].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  return [...byDate.filter((a) => a.priority === 'important'), ...byDate.filter((a) => a.priority === 'normal')].slice(0, max);
}

export function announcementShareText(a: Announcement, eventName: string): string {
  return `📢 ${eventName}\n\n*${a.title}*\n${a.body}\n\n— ${a.authorName}`;
}
