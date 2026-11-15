import { AppError } from '@/shared/domain/errors';
import { zonedDateTimeToInstant } from '@/shared/lib/datetime';
import { isValidPersonName, JOIN_CODE_PATTERN, normalizeJoinCode } from '@/shared/validation/names';
import type { CreateEventInput } from '../domain/Event';
import type { IEventRepository } from '../domain/IEventRepository';

export class EventService {
  constructor(private readonly events: IEventRepository) {}

  listMine() {
    return this.events.listMine();
  }

  async getById(id: string) {
    const event = await this.events.findById(id);
    if (!event) throw new AppError('NOT_FOUND');
    return event;
  }

  getMyContext(eventId: string) {
    return this.events.getMyContext(eventId);
  }

  async isJoinCodeAvailable(code: string): Promise<boolean> {
    const normalized = normalizeJoinCode(code);
    if (!JOIN_CODE_PATTERN.test(normalized)) return false;
    return this.events.isJoinCodeAvailable(normalized);
  }

  async create(input: CreateEventInput): Promise<string> {
    if (!input.name.trim()) throw new AppError('EVENT_NAME_INVALID');
    const joinCode = normalizeJoinCode(input.joinCode);
    if (!JOIN_CODE_PATTERN.test(joinCode)) throw new AppError('JOIN_CODE_INVALID');
    if (!isValidPersonName(input.firstName)) throw new AppError('FIRST_NAME_INVALID');
    if (!isValidPersonName(input.paternalSurname)) throw new AppError('PATERNAL_SURNAME_INVALID');
    if (input.maternalSurname && !isValidPersonName(input.maternalSurname)) throw new AppError('MATERNAL_SURNAME_INVALID');
    if (!(input.budget > 0)) throw new AppError('BUDGET_INVALID');

    const celebrationAt = zonedDateTimeToInstant(input.date, input.time, input.timezone);
    if (Number.isNaN(celebrationAt.getTime())) throw new AppError('DATE_INVALID');

    return this.events.create({
      name: input.name.trim(),
      joinCode,
      firstName: input.firstName,
      paternalSurname: input.paternalSurname,
      maternalSurname: input.maternalSurname?.trim() || null,
      celebrationAt,
      timezone: input.timezone,
      budget: input.budget,
      description: input.description?.trim() || null,
    });
  }
}
