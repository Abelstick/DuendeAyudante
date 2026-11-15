export type FamilyColor = 'red' | 'green' | 'gold' | 'blue' | 'purple' | 'orange' | 'pink' | 'teal';

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
};

export const FAMILY_COLOR_KEYS = Object.keys(FAMILY_COLORS) as FamilyColor[];
