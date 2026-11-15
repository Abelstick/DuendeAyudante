import type { SupabaseClient } from '@supabase/supabase-js';
import { fromFunctionError, fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { IWishlistRepository } from '../domain/IWishlistRepository';
import type { SaveWishlistItemData, WishlistItem, WishPriority } from '../domain/WishlistItem';

interface WishlistRow {
  id: string;
  event_id: string;
  participant_id: string;
  title: string;
  description: string | null;
  price_estimate: number | string | null;
  price_max: number | string | null;
  brands: string[] | null;
  priority: WishPriority;
  created_at: string;
  wishlist_item_links: { url: string; label: string | null; sort_order: number }[] | null;
  wishlist_photos: { id: string; drive_file_id: string; sort_order: number }[] | null;
}

const PHOTOS_FUNCTION = 'google-drive';

export class SupabaseWishlistRepository implements IWishlistRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByEvent(eventId: string): Promise<WishlistItem[]> {
    const { data, error } = await this.supabase
      .from('wishlist_items')
      .select(
        'id, event_id, participant_id, title, description, price_estimate, price_max, brands, priority, created_at, wishlist_item_links(url, label, sort_order), wishlist_photos(id, drive_file_id, sort_order)',
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
      priceMin: r.price_estimate === null ? null : Number(r.price_estimate),
      priceMax: r.price_max === null ? null : Number(r.price_max),
      brands: r.brands ?? [],
      priority: r.priority,
      createdAt: new Date(r.created_at),
      links: [...(r.wishlist_item_links ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => ({ url: l.url, label: l.label })),
      photos: [...(r.wishlist_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((p) => ({ id: p.id, driveFileId: p.drive_file_id })),
    }));
  }

  async uploadPhoto(itemId: string, image: Blob): Promise<void> {
    const form = new FormData();
    form.append('itemId', itemId);
    form.append('file', image, image instanceof File ? image.name : 'foto.jpg');
    const { error } = await this.supabase.functions.invoke(PHOTOS_FUNCTION, { body: form });
    if (error) throw await fromFunctionError(error);
  }

  async removePhoto(photoId: string): Promise<void> {
    const { error } = await this.supabase.functions.invoke(PHOTOS_FUNCTION, { body: { action: 'delete-photo', photoId } });
    if (error) throw await fromFunctionError(error);
  }

  async save(data: SaveWishlistItemData): Promise<string> {
    const { data: id, error } = await this.supabase.rpc('save_wishlist_item', {
      p_event_id: data.eventId,
      p_participant_id: data.participantId,
      p_title: data.title,
      p_description: data.description,
      p_price_estimate: data.priceMin,
      p_price_max: data.priceMax,
      p_brands: data.brands,
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
