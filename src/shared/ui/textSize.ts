/**
 * Tamaño de la letra de la app (se suma al del sistema del celular):
 *  · compact → 16 px (por defecto), para quien ya agrandó la letra en su teléfono
 *  · normal  → 18 px
 *  · large   → 21 px
 */
export type TextSize = 'compact' | 'normal' | 'large';

const KEY = 'nf-text-size';
const SIZES: readonly TextSize[] = ['compact', 'normal', 'large'];

export function getTextSize(): TextSize {
  try {
    const stored = localStorage.getItem(KEY);
    // Por defecto, compacta: muchos ya agrandan la letra desde el sistema del celular
    return SIZES.includes(stored as TextSize) ? (stored as TextSize) : 'compact';
  } catch {
    return 'compact';
  }
}

export function applyTextSize(size: TextSize) {
  document.documentElement.dataset.textSize = size;
  try {
    localStorage.setItem(KEY, size);
  } catch {
    // modo privado: se aplica solo en esta visita
  }
}
