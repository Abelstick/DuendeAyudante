import type { SupabaseClient } from '@supabase/supabase-js';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { Announcement, AnnouncementPriority, IAnnouncementRepository, SaveAnnouncementData } from '../domain/Announcement';

interface Row {
  id: string;
  event_id: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  pinned: boolean;
  author_name: string;
  published_at: string;
}

export class SupabaseAnnouncementRepository implements IAnnouncementRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(eventId: string): Promise<Announcement[]> {
    const { data, error } = await this.supabase
      .from('announcements')
      .select('id, event_id, title, body, priority, pinned, author_name, published_at')
      .eq('event_id', eventId)
      .order('published_at', { ascending: false })
      .returns<Row[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((r) => ({
      id: r.id,
      eventId: r.event_id,
      title: r.title,
      body: r.body,
      priority: r.priority,
      pinned: r.pinned,
      authorName: r.author_name,
      publishedAt: new Date(r.published_at),
    }));
  }

  async save(d: SaveAnnouncementData): Promise<void> {
    const row = { title: d.title, body: d.body, priority: d.priority, pinned: d.pinned };
    const { error } = d.id
      ? await this.supabase.from('announcements').update(row).eq('id', d.id)
      : await this.supabase.from('announcements').insert({ ...row, event_id: d.eventId });
    if (error) throw fromPostgrestError(error);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('announcements').delete().eq('id', id);
    if (error) throw fromPostgrestError(error);
  }
}
