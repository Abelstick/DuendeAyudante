import { AppError } from '@/shared/domain/errors';
import { isValidPersonName, normalizeUsername, USERNAME_PATTERN } from '@/shared/validation/names';
import type { IMemberAccountService, NewMemberData } from '../domain/IMemberAccountService';
import type { IParticipantRepository, ParticipantDetails } from '../domain/IParticipantRepository';

export interface AccessMessageInput {
  firstName: string;
  eventName: string;
  joinCode: string;
  appUrl: string;
  username: string;
  password: string | null;
}

export class MemberService {
  constructor(
    private readonly participants: IParticipantRepository,
    private readonly accounts: IMemberAccountService,
  ) {}

  listActive(eventId: string) {
    return this.participants.listActive(eventId);
  }

  listMembers(eventId: string) {
    return this.participants.listMembers(eventId);
  }

  updateFamily(participantId: string, familyId: string | null) {
    return this.participants.updateFamily(participantId, familyId);
  }

  /** Corrige nombre, apellidos, dato para diferenciar y familia (mismas reglas que al agregar). */
  async updateMember(participantId: string, details: ParticipantDetails) {
    if (!isValidPersonName(details.firstName)) throw new AppError('FIRST_NAME_INVALID');
    if (!isValidPersonName(details.paternalSurname)) throw new AppError('PATERNAL_SURNAME_INVALID');
    if (details.maternalSurname?.trim() && !isValidPersonName(details.maternalSurname)) throw new AppError('MATERNAL_SURNAME_INVALID');
    const note = details.distinguishingNote?.trim() || null;
    if (note && note.length > 40) throw new AppError('DISTINGUISHING_NOTE_INVALID');

    await this.participants.updateDetails(participantId, {
      firstName: details.firstName.trim(),
      paternalSurname: details.paternalSurname.trim(),
      maternalSurname: details.maternalSurname?.trim() || null,
      distinguishingNote: note,
      familyId: details.familyId || null,
    });
  }

  async addMember(data: NewMemberData) {
    if (!isValidPersonName(data.firstName)) throw new AppError('FIRST_NAME_INVALID');
    if (!isValidPersonName(data.paternalSurname)) throw new AppError('PATERNAL_SURNAME_INVALID');
    if (data.maternalSurname?.trim() && !isValidPersonName(data.maternalSurname)) throw new AppError('MATERNAL_SURNAME_INVALID');

    let account = data.account;
    if (account) {
      const username = normalizeUsername(account.username);
      if (!USERNAME_PATTERN.test(username)) throw new AppError('USERNAME_INVALID');
      if (account.password.length < 8) throw new AppError('PASSWORD_INVALID');
      account = { ...account, username };
    } else if (data.role !== 'participant') {
      throw new AppError('ACCOUNT_REQUIRED_FOR_ROLE');
    }

    return this.accounts.createMember({
      ...data,
      maternalSurname: data.maternalSurname?.trim() || null,
      distinguishingNote: data.distinguishingNote?.trim() || null,
      account,
    });
  }

  async resetPassword(eventId: string, participantId: string, newPassword: string) {
    if (newPassword.length < 8) throw new AppError('PASSWORD_INVALID');
    await this.accounts.resetPassword(eventId, participantId, newPassword);
  }

  /** Mensaje para enviar por WhatsApp con el acceso de un familiar. */
  buildAccessMessage(input: AccessMessageInput): string {
    const loginUrl = `${input.appUrl}/entrar?c=${encodeURIComponent(input.joinCode)}&u=${encodeURIComponent(input.username)}`;
    const lines = [
      `¡Hola, ${input.firstName}! 🎄`,
      `Estamos organizando «${input.eventName}».`,
      '',
      'Entra aquí para elegir los regalos que te gustaría recibir y ver las actividades:',
      loginUrl,
      '',
      `🏠 Código de tu Navidad: ${input.joinCode}`,
      `👤 Tu usuario: ${input.username}`,
    ];
    if (input.password) lines.push(`🔑 Tu contraseña: ${input.password}`);
    else lines.push('🔑 Usa la contraseña que te envié antes. Si no la recuerdas, pídeme una nueva.');
    lines.push('', 'Este mensaje es solo para ti 🙂');
    return lines.join('\n');
  }
}
