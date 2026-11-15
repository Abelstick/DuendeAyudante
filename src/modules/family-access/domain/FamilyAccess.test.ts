import { describe, expect, it } from 'vitest';
import { buildFamilyLinkMessage, normalizeSecretWord, SECRET_WORD_PATTERN, suggestSecretWord } from './FamilyAccess';

describe('palabra secreta de la familia', () => {
  it.each([
    ['  Panetón 25 ', 'PANETON25'],
    ['estrella', 'ESTRELLA'],
    ['Niño Jesús', 'NIÑOJESUS'],
    ['TURRÓN', 'TURRON'],
  ])('%j → %j (sin tildes ni espacios, conserva la ñ)', (input, expected) => {
    expect(normalizeSecretWord(input)).toBe(expected);
  });

  it('acepta de 4 a 20 letras o números y rechaza lo demás', () => {
    expect(SECRET_WORD_PATTERN.test('PANETON25')).toBe(true);
    expect(SECRET_WORD_PATTERN.test('ABC')).toBe(false);
    expect(SECRET_WORD_PATTERN.test('HOLA-MUNDO')).toBe(false);
    expect(SECRET_WORD_PATTERN.test('A'.repeat(21))).toBe(false);
  });

  it('las palabras sugeridas siempre son válidas', () => {
    for (let i = 0; i < 12; i++) expect(SECRET_WORD_PATTERN.test(suggestSecretWord(() => i / 12))).toBe(true);
  });

  it('el mensaje de WhatsApp lleva el enlace y la palabra', () => {
    const message = buildFamilyLinkMessage({
      eventName: 'Navidad García',
      familyName: 'GARCÍA',
      appUrl: 'https://navidad.app',
      linkToken: 'a'.repeat(32),
      secretWord: 'PANETON',
    });
    expect(message).toContain(`https://navidad.app/f/${'a'.repeat(32)}`);
    expect(message).toContain('PANETON');
    expect(message).toContain('familia GARCÍA');
  });
});
