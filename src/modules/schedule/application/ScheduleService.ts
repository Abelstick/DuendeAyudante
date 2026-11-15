import { AppError } from '@/shared/domain/errors';
import type { IScheduleRepository, SaveScheduleData } from '../domain/Schedule';

export class ScheduleService {
  constructor(private readonly schedule: IScheduleRepository) {}

  list(eventId: string) {
    return this.schedule.list(eventId);
  }

  async save(data: SaveScheduleData) {
    const title = data.title.trim();
    if (!title || title.length > 120) throw new AppError('SCHEDULE_TITLE_INVALID');
    if (Number.isNaN(data.startsAt.getTime())) throw new AppError('DATE_INVALID');
    if (data.endsAt && data.endsAt < data.startsAt) throw new AppError('SCHEDULE_END_BEFORE_START');
    return this.schedule.save({ ...data, title, description: data.description?.trim() || null });
  }

  remove(id: string) {
    return this.schedule.remove(id);
  }
}
