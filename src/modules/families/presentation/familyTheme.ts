import { useEffect } from 'react';
import { DEFAULT_THEME, FAMILY_THEMES, type FamilyColor, type FamilyTheme } from '../domain/Family';

export function themeFor(color: FamilyColor | null | undefined): FamilyTheme {
  return color ? FAMILY_THEMES[color] : DEFAULT_THEME;
}

function applyTheme(theme: FamilyTheme) {
  const root = document.documentElement.style;
  root.setProperty('--brand', theme.strong);
  root.setProperty('--brand-strong', theme.strongHover);
  root.setProperty('--brand-soft', theme.soft);
  root.setProperty('--brand-page', theme.page);
  root.setProperty('--brand-accent', theme.accent);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.strong);
}

/** Toda la interfaz toma el color de la familia de la persona mientras está en su Navidad. */
export function useFamilyTheme(color: FamilyColor | null | undefined) {
  useEffect(() => {
    applyTheme(themeFor(color));
    return () => applyTheme(DEFAULT_THEME);
  }, [color]);
}
