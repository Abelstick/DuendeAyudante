import { AppError } from '@/shared/domain/errors';
import { MAX_MESSAGE_LENGTH, type ReceivedMessage, type SaveMessageData, type SentMessage } from '../domain/HolidayMessage';

export interface IMessageRepository {
  /** Los que escribí yo (o las personas a mi cargo). */
  listSent(eventId: string): Promise<SentMessage[]>;
  /** Los que recibí yo (o las personas a mi cargo); antes de la apertura, sin texto ni firma. */
  listReceived(eventId: string): Promise<ReceivedMessage[]>;
  save(data: SaveMessageData): Promise<void>;
  remove(id: string): Promise<void>;
}

export class MessageService {
  constructor(private readonly messages: IMessageRepository) {}

  listSent(eventId: string) {
    return this.messages.listSent(eventId);
  }

  listReceived(eventId: string) {
    return this.messages.listReceived(eventId);
  }

  save(data: SaveMessageData): Promise<void> {
    const body = data.body.trim();
    if (!body) throw new AppError('MESSAGE_EMPTY');
    if (body.length > MAX_MESSAGE_LENGTH) throw new AppError('MESSAGE_TOO_LONG');
    if (!data.toId) throw new AppError('MESSAGE_RECIPIENT_REQUIRED');
    if (data.toId === data.fromId) throw new AppError('MESSAGE_TO_SELF');
    return this.messages.save({ ...data, body });
  }

  remove(id: string) {
    return this.messages.remove(id);
  }
}
