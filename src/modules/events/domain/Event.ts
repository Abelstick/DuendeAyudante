import type { Participant } from '@/modules/members/domain/Participant';

export type EventRole = 'owner' | 'admin' | 'editor' | 'participant';

export interface ChristmasEvent {
  id: string;
  name: string;
  /** Código que los familiares usan para entrar (ej. GARCIA25). No cambia. */
  joinCode: string;
  organizerName: string;
  description: string | null;
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
