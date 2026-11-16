import { AppError } from '@/shared/domain/errors';
import { zonedDateTimeToInstant } from '@/shared/lib/datetime';
import { isValidPersonName, JOIN_CODE_PATTERN, normalizeJoinCode } from '@/shared/validation/names';
import type { CreateEventInput, DuplicateEventInput } from '../domain/Event';
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

  async changeJoinCode(eventId: string, newCode: string): Promise<string> {
    const code = normalizeJoinCode(newCode);
    if (!JOIN_CODE_PATTERN.test(code)) throw new AppError('JOIN_CODE_INVALID');
    return this.events.changeJoinCode(eventId, code);
  }

  /** Monto acordado del intercambio: mayor a cero y con hasta 2 decimales. */
  async updateBudget(eventId: string, amount: number): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0 || amount >= 100_000_000) throw new AppError('BUDGET_INVALID');
    await this.events.updateBudget(eventId, Math.round(amount * 100) / 100);
  }

  updateDescription(eventId: string, description: string): Promise<void> {
    const text = description.trim();
    if (text.length > 1000) throw new AppError('DESCRIPTION_TOO_LONG');
    return this.events.updateDescription(eventId, text || null);
  }

  /**
   * Dirección en una sola línea, hasta 300 letras; vacía la borra.
   * `host` es de quién es la casa (hasta 80 letras); sin dirección no se guarda.
   */
  updateAddress(eventId: string, address: string, host = ''): Promise<void> {
    const text = address.trim().replace(/\s+/g, ' ');
    if (text.length > 300) throw new AppError('ADDRESS_TOO_LONG');
    // Se muestra como «Casa de …»: si lo escribieron completo, no se repite
    const hostText = host
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^(en\s+)?(la\s+)?casa\s+de\s+/i, '');
    if (hostText.length > 80) throw new AppError('ADDRESS_HOST_TOO_LONG');
    return this.events.updateAddress(eventId, text || null, text ? hostText || null : null);
  }

  async duplicate(input: DuplicateEventInput): Promise<string> {
    if (!input.name.trim()) throw new AppError('EVENT_NAME_INVALID');
    const joinCode = normalizeJoinCode(input.joinCode);
    if (!JOIN_CODE_PATTERN.test(joinCode)) throw new AppError('JOIN_CODE_INVALID');
    const celebrationAt = zonedDateTimeToInstant(input.date, input.time, input.timezone);
    if (Number.isNaN(celebrationAt.getTime())) throw new AppError('DATE_INVALID');
    return this.events.duplicate({
      sourceEventId: input.sourceEventId,
      name: input.name.trim(),
      joinCode,
      celebrationAt,
      copyMembers: input.copyMembers,
      copyChecklist: input.copyChecklist,
      // Los responsables son personas y familias: sin ellas no hay a quién asignarlos
      copyResponsibilities: input.copyResponsibilities && input.copyMembers,
      copySchedule: input.copySchedule,
    });
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
