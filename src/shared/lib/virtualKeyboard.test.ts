import { describe, expect, it } from 'vitest';
import { keyboardInset } from './virtualKeyboard';

describe('teclado del celular', () => {
  it('mide cuánto tapa el teclado del fondo de la pantalla', () => {
    // Pantalla de 800 px, teclado de 320 px
    expect(keyboardInset(800, { height: 480, offsetTop: 0 })).toBe(320);
  });

  it('descuenta cuando el navegador desplazó la vista hacia arriba (iOS)', () => {
    expect(keyboardInset(800, { height: 480, offsetTop: 120 })).toBe(200);
  });

  it('no confunde las barras del navegador con el teclado', () => {
    expect(keyboardInset(800, { height: 744, offsetTop: 0 })).toBe(0);
  });

  it('si el navegador ya achicó la página (Android con resizes-content), no hay nada que subir', () => {
    expect(keyboardInset(480, { height: 480, offsetTop: 0 })).toBe(0);
  });
});
