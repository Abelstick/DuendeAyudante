import { describe, expect, it } from 'vitest';
import { AGE_GROUPS, GIFT_IDEAS, giftIdeasFor } from './GiftIdeas';

describe('ideas de regalo', () => {
  it('hay ideas para cada edad', () => {
    for (const { value } of AGE_GROUPS) expect(giftIdeasFor(value, null, 'PEN').length).toBeGreaterThan(4);
  });

  it('con presupuesto solo muestra lo que alcanza, de lo más barato a lo más caro', () => {
    const ideas = giftIdeasFor('adult', 40, 'PEN');
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.every((i) => i.min <= 40 && i.ages.includes('adult'))).toBe(true);
    expect(ideas.map((i) => i.min)).toEqual([...ideas.map((i) => i.min)].sort((a, b) => a - b));
  });

  it('en otra moneda no filtra por precio (los precios son en soles)', () => {
    expect(giftIdeasFor('adult', 10, 'USD')).toHaveLength(GIFT_IDEAS.filter((i) => i.ages.includes('adult')).length);
  });

  it('los rangos de precio son coherentes', () => {
    expect(GIFT_IDEAS.every((i) => i.min > 0 && i.max >= i.min && i.ages.length > 0)).toBe(true);
  });
});
