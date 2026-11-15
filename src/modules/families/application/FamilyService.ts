import { AppError } from '@/shared/domain/errors';
import { normalizeName } from '@/shared/validation/names';
import type { IFamilyRepository, SaveFamilyData } from '../domain/IFamilyRepository';

export class FamilyService {
  constructor(private readonly families: IFamilyRepository) {}

  list(eventId: string) {
    return this.families.list(eventId);
  }

  private validate(data: SaveFamilyData): SaveFamilyData {
    const name = normalizeName(data.name);
    if (!name || name.length > 60) throw new AppError('FAMILY_NAME_INVALID');
    return { ...data, name, dressCodeNote: data.dressCodeNote?.trim() || null };
  }

  async create(eventId: string, data: SaveFamilyData) {
    return this.families.create(eventId, this.validate(data));
  }

  async update(id: string, data: SaveFamilyData) {
    return this.families.update(id, this.validate(data));
  }

  remove(id: string) {
    return this.families.remove(id);
  }
}
