export type TextSize = 'normal' | 'large';

const KEY = 'nf-text-size';

export function getTextSize(): TextSize {
  try {
    return localStorage.getItem(KEY) === 'large' ? 'large' : 'normal';
  } catch {
    return 'normal';
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
