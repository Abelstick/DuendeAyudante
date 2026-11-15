import type { WishlistPhoto } from './WishlistPhoto';

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
  /** "Desde", o el precio aproximado si no hay "hasta". */
  priceMin: number | null;
  /** "Hasta". */
  priceMax: number | null;
  /** Marcas que le gustan; vacía = cualquier marca. */
  brands: string[];
  priority: WishPriority;
  links: WishlistLink[];
  /** Fotos de referencia, en orden (la primera es la portada). */
  photos: WishlistPhoto[];
  createdAt: Date;
}

export interface SaveWishlistItemData {
  id: string | null;
  eventId: string;
  participantId: string;
  title: string;
  description: string | null;
  priceMin: number | null;
  priceMax: number | null;
  brands: string[];
  priority: WishPriority;
  links: WishlistLink[];
}

export const MAX_LINKS_PER_ITEM = 5;
export const MAX_BRANDS_PER_ITEM = 8;
export const MAX_BRAND_LENGTH = 40;

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

/** Quita espacios sobrantes, vacías y repetidas (sin importar mayúsculas), conservando el orden. */
export function normalizeBrands(brands: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of brands) {
    const brand = raw.trim().replace(/\s+/g, ' ');
    const key = brand.toLocaleLowerCase('es');
    if (!brand || seen.has(key)) continue;
    seen.add(key);
    out.push(brand);
  }
  return out;
}

/** Está sobre el presupuesto cuando incluso el precio más bajo lo supera. */
export function isOverBudget(item: Pick<WishlistItem, 'priceMin'>, budget: number | null | undefined): boolean {
  return item.priceMin !== null && budget != null && item.priceMin > budget;
}

/**
 * Texto del precio para mostrar:
 *  · desde y hasta → "S/ 50.00 – S/ 80.00"
 *  · solo desde    → "S/ 50.00" (precio aproximado)
 *  · solo hasta    → "Hasta S/ 80.00"
 */
export function describePrice(
  item: Pick<WishlistItem, 'priceMin' | 'priceMax'>,
  format: (n: number) => string,
): string | null {
  const { priceMin: min, priceMax: max } = item;
  if (min !== null && max !== null) return min === max ? format(min) : `${format(min)} – ${format(max)}`;
  if (min !== null) return format(min);
  if (max !== null) return `Hasta ${format(max)}`;
  return null;
}
