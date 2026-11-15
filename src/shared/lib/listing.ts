/** Utilidades comunes de las listas: búsqueda, orden y preferencias (búsqueda + orden + vista). */

export type SortDir = 'asc' | 'desc';
export type ListView = 'cards' | 'table';
export type SortValue = string | number | null | undefined;

/** Lo que cada lista recuerda durante la sesión. Cada lista puede sumar sus propios filtros. */
export interface ListPrefs {
  q: string;
  sort: string;
  dir: SortDir;
  view: ListView;
}

export const DEFAULT_LIST_PREFS: ListPrefs = { q: '', sort: 'default', dir: 'asc', view: 'cards' };

/** Sin tildes ni mayúsculas: "JOSÉ" → "jose". */
export function plainText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** ¿Todas las palabras de la búsqueda aparecen en alguno de los textos? (sin importar tildes ni mayúsculas) */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = plainText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = plainText(fields.filter(Boolean).join(' '));
  return words.every((w) => haystack.includes(w));
}

function isEmpty(v: SortValue): v is null | undefined | '' {
  return v === null || v === undefined || v === '';
}

/** Ordena sin modificar el original. Los vacíos van siempre al final, en cualquier dirección. */
export function sortBy<T>(items: readonly T[], getValue: (item: T) => SortValue, dir: SortDir = 'asc'): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return items
    .map((item, index) => ({ item, index, value: getValue(item) }))
    .sort((a, b) => {
      const ea = isEmpty(a.value);
      const eb = isEmpty(b.value);
      if (ea || eb) return ea && eb ? a.index - b.index : ea ? 1 : -1;
      const cmp =
        typeof a.value === 'number' && typeof b.value === 'number'
          ? a.value - b.value
          : String(a.value).localeCompare(String(b.value), 'es', { numeric: true, sensitivity: 'base' });
      return cmp * sign || a.index - b.index;
    })
    .map((x) => x.item);
}

/**
 * Ordena por el campo elegido. Si el campo no tiene regla (p. ej. "default"),
 * respeta el orden recibido; en descendente lo invierte.
 */
export function applySort<T>(items: readonly T[], sorters: Record<string, (item: T) => SortValue>, field: string, dir: SortDir): T[] {
  const getValue = sorters[field];
  if (!getValue) return dir === 'desc' ? [...items].reverse() : [...items];
  return sortBy(items, getValue, dir);
}

/** Al tocar el encabezado de una columna: si ya ordena por ella cambia la dirección; si no, empieza ascendente. */
export function toggleSort(prefs: Pick<ListPrefs, 'sort' | 'dir'>, field: string): Pick<ListPrefs, 'sort' | 'dir'> {
  return prefs.sort === field ? { sort: field, dir: prefs.dir === 'asc' ? 'desc' : 'asc' } : { sort: field, dir: 'asc' };
}
