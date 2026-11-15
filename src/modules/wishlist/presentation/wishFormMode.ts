import { useCallback, useState } from 'react';

/** Cómo llenar un regalo: fácil (qué, detalles y fotos) o completo (también marcas, enlaces, precio y prioridad). */
export type WishFormMode = 'easy' | 'full';

const KEY = 'duende:modo-regalo';

function read(): WishFormMode {
  try {
    return localStorage.getItem(KEY) === 'full' ? 'full' : 'easy';
  } catch {
    return 'easy';
  }
}

/** Empieza en modo fácil y recuerda en este dispositivo lo que la persona eligió la última vez. */
export function useWishFormMode(): [WishFormMode, (mode: WishFormMode) => void] {
  const [mode, setModeState] = useState<WishFormMode>(read);
  const setMode = useCallback((next: WishFormMode) => {
    setModeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // solo en memoria
    }
  }, []);
  return [mode, setMode];
}
