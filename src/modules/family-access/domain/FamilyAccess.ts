import type { FamilyColor } from '@/modules/families/domain/Family';

/** Enlace y palabra secreta de una familia (solo lo ve quien administra). */
export interface FamilyAccess {
  familyId: string;
  /** Identificador del enlace: /f/<linkToken>. Se crea una vez y no cambia. */
  linkToken: string;
  secretWord: string;
}

/** Lo que ve un familiar al abrir el enlace, antes de escribir la palabra. */
export interface FamilyLinkInfo {
  eventName: string;
  familyName: string;
  familyColor: FamilyColor;
}

/** Persona que puede entrar con el enlace (solo participantes con cuenta). */
export interface FamilyLinkMember {
  participantId: string;
  name: string;
}

export interface IFamilyAccessRepository {
  /** Enlaces ya creados en el evento (solo organizador/administradores). */
  listForEvent(eventId: string): Promise<FamilyAccess[]>;
  /** Crea el enlace (la primera vez) o cambia la palabra; el enlace no cambia. */
  setWord(familyId: string, word: string): Promise<FamilyAccess>;
  getInfo(linkToken: string): Promise<FamilyLinkInfo>;
  listMembers(linkToken: string, word: string): Promise<FamilyLinkMember[]>;
  /** Devuelve un pase de un solo uso para iniciar la sesión de esa persona. */
  enter(linkToken: string, word: string, participantId: string): Promise<string>;
}

export const SECRET_WORD_PATTERN = /^[A-Z0-9Ñ]{4,20}$/;

/**
 * "  Panetón 25 " → "PANETON25": mayúsculas, sin tildes ni espacios (la Ñ se conserva).
 * Igual que app.normalize_secret_word en la base y que la Edge Function family-access.
 */
export function normalizeSecretWord(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/Ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\u0001/g, 'Ñ')
    .replace(/\s+/g, '');
}

const WORDS = ['PANETON', 'ESTRELLA', 'TURRON', 'CAMPANA', 'REGALO', 'CHOCOLATE', 'VILLANCICO', 'PESEBRE', 'TRINEO', 'CASCABEL', 'GALLETA', 'LUCERO'];

/** Propone una palabra navideña fácil de decir por teléfono. */
export function suggestSecretWord(random: () => number = Math.random): string {
  return WORDS[Math.floor(random() * WORDS.length)] ?? 'NAVIDAD';
}

export function familyLinkUrl(appUrl: string, linkToken: string): string {
  return `${appUrl}/f/${linkToken}`;
}

/** Mensaje para el grupo de WhatsApp de la familia. */
export function buildFamilyLinkMessage(input: { eventName: string; familyName: string; appUrl: string; linkToken: string; secretWord: string }): string {
  return [
    `¡Hola, familia ${input.familyName}! 🎄`,
    `Ya pueden entrar a «${input.eventName}» para elegir sus regalos y ver las actividades.`,
    '',
    '1. Abran este enlace:',
    familyLinkUrl(input.appUrl, input.linkToken),
    '',
    `2. Escriban la palabra secreta: ${input.secretWord}`,
    '3. Elijan su nombre de la lista. ¡Listo!',
    '',
    'Este enlace es solo para nuestra familia 🙂',
  ].join('\n');
}
