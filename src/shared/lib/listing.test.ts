import { describe, expect, it } from 'vitest';
import { applySort, matchesSearch, plainText, sortBy, toggleSort } from './listing';

describe('plainText / matchesSearch', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(plainText('JOSÉ Ñandú')).toBe('jose nandu');
    expect(matchesSearch('jose', 'JOSÉ GARCÍA')).toBe(true);
  });

  it('exige todas las palabras, en cualquier campo', () => {
    expect(matchesSearch('garcia jose', 'JOSÉ', 'GARCÍA')).toBe(true);
    expect(matchesSearch('jose lopez', 'JOSÉ', 'GARCÍA')).toBe(false);
  });

  it('una búsqueda vacía coincide con todo', () => {
    expect(matchesSearch('   ', null, undefined)).toBe(true);
  });
});

describe('sortBy', () => {
  const rows = [
    { n: 'Zoe', age: 30 as number | null },
    { n: 'álvaro', age: null },
    { n: 'Beto', age: 4 },
  ];

  it('ordena textos en español, ascendente y descendente', () => {
    expect(sortBy(rows, (r) => r.n).map((r) => r.n)).toEqual(['álvaro', 'Beto', 'Zoe']);
    expect(sortBy(rows, (r) => r.n, 'desc').map((r) => r.n)).toEqual(['Zoe', 'Beto', 'álvaro']);
  });

  it('ordena números y deja los vacíos al final en ambas direcciones', () => {
    expect(sortBy(rows, (r) => r.age).map((r) => r.age)).toEqual([4, 30, null]);
    expect(sortBy(rows, (r) => r.age, 'desc').map((r) => r.age)).toEqual([30, 4, null]);
  });

  it('no modifica la lista original', () => {
    const copy = [...rows];
    sortBy(rows, (r) => r.n);
    expect(rows).toEqual(copy);
  });
});

describe('applySort / toggleSort', () => {
  it('sin regla para el campo respeta el orden recibido (o lo invierte)', () => {
    expect(applySort([3, 1, 2], {}, 'default', 'asc')).toEqual([3, 1, 2]);
    expect(applySort([3, 1, 2], {}, 'default', 'desc')).toEqual([2, 1, 3]);
    expect(applySort([3, 1, 2], { value: (n) => n }, 'value', 'asc')).toEqual([1, 2, 3]);
  });

  it('alterna la dirección al repetir el campo y empieza ascendente en uno nuevo', () => {
    expect(toggleSort({ sort: 'name', dir: 'asc' }, 'name')).toEqual({ sort: 'name', dir: 'desc' });
    expect(toggleSort({ sort: 'name', dir: 'desc' }, 'family')).toEqual({ sort: 'family', dir: 'asc' });
  });
});
