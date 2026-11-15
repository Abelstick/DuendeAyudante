import type { SaveWishlistItemData, WishlistItem } from './WishlistItem';

export interface IWishlistRepository {
  listByEvent(eventId: string): Promise<WishlistItem[]>;
  /** Crea o actualiza el regalo y reemplaza sus enlaces (todo o nada). */
  save(data: SaveWishlistItemData): Promise<string>;
  remove(id: string): Promise<void>;
}
