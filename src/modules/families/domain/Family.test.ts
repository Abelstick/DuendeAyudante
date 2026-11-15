import { describe, expect, it } from 'vitest';
import { FAMILY_COLOR_KEYS, FAMILY_COLORS, FAMILY_THEMES } from './Family';

/** Contraste WCAG entre dos colores hex. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

describe('identidad de color de cada familia', () => {
  it('incluye el color blanco', () => {
    expect(FAMILY_COLOR_KEYS).toContain('white');
  });

  it.each(FAMILY_COLOR_KEYS)('%s: el texto blanco se lee bien sobre el color principal (≥ 4.5:1)', (key) => {
    expect(contrast(FAMILY_THEMES[key].strong, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it.each(FAMILY_COLOR_KEYS)('%s: el nombre de la familia se lee bien en su etiqueta (≥ 4.5:1)', (key) => {
    expect(contrast(FAMILY_COLORS[key].text, FAMILY_COLORS[key].soft)).toBeGreaterThanOrEqual(4.5);
  });
});
