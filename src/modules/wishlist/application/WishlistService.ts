import { AppError } from '@/shared/domain/errors';
import type { IWishlistRepository } from '../domain/IWishlistRepository';
import { isValidHttpUrl, MAX_LINKS_PER_ITEM, normalizeUrl, type SaveWishlistItemData, type WishlistItem } from '../domain/WishlistItem';

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

  async save(data: SaveWishlistItemData): Promise<string> {
    const title = data.title.trim();
    if (!title || title.length > 120) throw new AppError('WISH_TITLE_INVALID');
    if (data.description && data.description.length > 1000) throw new AppError('WISH_DESCRIPTION_TOO_LONG');
    if (data.priceEstimate !== null && (Number.isNaN(data.priceEstimate) || data.priceEstimate < 0)) {
      throw new AppError('PRICE_INVALID');
    }

    const links = data.links
      .map((l) => ({ url: normalizeUrl(l.url), label: l.label?.trim() || null }))
      .filter((l) => l.url !== '');
    if (links.length > MAX_LINKS_PER_ITEM) throw new AppError('TOO_MANY_LINKS');
    if (links.some((l) => !isValidHttpUrl(l.url))) throw new AppError('LINK_INVALID');

    return this.wishes.save({ ...data, title, description: data.description?.trim() || null, links });
  }

  remove(id: string) {
    return this.wishes.remove(id);
  }
}
