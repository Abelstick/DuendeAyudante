import { useCallback, useState } from 'react';

const PREFIX = 'duende:';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function read<T>(key: string, initial: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (raw === null) return initial;
    const stored: unknown = JSON.parse(raw);
    // Objetos: se completa con los valores iniciales por si la forma cambió entre versiones
    if (isPlainObject(initial)) return isPlainObject(stored) ? ({ ...initial, ...stored } as T) : initial;
    return typeof stored === typeof initial ? (stored as T) : initial;
  } catch {
    return initial; // sin almacenamiento (modo privado) o dato dañado
  }
}

function write<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // sin almacenamiento: la preferencia vive solo en memoria
  }
}

/**
 * Como useState, pero el valor se conserva mientras dure la sesión del navegador
 * (al cambiar de pantalla o recargar). Sirve para filtros, orden y vista de las listas.
 */
export function useSessionState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState(() => ({ key, value: read(key, initial) }));

  // Si cambia la clave (p. ej. otro evento), se vuelve a leer lo guardado para esa clave
  let current = state;
  if (state.key !== key) {
    current = { key, value: read(key, initial) };
    setState(current);
  }

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const base = prev.key === key ? prev.value : read(key, initial);
        const value = typeof next === 'function' ? (next as (p: T) => T)(base) : next;
        write(key, value);
        return { key, value };
      });
    },
    // `initial` solo se usa como respaldo; no debe recrear el setter en cada render
    [key],
  );

  return [current.value, set];
}
