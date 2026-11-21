import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAMILY_COLOR_KEYS, FAMILY_PALETTE } from '@/modules/families/domain/Family';
import { contrastRatio } from '@/shared/lib/contrast';

/**
 * Contraste de las combinaciones de color que usa la interfaz, leídas de index.css en ambos
 * modos: si alguien cambia un tono, la prueba avisa antes de que un texto deje de leerse.
 */
const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

function tokensIn(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}
function blockAfter(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`No está ${selector} en index.css`);
  return css.slice(start, css.indexOf('}', start));
}
function pageColor(selector: string): string {
  const match = /--page:\s*(#[0-9a-f]{6})/i.exec(blockAfter(selector));
  if (!match) throw new Error(`Falta --page en ${selector}`);
  return match[1]!.toLowerCase();
}

const light: Record<string, string> = { ...tokensIn(blockAfter('@theme {')), page: pageColor('\nbody {') };
const dark: Record<string, string> = { ...light, ...tokensIn(blockAfter("html[data-theme='dark'] {")), page: pageColor("html[data-theme='dark'] body {") };
const modes = { claro: light, oscuro: dark } as const;

// [texto, fondo]: todos deben llegar a 4.5:1 (WCAG AA para texto normal)
const TEXT_PAIRS: [string, string][] = [
  ['heading', 'surface'],
  ['ink-900', 'surface'],
  ['ink-700', 'surface'],
  ['ink-500', 'surface'],
  ['ink-700', 'mist-100'],
  ['ink-500', 'mist-100'],
  ['ink-700', 'mist-200'],
  ['ink-500', 'mist-200'],
  ['ink-900', 'page'],
  ['ink-700', 'page'],
  ['ink-500', 'page'],
  ['night-ink', 'surface'],
  ['night-ink', 'night-50'],
  ['night-ink', 'sky-100'],
  ['pine-700', 'pine-100'],
  ['pine-800', 'pine-100'],
  ['pine-700', 'surface'],
  ['berry-700', 'berry-50'],
  ['berry-700', 'surface'],
  ['gold-700', 'gold-100'],
  ['gold-700', 'gold-50'],
  ['gold-700', 'surface'],
  ['ink-900', 'gold-100'],
  ['ink-900', 'pine-50'],
  // Fondos sólidos (iguales en ambos modos) con texto blanco u oscuro encima
  ['white', 'pine-600'],
  ['white', 'berry-500'],
  ['white', 'berry-600'],
  ['white', 'berry-800'],
  ['white', 'sky-600'],
  ['white', 'night-700'],
  ['white', 'night-800'],
  ['gold-300', 'night-800'],
  ['night-900', 'gold-400'],
  ['night-900', 'gold-300'],
];

describe.each(Object.entries(modes))('paleta en modo %s', (_mode, tokens) => {
  const color = (name: string) => {
    if (name === 'white') return '#ffffff';
    const value = tokens[name];
    if (!value) throw new Error(`Falta el color ${name}`);
    return value;
  };

  it.each(TEXT_PAIRS)('%s se lee sobre %s (≥ 4.5:1)', (fg, bg) => {
    expect(contrastRatio(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5);
  });

  // Elementos que no son texto (contornos, íconos sueltos): WCAG pide 3:1
  it('las tarjetas se distinguen del fondo de la página por su contorno (≥ 3:1)', () => {
    expect(contrastRatio(color('line'), color('page'))).toBeGreaterThanOrEqual(3);
  });

  it('los íconos informativos celestes se ven sobre las tarjetas (≥ 3:1)', () => {
    expect(contrastRatio(color('sky-600'), color('surface'))).toBeGreaterThanOrEqual(3);
  });
});

describe('color de cada familia sobre las tarjetas', () => {
  it.each(FAMILY_COLOR_KEYS)('%s: el texto con el color de la familia se lee en ambos modos (≥ 4.5:1)', (key) => {
    const p = FAMILY_PALETTE[key];
    // Modo claro: el texto «brand-ink» es el color fuerte; en oscuro, su tono claro
    expect(contrastRatio(p.strong, light.surface!)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.light.text, light.surface!)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.dark.text, dark.surface!)).toBeGreaterThanOrEqual(4.5);
  });
});
