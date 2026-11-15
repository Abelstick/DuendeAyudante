export type WishPriority = 1 | 2 | 3;

export interface WishlistLink {
  url: string;
  label: string | null;
}

export interface WishlistItem {
  id: string;
  eventId: string;
  participantId: string;
  title: string;
  description: string | null;
  priceEstimate: number | null;
  priority: WishPriority;
  links: WishlistLink[];
  createdAt: Date;
}

export interface SaveWishlistItemData {
  id: string | null;
  eventId: string;
  participantId: string;
  title: string;
  description: string | null;
  priceEstimate: number | null;
  priority: WishPriority;
  links: WishlistLink[];
}

export const MAX_LINKS_PER_ITEM = 5;

export const PRIORITY_LABELS: Record<WishPriority, string> = {
  1: 'Me encantaría',
  2: 'Me gustaría',
  3: 'Si se puede',
};

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Si la persona pegó "falabella.com/..." sin https://, se lo agregamos. */
export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function isOverBudget(item: Pick<WishlistItem, 'priceEstimate'>, budget: number | null | undefined): boolean {
  return item.priceEstimate !== null && budget != null && item.priceEstimate > budget;
}
