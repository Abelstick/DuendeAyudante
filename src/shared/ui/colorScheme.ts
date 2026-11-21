/**
 * Modo de color de la app:
 *  · system → según el dispositivo (por defecto): sigue al celular o la computadora, incluso si
 *             cambia solo al anochecer.
 *  · light  → siempre claro.
 *  · dark   → siempre oscuro.
 * La preferencia se resuelve en `<html data-theme="light|dark">`, que es lo que lee index.css.
 * public/theme-init.js hace lo mismo antes de pintar la página, para que no destelle en blanco:
 * si cambias la clave o los valores, cámbialos también allí.
 */
export type ColorSchemePreference = 'system' | 'light' | 'dark';

const KEY = 'nf-color-scheme';
const PREFERENCES: readonly ColorSchemePreference[] = ['system', 'light', 'dark'];
const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

let stopFollowingSystem: (() => void) | null = null;

export function getColorScheme(): ColorSchemePreference {
  try {
    const stored = localStorage.getItem(KEY);
    return PREFERENCES.includes(stored as ColorSchemePreference) ? (stored as ColorSchemePreference) : 'system';
  } catch {
    return 'system';
  }
}

function paint(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/** Aplica la preferencia (y la recuerda). Con «según el dispositivo», sigue sus cambios en vivo. */
export function applyColorScheme(preference: ColorSchemePreference) {
  stopFollowingSystem?.();
  stopFollowingSystem = null;

  if (preference === 'system') {
    const query = darkQuery();
    paint(query?.matches ?? false);
    if (query) {
      const onChange = (e: MediaQueryListEvent) => paint(e.matches);
      query.addEventListener('change', onChange);
      stopFollowingSystem = () => query.removeEventListener('change', onChange);
    }
  } else {
    paint(preference === 'dark');
  }

  try {
    localStorage.setItem(KEY, preference);
  } catch {
    // modo privado: se aplica solo en esta visita
  }
}
