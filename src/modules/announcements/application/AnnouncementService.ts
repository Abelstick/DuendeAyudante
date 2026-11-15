import { AppError } from '@/shared/domain/errors';
import type { IAnnouncementRepository, SaveAnnouncementData } from '../domain/Announcement';

export class AnnouncementService {
  constructor(private readonly announcements: IAnnouncementRepository) {}

  list(eventId: string) {
    return this.announcements.list(eventId);
  }

  async save(data: SaveAnnouncementData) {
    const title = data.title.trim();
    const body = data.body.trim();
    if (!title || title.length > 120) throw new AppError('ANNOUNCEMENT_TITLE_INVALID');
    if (!body || body.length > 2000) throw new AppError('ANNOUNCEMENT_BODY_INVALID');
    return this.announcements.save({ ...data, title, body });
  }

  remove(id: string) {
    return this.announcements.remove(id);
  }
}
