export type FamilyColor = 'red' | 'green' | 'gold' | 'blue' | 'purple' | 'orange' | 'pink' | 'teal' | 'white';

export interface Family {
  id: string;
  eventId: string;
  name: string;
  color: FamilyColor;
  dressCodeNote: string | null;
}

/** El nombre del color siempre se muestra junto al color (no depender solo del color). */
export const FAMILY_COLORS: Record<FamilyColor, { label: string; swatch: string; soft: string; text: string }> = {
  red: { label: 'Rojo', swatch: '#b3262e', soft: '#fbe5e6', text: '#7f1a20' },
  green: { label: 'Verde', swatch: '#2f7a4b', soft: '#e3f2e8', text: '#1d4d30' },
  gold: { label: 'Dorado', swatch: '#c9a227', soft: '#fbf3d6', text: '#6b5410' },
  blue: { label: 'Azul', swatch: '#2b5fae', soft: '#e3ecf9', text: '#1b3d72' },
  purple: { label: 'Morado', swatch: '#7a3fa6', soft: '#f1e7f8', text: '#4f2770' },
  orange: { label: 'Naranja', swatch: '#d0661c', soft: '#fdebdc', text: '#7f3d0e' },
  pink: { label: 'Rosado', swatch: '#c43f7d', soft: '#fbe4ef', text: '#7d2550' },
  teal: { label: 'Turquesa', swatch: '#1f8a8a', soft: '#dff3f3', text: '#145757' },
  white: { label: 'Blanco', swatch: '#f7f5f0', soft: '#eef1f5', text: '#3b4652' },
};

/**
 * Identidad visual de cada familia: la interfaz entera toma su color.
 * `strong` siempre contrasta con texto blanco (≥ 4.5:1). El blanco usa un
 * gris azulado "nieve" para que botones y encabezados se distingan.
 */
export interface FamilyTheme {
  strong: string;
  strongHover: string;
  soft: string;
  page: string;
  accent: string;
}

export const DEFAULT_THEME: FamilyTheme = {
  strong: '#1f5236',
  strongHover: '#183f2a',
  soft: '#eef6f1',
  page: '#fbf6ec',
  accent: '#e0bb3e',
};

export const FAMILY_THEMES: Record<FamilyColor, FamilyTheme> = {
  red: { strong: '#a3222a', strongHover: '#7f1a20', soft: '#fbe9ea', page: '#fdf5f3', accent: '#f2c94c' },
  green: DEFAULT_THEME,
  gold: { strong: '#7a5c0c', strongHover: '#5e4709', soft: '#fbf3d6', page: '#fdf9ec', accent: '#f2c94c' },
  blue: { strong: '#1f4a8a', strongHover: '#173a6d', soft: '#e6eef9', page: '#f4f7fc', accent: '#f2c94c' },
  purple: { strong: '#5e3088', strongHover: '#4a256b', soft: '#f1e8f8', page: '#f9f5fc', accent: '#f2c94c' },
  orange: { strong: '#a24a10', strongHover: '#7f3a0c', soft: '#fdecdd', page: '#fdf7f1', accent: '#f2c94c' },
  pink: { strong: '#9c2c62', strongHover: '#7b224d', soft: '#fbe6f0', page: '#fdf5f8', accent: '#f2c94c' },
  teal: { strong: '#176d6d', strongHover: '#115454', soft: '#dff3f3', page: '#f3faf9', accent: '#f2c94c' },
  white: { strong: '#4a5a6b', strongHover: '#3a4755', soft: '#eef1f5', page: '#f8f9fb', accent: '#c9a227' },
};

export const FAMILY_COLOR_KEYS = Object.keys(FAMILY_COLORS) as FamilyColor[];
