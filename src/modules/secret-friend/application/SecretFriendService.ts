import { AppError } from '@/shared/domain/errors';
import type { ISecretFriendRepository } from '../domain/SecretFriend';

export class SecretFriendService {
  constructor(private readonly notes: ISecretFriendRepository) {}

  listMine(eventId: string) {
    return this.notes.listMine(eventId);
  }

  async set(eventId: string, giverId: string, receiverId: string) {
    if (giverId === receiverId) throw new AppError('SECRET_FRIEND_SELF');
    return this.notes.set(eventId, giverId, receiverId);
  }

  clear(giverId: string) {
    return this.notes.clear(giverId);
  }
}
