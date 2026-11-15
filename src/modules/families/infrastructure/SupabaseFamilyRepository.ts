import type { SupabaseClient } from '@supabase/supabase-js';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { Family, FamilyColor } from '../domain/Family';
import type { IFamilyRepository, SaveFamilyData } from '../domain/IFamilyRepository';

interface FamilyRow {
  id: string;
  event_id: string;
  name: string;
  color_key: FamilyColor;
  dress_code_note: string | null;
}

export class SupabaseFamilyRepository implements IFamilyRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(eventId: string): Promise<Family[]> {
    const { data, error } = await this.supabase
      .from('families')
      .select('id, event_id, name, color_key, dress_code_note')
      .eq('event_id', eventId)
      .order('sort_order')
      .order('name')
      .returns<FamilyRow[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((r) => ({
      id: r.id,
      eventId: r.event_id,
      name: r.name,
      color: r.color_key,
      dressCodeNote: r.dress_code_note,
    }));
  }

  async create(eventId: string, data: SaveFamilyData): Promise<void> {
    const { error } = await this.supabase.from('families').insert({
      event_id: eventId,
      name: data.name,
      color_key: data.color,
      dress_code_note: data.dressCodeNote,
    });
    if (error) throw fromPostgrestError(error);
  }

  async update(id: string, data: SaveFamilyData): Promise<void> {
    const { error } = await this.supabase
      .from('families')
      .update({ name: data.name, color_key: data.color, dress_code_note: data.dressCodeNote })
      .eq('id', id);
    if (error) throw fromPostgrestError(error);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('families').delete().eq('id', id);
    if (error) throw fromPostgrestError(error);
  }
}
