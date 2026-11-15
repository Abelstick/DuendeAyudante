import { describe, expect, it, vi } from 'vitest';
import type { IWishlistRepository } from '../domain/IWishlistRepository';
import type { SaveWishlistItemData } from '../domain/WishlistItem';
import { describePrice, isOverBudget } from '../domain/WishlistItem';
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
  priceMin: 45,
  priceMax: null,
  brands: [],
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
    await expect(service.save({ ...base, priceMin: -1 })).rejects.toMatchObject({ code: 'PRICE_INVALID' });
    await expect(service.save({ ...base, priceMax: -1 })).rejects.toMatchObject({ code: 'PRICE_INVALID' });
  });

  it('exige que el precio «hasta» no sea menor que «desde»', async () => {
    const { service } = setup();
    await expect(service.save({ ...base, priceMin: 80, priceMax: 50 })).rejects.toMatchObject({ code: 'PRICE_RANGE_INVALID' });
    await expect(service.save({ ...base, priceMin: 50, priceMax: 50 })).resolves.toBe('new-id');
  });

  it('limpia las marcas: sin vacías ni repetidas, y con límite', async () => {
    const { repo, service } = setup();
    await service.save({ ...base, brands: [' Nike ', 'nike', '', 'Adidas  Originals'] });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ brands: ['Nike', 'Adidas Originals'] }));

    const nine = Array.from({ length: 9 }, (_, i) => `Marca ${i}`);
    await expect(service.save({ ...base, brands: nine })).rejects.toMatchObject({ code: 'TOO_MANY_BRANDS' });
    await expect(service.save({ ...base, brands: ['x'.repeat(41)] })).rejects.toMatchObject({ code: 'BRAND_TOO_LONG' });
  });
});

describe('precio', () => {
  it('avisa cuando hasta el precio más bajo supera el presupuesto', () => {
    expect(isOverBudget({ priceMin: 70 }, 65)).toBe(true);
    expect(isOverBudget({ priceMin: 65 }, 65)).toBe(false);
    expect(isOverBudget({ priceMin: null }, 65)).toBe(false);
  });

  it('describe el precio según lo que se llenó', () => {
    const fmt = (n: number) => `S/ ${n}`;
    expect(describePrice({ priceMin: 50, priceMax: 80 }, fmt)).toBe('S/ 50 – S/ 80');
    expect(describePrice({ priceMin: 50, priceMax: 50 }, fmt)).toBe('S/ 50');
    expect(describePrice({ priceMin: 50, priceMax: null }, fmt)).toBe('S/ 50');
    expect(describePrice({ priceMin: null, priceMax: 80 }, fmt)).toBe('Hasta S/ 80');
    expect(describePrice({ priceMin: null, priceMax: null }, fmt)).toBeNull();
  });
});

describe('WishlistService.byPriority', () => {
  const item = (id: string, priority: 1 | 2 | 3, day: number) =>
    ({ id, priority, createdAt: new Date(2026, 10, day) }) as Parameters<typeof WishlistService.byPriority>[0][number];

  it('pone primero lo que más le gustaría y, a igual prioridad, lo más antiguo', () => {
    const sorted = WishlistService.byPriority([item('a', 3, 1), item('b', 1, 5), item('c', 2, 2), item('d', 1, 3)]);
    expect(sorted.map((w) => w.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('no modifica la lista original', () => {
    const list = [item('a', 3, 1), item('b', 1, 2)];
    WishlistService.byPriority(list);
    expect(list.map((w) => w.id)).toEqual(['a', 'b']);
  });
});
