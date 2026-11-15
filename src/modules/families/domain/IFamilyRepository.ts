import type { Family, FamilyColor } from './Family';

export interface SaveFamilyData {
  name: string;
  color: FamilyColor;
  dressCodeNote: string | null;
}

export interface IFamilyRepository {
  list(eventId: string): Promise<Family[]>;
  create(eventId: string, data: SaveFamilyData): Promise<void>;
  update(id: string, data: SaveFamilyData): Promise<void>;
  remove(id: string): Promise<void>;
}
