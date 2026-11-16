import type { ChristmasEvent, EventContext, MyEventSummary } from './Event';

export interface CreateEventData {
  name: string;
  /** Ya normalizado: "GARCIA25" */
  joinCode: string;
  firstName: string;
  paternalSurname: string;
  maternalSurname: string | null;
  celebrationAt: Date;
  timezone: string;
  budget: number;
  description: string | null;
}

export interface IEventRepository {
  listMine(): Promise<MyEventSummary[]>;
  findById(id: string): Promise<ChristmasEvent | null>;
  create(data: CreateEventData): Promise<string>;
  isJoinCodeAvailable(code: string): Promise<boolean>;
  /** Cambia el código y los accesos de los familiares; devuelve el código guardado. */
  changeJoinCode(eventId: string, newCode: string): Promise<string>;
  getMyContext(eventId: string): Promise<EventContext>;
  /** Cambia el monto acordado del intercambio (solo organizador/administradores, por RLS). */
  updateBudget(eventId: string, amount: number): Promise<void>;
  /** Cambia la descripción de la celebración (null la borra). */
  updateDescription(eventId: string, description: string | null): Promise<void>;
  /** Cambia la dirección de la celebración y de quién es la casa (null los borra). */
  updateAddress(eventId: string, address: string | null, host: string | null): Promise<void>;
  /** Crea la Navidad del próximo año copiando lo elegido; devuelve su id. */
  duplicate(data: DuplicateEventData): Promise<string>;
}

export interface DuplicateEventData {
  sourceEventId: string;
  name: string;
  /** Ya normalizado: "GARCIA27" */
  joinCode: string;
  celebrationAt: Date;
  copyMembers: boolean;
  copyChecklist: boolean;
  copyResponsibilities: boolean;
  copySchedule: boolean;
}
