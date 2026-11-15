import type { ChecklistItem, ChecklistProgress, SaveChecklistItemData } from './Checklist';

export interface IChecklistRepository {
  list(eventId: string): Promise<ChecklistItem[]>;
  listProgress(eventId: string): Promise<ChecklistProgress[]>;
  create(eventId: string, data: SaveChecklistItemData): Promise<void>;
  update(id: string, data: SaveChecklistItemData): Promise<void>;
  remove(id: string): Promise<void>;
  setDone(itemId: string, participantId: string, done: boolean): Promise<void>;
}
