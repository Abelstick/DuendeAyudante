export type FamilyColor = 'red' | 'green' | 'gold' | 'blue' | 'purple' | 'orange' | 'pink' | 'teal' | 'white';

export interface Family {
  id: string;
  eventId: string;
  name: string;
  color: FamilyColor;
  dressCodeNote: string | null;
}

/** Tonos suaves de una familia para un modo de color (claro u oscuro). */
export interface FamilyTones {
  /** Fondo suave: etiqueta de la familia, avatares, tarjeta «Mi familia». */
  soft: string;
  /** Texto con el color de la familia, sobre `soft` y sobre las tarjetas (≥ 4.5:1). */
  text: string;
}

/**
 * Identidad visual de cada familia: la interfaz entera toma su color.
 *  · swatch      → la muestra del color tal cual (círculo junto al nombre).
 *  · strong      → botones, encabezados y selección; siempre con texto blanco encima (≥ 4.5:1),
 *                  igual en ambos modos. El blanco usa un gris azulado «nieve» para distinguirse.
 *  · light/dark  → tonos suaves y de texto para el modo claro y el oscuro.
 * El nombre del color siempre se muestra junto al color (no depender solo del color).
 */
export interface FamilyPalette {
  label: string;
  swatch: string;
  strong: string;
  strongHover: string;
  light: FamilyTones;
  dark: FamilyTones;
}

export const FAMILY_PALETTE: Record<FamilyColor, FamilyPalette> = {
  red: {
    label: 'Rojo',
    swatch: '#b3262e',
    strong: '#a3222a',
    strongHover: '#7f1a20',
    light: { soft: '#fbe5e6', text: '#7f1a20' },
    dark: { soft: '#3f1c22', text: '#ffb4b9' },
  },
  green: {
    label: 'Verde',
    swatch: '#2f7a4b',
    strong: '#176b45',
    strongHover: '#125538',
    light: { soft: '#e3f2e8', text: '#1d4d30' },
    dark: { soft: '#173323', text: '#9ee3b8' },
  },
  gold: {
    label: 'Dorado',
    swatch: '#c9a227',
    strong: '#7a5c0c',
    strongHover: '#5e4709',
    light: { soft: '#fbf3d6', text: '#6b5410' },
    dark: { soft: '#382d10', text: '#f3d47c' },
  },
  blue: {
    label: 'Azul',
    swatch: '#2b5fae',
    strong: '#1f4a8a',
    strongHover: '#173a6d',
    light: { soft: '#e3ecf9', text: '#1b3d72' },
    dark: { soft: '#182c4e', text: '#aecbf7' },
  },
  purple: {
    label: 'Morado',
    swatch: '#7a3fa6',
    strong: '#5e3088',
    strongHover: '#4a256b',
    light: { soft: '#f1e7f8', text: '#4f2770' },
    dark: { soft: '#301e45', text: '#d9bcf4' },
  },
  orange: {
    label: 'Naranja',
    swatch: '#d0661c',
    strong: '#a24a10',
    strongHover: '#7f3a0c',
    light: { soft: '#fdebdc', text: '#7f3d0e' },
    dark: { soft: '#3f2613', text: '#ffc699' },
  },
  pink: {
    label: 'Rosado',
    swatch: '#c43f7d',
    strong: '#9c2c62',
    strongHover: '#7b224d',
    light: { soft: '#fbe4ef', text: '#7d2550' },
    dark: { soft: '#3f1b2e', text: '#ffb3d4' },
  },
  teal: {
    label: 'Turquesa',
    swatch: '#1f8a8a',
    strong: '#176d6d',
    strongHover: '#115454',
    light: { soft: '#dff3f3', text: '#145757' },
    dark: { soft: '#123535', text: '#93e2e2' },
  },
  white: {
    label: 'Blanco',
    swatch: '#f7f5f0',
    strong: '#4a5a6b',
    strongHover: '#3a4755',
    light: { soft: '#eef1f5', text: '#3b4652' },
    dark: { soft: '#2b3340', text: '#e8edf3' },
  },
};

/** Color de la interfaz cuando la persona aún no tiene familia (verde pino). */
export const DEFAULT_FAMILY_COLOR: FamilyColor = 'green';

export const FAMILY_COLOR_KEYS = Object.keys(FAMILY_PALETTE) as FamilyColor[];
