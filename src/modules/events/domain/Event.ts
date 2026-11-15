import type { Participant } from '@/modules/members/domain/Participant';

export type EventRole = 'owner' | 'admin' | 'editor' | 'participant';

export interface ChristmasEvent {
  id: string;
  name: string;
  /** Código que los familiares usan para entrar (ej. GARCIA25). Los códigos anteriores siguen funcionando. */
  joinCode: string;
  organizerName: string;
  description: string | null;
  /** Dónde es la celebración (texto libre: calle, número, distrito, referencia). */
  address: string | null;
  celebrationAt: Date;
  timezone: string;
  currency: string;
  giftExchange: { id: string; budgetMax: number } | null;
}

export interface MyEventSummary {
  event: ChristmasEvent;
  role: EventRole;
}

/** Lo que el usuario actual es y puede hacer dentro de un evento. */
export interface EventContext {
  role: EventRole;
  me: Participant | null;
  /** Personas a su cargo (hijos u otros familiares). */
  wards: Participant[];
}

export const ROLE_LABELS: Record<EventRole, string> = {
  owner: 'Organizador',
  admin: 'Administrador',
  editor: 'Editor',
  participant: 'Participante',
};

/** Organizador o administrador: gestiona familias, integrantes y cuentas. */
export const canManageEvent = (role: EventRole) => role === 'owner' || role === 'admin';

/** Además del anterior, el editor: responsabilidades, cronograma, anuncios, juegos. */
export const canEditContent = (role: EventRole) => canManageEvent(role) || role === 'editor';

/** Participantes por los que el usuario puede actuar (él mismo + personas a cargo). */
export function actingParticipants(ctx: EventContext): Participant[] {
  return ctx.me ? [ctx.me, ...ctx.wards] : [...ctx.wards];
}

export interface CreateEventInput {
  name: string;
  joinCode: string;
  firstName: string;
  paternalSurname: string;
  maternalSurname: string | null;
  /** "YYYY-MM-DD" en la zona del evento */
  date: string;
  /** "HH:mm" en la zona del evento */
  time: string;
  timezone: string;
  budget: number;
  description: string | null;
}

/** Qué copiar al crear la Navidad del próximo año a partir de una anterior. */
export interface DuplicateEventInput {
  sourceEventId: string;
  name: string;
  joinCode: string;
  /** "YYYY-MM-DD" en la zona del evento */
  date: string;
  /** "HH:mm" en la zona del evento */
  time: string;
  timezone: string;
  copyMembers: boolean;
  copyChecklist: boolean;
  copyResponsibilities: boolean;
  copySchedule: boolean;
}

const YEAR_RE = /\b(19|20)\d{2}\b/;

/** "Navidad García 2026" → "Navidad García 2027"; sin año, se le agrega. */
export function nextYearName(name: string, nextYear: number): string {
  const trimmed = name.trim();
  return YEAR_RE.test(trimmed) ? trimmed.replace(YEAR_RE, String(nextYear)) : `${trimmed} ${nextYear}`;
}

/** "GARCIA2026" → "GARCIA2027"; "GARCIA26" → "GARCIA27"; sin número al final, se agrega el año corto. */
export function nextYearJoinCode(code: string, nextYear: number): string {
  const full = String(nextYear);
  if (/(19|20)\d{2}$/.test(code)) return code.replace(/(19|20)\d{2}$/, full);
  if (/\d{2}$/.test(code)) return code.replace(/\d{2}$/, full.slice(2));
  return `${code.slice(0, 18)}${full.slice(2)}`;
}
