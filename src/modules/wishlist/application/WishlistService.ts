import { AppError } from '@/shared/domain/errors';
import type { IWishlistRepository } from '../domain/IWishlistRepository';
import {
  isValidHttpUrl,
  MAX_BRAND_LENGTH,
  MAX_BRANDS_PER_ITEM,
  MAX_LINKS_PER_ITEM,
  normalizeBrands,
  normalizeUrl,
  type SaveWishlistItemData,
  type WishlistItem,
} from '../domain/WishlistItem';
import { MAX_PHOTOS_PER_ITEM } from '../domain/WishlistPhoto';

const isBadPrice = (p: number | null) => p !== null && (Number.isNaN(p) || p < 0);

export class WishlistService {
  constructor(private readonly wishes: IWishlistRepository) {}

  listByEvent(eventId: string) {
    return this.wishes.listByEvent(eventId);
  }

  /** Agrupa los regalos por participante, en el orden en que se agregaron. */
  static groupByParticipant(items: WishlistItem[]): Map<string, WishlistItem[]> {
    const map = new Map<string, WishlistItem[]>();
    for (const item of items) {
      const list = map.get(item.participantId) ?? [];
      list.push(item);
      map.set(item.participantId, list);
    }
    return map;
  }

  /** Los regalos que más ilusión le hacen primero ("Me encantaría"); a igual prioridad, los más antiguos. */
  static byPriority(items: readonly WishlistItem[]): WishlistItem[] {
    return [...items].sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime());
  }

  /** Sube una foto (la usa la cola de subida, que las manda de a una y reintenta). */
  uploadPhoto(itemId: string, image: Blob) {
    return this.wishes.uploadPhoto(itemId, image);
  }

  /** Cuántas fotos nuevas caben en un regalo, contando las guardadas y las que esperan en cola. */
  static photoRoom(attached: number, queued: number): number {
    return Math.max(0, MAX_PHOTOS_PER_ITEM - attached - queued);
  }

  removePhoto(photoId: string) {
    return this.wishes.removePhoto(photoId);
  }

  async save(data: SaveWishlistItemData): Promise<string> {
    const title = data.title.trim();
    if (!title || title.length > 120) throw new AppError('WISH_TITLE_INVALID');
    if (data.description && data.description.length > 1000) throw new AppError('WISH_DESCRIPTION_TOO_LONG');
    if (isBadPrice(data.priceMin) || isBadPrice(data.priceMax)) throw new AppError('PRICE_INVALID');
    if (data.priceMin !== null && data.priceMax !== null && data.priceMax < data.priceMin) {
      throw new AppError('PRICE_RANGE_INVALID');
    }

    const brands = normalizeBrands(data.brands);
    if (brands.length > MAX_BRANDS_PER_ITEM) throw new AppError('TOO_MANY_BRANDS');
    if (brands.some((b) => b.length > MAX_BRAND_LENGTH)) throw new AppError('BRAND_TOO_LONG');

    const links = data.links
      .map((l) => ({ url: normalizeUrl(l.url), label: l.label?.trim() || null }))
      .filter((l) => l.url !== '');
    if (links.length > MAX_LINKS_PER_ITEM) throw new AppError('TOO_MANY_LINKS');
    if (links.some((l) => !isValidHttpUrl(l.url))) throw new AppError('LINK_INVALID');

    return this.wishes.save({ ...data, title, description: data.description?.trim() || null, links, brands });
  }

  remove(id: string) {
    return this.wishes.remove(id);
  }
}
