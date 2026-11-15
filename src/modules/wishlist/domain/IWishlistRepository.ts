import type { SaveWishlistItemData, WishlistItem } from './WishlistItem';

export interface IWishlistRepository {
  listByEvent(eventId: string): Promise<WishlistItem[]>;
  /** Crea o actualiza el regalo y reemplaza sus enlaces (todo o nada). */
  save(data: SaveWishlistItemData): Promise<string>;
  remove(id: string): Promise<void>;
  /** Sube una foto al Google Drive de la familia de la persona y la agrega al regalo. */
  uploadPhoto(itemId: string, image: Blob): Promise<void>;
  /** Quita la foto del regalo (y su archivo de Drive). */
  removePhoto(photoId: string): Promise<void>;
}
