import type { SupabaseClient } from '@supabase/supabase-js';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { ChecklistItem, ChecklistProgress, ChecklistScope, SaveChecklistItemData } from '../domain/Checklist';
import type { IChecklistRepository } from '../domain/IChecklistRepository';

interface ItemRow {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  scope: ChecklistScope;
  family_id: string | null;
  participant_id: string | null;
  sort_order: number;
}

const toRow = (data: SaveChecklistItemData) => ({
  title: data.title,
  description: data.description,
  scope: data.scope,
  family_id: data.familyId,
  participant_id: data.participantId,
});

export class SupabaseChecklistRepository implements IChecklistRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(eventId: string): Promise<ChecklistItem[]> {
    const { data, error } = await this.supabase
      .from('checklist_items')
      .select('id, event_id, title, description, scope, family_id, participant_id, sort_order')
      .eq('event_id', eventId)
      .order('sort_order')
      .order('created_at')
      .returns<ItemRow[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((r) => ({
      id: r.id,
      eventId: r.event_id,
      title: r.title,
      description: r.description,
      scope: r.scope,
      familyId: r.family_id,
      participantId: r.participant_id,
      sortOrder: r.sort_order,
    }));
  }

  async listProgress(eventId: string): Promise<ChecklistProgress[]> {
    const { data, error } = await this.supabase
      .from('checklist_progress')
      .select('item_id, participant_id, checklist_items!inner(event_id)')
      .eq('checklist_items.event_id', eventId)
      .returns<{ item_id: string; participant_id: string }[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((r) => ({ itemId: r.item_id, participantId: r.participant_id }));
  }

  async create(eventId: string, data: SaveChecklistItemData): Promise<void> {
    const { error } = await this.supabase.from('checklist_items').insert({ event_id: eventId, ...toRow(data) });
    if (error) throw fromPostgrestError(error);
  }

  async update(id: string, data: SaveChecklistItemData): Promise<void> {
    const { error } = await this.supabase.from('checklist_items').update(toRow(data)).eq('id', id);
    if (error) throw fromPostgrestError(error);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('checklist_items').delete().eq('id', id);
    if (error) throw fromPostgrestError(error);
  }

  async setDone(itemId: string, participantId: string, done: boolean): Promise<void> {
    const { error } = done
      ? await this.supabase.from('checklist_progress').insert({ item_id: itemId, participant_id: participantId })
      : await this.supabase.from('checklist_progress').delete().eq('item_id', itemId).eq('participant_id', participantId);
    // Si ya estaba marcada (doble toque), no es un error
    if (error && error.code !== '23505') throw fromPostgrestError(error);
  }
}
