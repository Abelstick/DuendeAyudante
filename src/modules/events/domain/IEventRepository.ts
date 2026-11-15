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
}
