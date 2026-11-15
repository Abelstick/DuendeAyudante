import { AppError } from '@/shared/domain/errors';
import { type IFamilyAccessRepository, normalizeSecretWord, SECRET_WORD_PATTERN } from '../domain/FamilyAccess';

const LINK_TOKEN_PATTERN = /^[a-f0-9]{32}$/;

export class FamilyAccessService {
  constructor(private readonly access: IFamilyAccessRepository) {}

  listForEvent(eventId: string) {
    return this.access.listForEvent(eventId);
  }

  /** Crea el enlace de la familia o cambia su palabra secreta. */
  setWord(familyId: string, word: string) {
    const normalized = normalizeSecretWord(word);
    if (!SECRET_WORD_PATTERN.test(normalized)) throw new AppError('SECRET_WORD_INVALID');
    return this.access.setWord(familyId, normalized);
  }

  getInfo(linkToken: string) {
    if (!LINK_TOKEN_PATTERN.test(linkToken)) throw new AppError('FAMILY_LINK_NOT_FOUND');
    return this.access.getInfo(linkToken);
  }

  listMembers(linkToken: string, word: string) {
    const normalized = normalizeSecretWord(word);
    if (!normalized) throw new AppError('SECRET_WORD_WRONG');
    return this.access.listMembers(linkToken, normalized);
  }

  enter(linkToken: string, word: string, participantId: string) {
    return this.access.enter(linkToken, normalizeSecretWord(word), participantId);
  }
}
