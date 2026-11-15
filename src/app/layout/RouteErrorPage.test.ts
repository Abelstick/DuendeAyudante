import { describe, expect, it } from 'vitest';
import { isStaleChunkError } from './RouteErrorPage';

describe('pantalla de error', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://app/assets/GiftsPage-abc.js', // Chrome
    'error loading dynamically imported module', // Firefox
    'Importing a module script failed.', // Safari
  ])('reconoce un archivo de una versión anterior: %s', (message) => {
    expect(isStaleChunkError(new TypeError(message))).toBe(true);
  });

  it('no confunde otros errores', () => {
    expect(isStaleChunkError(new Error("Cannot read properties of undefined (reading 'id')"))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });
});
