export type AssignableRole = 'participant' | 'editor' | 'admin';

export interface NewMemberData {
  eventId: string;
  firstName: string;
  paternalSurname: string;
  maternalSurname: string | null;
  distinguishingNote: string | null;
  familyId: string | null;
  role: AssignableRole;
  /** null = sin usuario propio (lo maneja un tutor). */
  account: { username: string; password: string; autoSuffix: boolean } | null;
  guardianParticipantIds: string[];
}

export interface CreatedMember {
  participantId: string;
  fullName: string;
  username: string | null;
}

/** Gestión de cuentas de familiares (requiere privilegios de servidor). */
export interface IMemberAccountService {
  createMember(data: NewMemberData): Promise<CreatedMember>;
  resetPassword(eventId: string, participantId: string, newPassword: string): Promise<void>;
}
