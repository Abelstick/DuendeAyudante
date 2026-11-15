import type { SupabaseClient } from '@supabase/supabase-js';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { IWishlistRepository } from '../domain/IWishlistRepository';
import type { SaveWishlistItemData, WishlistItem, WishPriority } from '../domain/WishlistItem';

interface WishlistRow {
  id: string;
  event_id: string;
  participant_id: string;
  title: string;
  description: string | null;
  price_estimate: number | string | null;
  priority: WishPriority;
  created_at: string;
  wishlist_item_links: { url: string; label: string | null; sort_order: number }[] | null;
}

export class SupabaseWishlistRepository implements IWishlistRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByEvent(eventId: string): Promise<WishlistItem[]> {
    const { data, error } = await this.supabase
      .from('wishlist_items')
      .select(
        'id, event_id, participant_id, title, description, price_estimate, priority, created_at, wishlist_item_links(url, label, sort_order)',
      )
      .eq('event_id', eventId)
      .order('priority')
      .order('created_at')
      .returns<WishlistRow[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((r) => ({
      id: r.id,
      eventId: r.event_id,
      participantId: r.participant_id,
      title: r.title,
      description: r.description,
      priceEstimate: r.price_estimate === null ? null : Number(r.price_estimate),
      priority: r.priority,
      createdAt: new Date(r.created_at),
      links: [...(r.wishlist_item_links ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => ({ url: l.url, label: l.label })),
    }));
  }

  async save(data: SaveWishlistItemData): Promise<string> {
    const { data: id, error } = await this.supabase.rpc('save_wishlist_item', {
      p_event_id: data.eventId,
      p_participant_id: data.participantId,
      p_title: data.title,
      p_description: data.description,
      p_price_estimate: data.priceEstimate,
      p_priority: data.priority,
      p_links: data.links,
      p_item_id: data.id,
    });
    if (error) throw fromPostgrestError(error);
    return id as string;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('wishlist_items').delete().eq('id', id);
    if (error) throw fromPostgrestError(error);
  }
}
