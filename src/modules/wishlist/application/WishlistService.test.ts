import { describe, expect, it, vi } from 'vitest';
import type { IWishlistRepository } from '../domain/IWishlistRepository';
import type { SaveWishlistItemData } from '../domain/WishlistItem';
import { isOverBudget } from '../domain/WishlistItem';
import { WishlistService } from './WishlistService';

function setup() {
  const repo: IWishlistRepository = {
    listByEvent: vi.fn(),
    save: vi.fn().mockResolvedValue('new-id'),
    remove: vi.fn(),
  };
  return { repo, service: new WishlistService(repo) };
}

const base: SaveWishlistItemData = {
  id: null,
  eventId: 'e',
  participantId: 'p',
  title: ' Polo ',
  description: '  ',
  priceEstimate: 45,
  priority: 2,
  links: [],
};

describe('WishlistService.save', () => {
  it('limpia el título, la descripción vacía y completa https:// en los enlaces', async () => {
    const { repo, service } = setup();
    await service.save({ ...base, links: [{ url: 'falabella.com.pe/polo', label: ' Falabella ' }, { url: '  ', label: null }] });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Polo',
        description: null,
        links: [{ url: 'https://falabella.com.pe/polo', label: 'Falabella' }],
      }),
    );
  });

  it('exige el nombre del regalo', async () => {
    const { service } = setup();
    await expect(service.save({ ...base, title: '   ' })).rejects.toMatchObject({ code: 'WISH_TITLE_INVALID' });
  });

  it('rechaza más de 5 enlaces, enlaces raros y precios negativos', async () => {
    const { service } = setup();
    const six = Array.from({ length: 6 }, (_, i) => ({ url: `https://t.pe/${i}`, label: null }));
    await expect(service.save({ ...base, links: six })).rejects.toMatchObject({ code: 'TOO_MANY_LINKS' });
    await expect(service.save({ ...base, links: [{ url: 'javascript:alert(1)', label: null }] })).rejects.toMatchObject({
      code: 'LINK_INVALID',
    });
    await expect(service.save({ ...base, priceEstimate: -1 })).rejects.toMatchObject({ code: 'PRICE_INVALID' });
  });
});

describe('presupuesto', () => {
  it('avisa cuando el precio supera el presupuesto', () => {
    expect(isOverBudget({ priceEstimate: 70 }, 65)).toBe(true);
    expect(isOverBudget({ priceEstimate: 65 }, 65)).toBe(false);
    expect(isOverBudget({ priceEstimate: null }, 65)).toBe(false);
  });
});
