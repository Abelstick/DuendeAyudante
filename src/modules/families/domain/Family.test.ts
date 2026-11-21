import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/shared/lib/contrast';
import { FAMILY_COLOR_KEYS, FAMILY_PALETTE } from './Family';

describe('identidad de color de cada familia', () => {
  it('incluye el color blanco', () => {
    expect(FAMILY_COLOR_KEYS).toContain('white');
  });

  it.each(FAMILY_COLOR_KEYS)('%s: el texto blanco se lee bien sobre el color principal (≥ 4.5:1)', (key) => {
    expect(contrastRatio(FAMILY_PALETTE[key].strong, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(FAMILY_PALETTE[key].strongHover, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it.each(FAMILY_COLOR_KEYS)('%s: el nombre de la familia se lee bien en su etiqueta, en modo claro y oscuro (≥ 4.5:1)', (key) => {
    const { light, dark } = FAMILY_PALETTE[key];
    expect(contrastRatio(light.text, light.soft)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dark.text, dark.soft)).toBeGreaterThanOrEqual(4.5);
  });
});
