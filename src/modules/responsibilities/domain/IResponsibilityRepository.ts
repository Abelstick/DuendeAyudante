import type { Responsibility, ResponsibilityStatus, SaveResponsibilityData } from './Responsibility';

export interface IResponsibilityRepository {
  list(eventId: string): Promise<Responsibility[]>;
  /** Crea o edita, reemplazando los responsables (todo o nada). */
  save(data: SaveResponsibilityData): Promise<string>;
  remove(id: string): Promise<void>;
  /** Solo cambia el estado (lo pueden hacer los responsables). */
  setStatus(id: string, status: ResponsibilityStatus): Promise<void>;
}
