/**
 * Mensajes navideños: se escriben antes y quien los recibe los lee desde la
 * medianoche del día de la celebración. Pueden ir sin firma.
 */
export interface SentMessage {
  id: string;
  eventId: string;
  fromId: string;
  toId: string;
  body: string;
  anonymous: boolean;
  createdAt: Date;
}

export interface ReceivedMessage {
  id: string;
  toId: string;
  /** null antes de la apertura o si es anónimo. */
  fromName: string | null;
  /** null antes de la apertura. */
  body: string | null;
  createdAt: Date;
  unlockAt: Date;
  unlocked: boolean;
}

export interface SaveMessageData {
  id: string | null;
  eventId: string;
  fromId: string;
  toId: string;
  body: string;
  anonymous: boolean;
}

export const MAX_MESSAGE_LENGTH = 1000;

/** Ideas para empezar cuando no se sabe qué escribir. */
export const MESSAGE_STARTERS = [
  'Gracias por estar siempre. ¡Feliz Navidad!',
  'Este año aprendí mucho de ti. Te quiero mucho.',
  'Tengo un recuerdo contigo que nunca olvido: ',
  'Te deseo un año nuevo lleno de salud y alegría.',
];
