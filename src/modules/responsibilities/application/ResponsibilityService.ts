import type { Participant } from '@/modules/members/domain/Participant';
import { AppError } from '@/shared/domain/errors';
import type { IResponsibilityRepository } from '../domain/IResponsibilityRepository';
import { isAssignedTo, type Responsibility, type ResponsibilityStatus, type SaveResponsibilityData } from '../domain/Responsibility';

export interface ResponsibilityFilters {
  kind: 'all' | Responsibility['kind'];
  onlyMine: boolean;
  familyId: string | null;
  participantId: string | null;
  status: 'all' | ResponsibilityStatus;
}

export const DEFAULT_FILTERS: ResponsibilityFilters = { kind: 'all', onlyMine: false, familyId: null, participantId: null, status: 'all' };

const STATUS_ORDER: Record<ResponsibilityStatus, number> = { in_progress: 0, pending: 1, done: 2 };

export class ResponsibilityService {
  constructor(private readonly responsibilities: IResponsibilityRepository) {}

  list(eventId: string) {
    return this.responsibilities.list(eventId);
  }

  async save(data: SaveResponsibilityData): Promise<string> {
    const title = data.title.trim();
    if (!title || title.length > 120) throw new AppError('RESPONSIBILITY_TITLE_INVALID');
    if (data.participantIds.length === 0 && data.familyIds.length === 0) throw new AppError('RESPONSIBLE_REQUIRED');
    return this.responsibilities.save({
      ...data,
      title,
      description: data.description?.trim() || null,
      notes: data.notes?.trim() || null,
      participantIds: [...new Set(data.participantIds)],
      familyIds: [...new Set(data.familyIds)],
    });
  }

  remove(id: string) {
    return this.responsibilities.remove(id);
  }

  setStatus(id: string, status: ResponsibilityStatus) {
    return this.responsibilities.setStatus(id, status);
  }

  /** Las que le tocan a la persona, a su familia o a quienes tiene a cargo. */
  static mine(items: Responsibility[], people: Pick<Participant, 'id' | 'familyId'>[]): Responsibility[] {
    return ResponsibilityService.sort(items.filter((r) => isAssignedTo(r, people)));
  }

  /** Primero lo que está en progreso, luego pendiente, al final lo completado; por fecha límite. */
  static sort(items: Responsibility[]): Responsibility[] {
    return [...items].sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
        a.title.localeCompare(b.title, 'es'),
    );
  }

  static filter(
    items: Responsibility[],
    f: ResponsibilityFilters,
    me: Pick<Participant, 'id' | 'familyId'>[],
    allPeople: Pick<Participant, 'id' | 'familyId'>[],
  ): Responsibility[] {
    return ResponsibilityService.sort(
      items.filter((r) => {
        if (f.kind !== 'all' && r.kind !== f.kind) return false;
        if (f.status !== 'all' && r.status !== f.status) return false;
        if (f.onlyMine && !isAssignedTo(r, me)) return false;
        if (f.familyId) {
          // De la familia: asignada a la familia o a alguno de sus integrantes
          const members = allPeople.filter((p) => p.familyId === f.familyId).map((p) => p.id);
          if (!r.familyIds.includes(f.familyId) && !r.participantIds.some((id) => members.includes(id))) return false;
        }
        if (f.participantId) {
          const person = allPeople.find((p) => p.id === f.participantId);
          if (!person || !isAssignedTo(r, [person])) return false;
        }
        return true;
      }),
    );
  }
}
