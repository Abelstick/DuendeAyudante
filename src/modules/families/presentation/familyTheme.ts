import { useEffect } from 'react';
import { DEFAULT_FAMILY_COLOR, FAMILY_COLOR_KEYS, FAMILY_PALETTE, type FamilyColor } from '../domain/Family';

/**
 * Colores de cada familia listos para `style`: los tonos suaves y de texto son variables CSS
 * (--fam-<color>-soft / -text / -ink) que cambian solas entre el modo claro y el oscuro,
 * sin volver a pintar nada desde React.
 */
export interface FamilyColorStyle {
  label: string;
  swatch: string;
  strong: string;
  soft: string;
  text: string;
}

export const FAMILY_COLORS = Object.fromEntries(
  FAMILY_COLOR_KEYS.map((key) => {
    const p = FAMILY_PALETTE[key];
    return [key, { label: p.label, swatch: p.swatch, strong: p.strong, soft: `var(--fam-${key}-soft)`, text: `var(--fam-${key}-text)` }];
  }),
) as Record<FamilyColor, FamilyColorStyle>;

/**
 * Hoja de estilos con los tonos de todas las familias en ambos modos. `-ink` es el texto con el
 * color de la familia sobre las tarjetas: en modo claro el color fuerte, en oscuro su tono claro.
 */
function paletteCss(): string {
  const light: string[] = [];
  const dark: string[] = [];
  for (const key of FAMILY_COLOR_KEYS) {
    const p = FAMILY_PALETTE[key];
    light.push(`--fam-${key}-soft:${p.light.soft}`, `--fam-${key}-text:${p.light.text}`, `--fam-${key}-ink:${p.strong}`);
    dark.push(`--fam-${key}-soft:${p.dark.soft}`, `--fam-${key}-text:${p.dark.text}`, `--fam-${key}-ink:${p.dark.text}`);
  }
  return `:root{${light.join(';')}}\nhtml[data-theme='dark']{${dark.join(';')}}`;
}

function applyTheme(color: FamilyColor) {
  const p = FAMILY_PALETTE[color];
  const root = document.documentElement.style;
  root.setProperty('--brand', p.strong);
  root.setProperty('--brand-strong', p.strongHover);
  root.setProperty('--brand-soft', `var(--fam-${color}-soft)`);
  root.setProperty('--brand-ink', `var(--fam-${color}-ink)`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.strong);
}

/** Se llama una vez al arrancar: registra los tonos de las familias y aplica el color por defecto. */
export function installFamilyPalette() {
  const style = document.createElement('style');
  style.id = 'family-palette';
  style.textContent = paletteCss();
  document.head.appendChild(style);
  applyTheme(DEFAULT_FAMILY_COLOR);
}

/** Toda la interfaz toma el color de la familia de la persona mientras está en su Navidad. */
export function useFamilyTheme(color: FamilyColor | null | undefined) {
  useEffect(() => {
    applyTheme(color ?? DEFAULT_FAMILY_COLOR);
    return () => applyTheme(DEFAULT_FAMILY_COLOR);
  }, [color]);
}
