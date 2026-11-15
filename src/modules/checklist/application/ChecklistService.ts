import type { Participant } from '@/modules/members/domain/Participant';
import { AppError } from '@/shared/domain/errors';
import { toTitleCase } from '@/shared/validation/names';
import { appliesTo, type ChecklistEntry, type ChecklistItem, type ChecklistProgress, type SaveChecklistItemData } from '../domain/Checklist';
import type { IChecklistRepository } from '../domain/IChecklistRepository';

export interface PersonalChecklistInput {
  eventId: string;
  me: Participant;
  wards: Participant[];
  items: ChecklistItem[];
  progress: ChecklistProgress[];
  /** Cantidad de regalos por participante. */
  wishCount: (participantId: string) => number;
}

export interface PersonalChecklist {
  entries: ChecklistEntry[];
  done: number;
  total: number;
  percent: number;
}

export class ChecklistService {
  constructor(private readonly checklist: IChecklistRepository) {}

  list(eventId: string) {
    return this.checklist.list(eventId);
  }

  listProgress(eventId: string) {
    return this.checklist.listProgress(eventId);
  }

  private validate(data: SaveChecklistItemData): SaveChecklistItemData {
    const title = data.title.trim();
    if (!title || title.length > 120) throw new AppError('CHECKLIST_TITLE_INVALID');
    if (data.scope === 'family' && !data.familyId) throw new AppError('CHECKLIST_FAMILY_REQUIRED');
    if (data.scope === 'participant' && !data.participantId) throw new AppError('CHECKLIST_PERSON_REQUIRED');
    return {
      title,
      description: data.description?.trim() || null,
      scope: data.scope,
      familyId: data.scope === 'family' ? data.familyId : null,
      participantId: data.scope === 'participant' ? data.participantId : null,
    };
  }

  async create(eventId: string, data: SaveChecklistItemData) {
    return this.checklist.create(eventId, this.validate(data));
  }

  async update(id: string, data: SaveChecklistItemData) {
    return this.checklist.update(id, this.validate(data));
  }

  remove(id: string) {
    return this.checklist.remove(id);
  }

  setDone(itemId: string, participantId: string, done: boolean) {
    return this.checklist.setDone(itemId, participantId, done);
  }

  /**
   * Checklist personal: primero las tareas automáticas (se marcan solas según
   * lo que la persona hizo), luego las que creó el organizador para ella.
   */
  static buildPersonal({ eventId, me, wards, items, progress, wishCount }: PersonalChecklistInput): PersonalChecklist {
    const giftsLink = `/e/${eventId}/regalos?agregar=1`;
    const entries: ChecklistEntry[] = [
      {
        key: 'auto:wishlist',
        title: 'Agrega tus opciones de regalo',
        description: 'Cuéntanos qué te gustaría recibir. Se marca solo cuando agregas tu primer regalo.',
        done: wishCount(me.id) > 0,
        kind: 'auto',
        participantId: me.id,
        link: giftsLink,
        linkLabel: 'Agregar regalo',
      },
      ...wards.map<ChecklistEntry>((w) => ({
        key: `auto:wishlist:${w.id}`,
        title: `Agrega los regalos de ${toTitleCase(w.firstName)}`,
        description: 'Se marca solo cuando agregas su primer regalo.',
        done: wishCount(w.id) > 0,
        kind: 'auto',
        participantId: w.id,
        link: `/e/${eventId}/regalos`,
        linkLabel: 'Ir a regalos',
      })),
    ];

    const doneSet = new Set(progress.map((p) => `${p.itemId}:${p.participantId}`));
    const mine = items.filter((i) => appliesTo(i, me)).sort((a, b) => a.sortOrder - b.sortOrder);
    for (const item of mine) {
      entries.push({
        key: `item:${item.id}`,
        title: item.title,
        description: item.description,
        done: doneSet.has(`${item.id}:${me.id}`),
        kind: 'manual',
        itemId: item.id,
        participantId: me.id,
      });
    }

    const done = entries.filter((e) => e.done).length;
    return { entries, done, total: entries.length, percent: entries.length ? Math.round((done / entries.length) * 100) : 0 };
  }
}
