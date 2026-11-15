import { describe, expect, it } from 'vitest';
import {
  fullName,
  JOIN_CODE_PATTERN,
  normalizeJoinCode,
  suggestJoinCode,
  generateFriendlyPassword,
  isValidPersonName,
  normalizeName,
  normalizeUsername,
  suggestUsername,
  toTitleCase,
  USERNAME_PATTERN,
} from './names';

describe('normalizeName', () => {
  it.each([
    ['hugo', 'HUGO'],
    ['  hugo  ', 'HUGO'],
    ['hUGo garcía', 'HUGO GARCÍA'],
    ['María   López', 'MARÍA LÓPEZ'],
    ['josé pérez', 'JOSÉ PÉREZ'],
    ['peña ñuñez', 'PEÑA ÑUÑEZ'],
    ['   ', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });

  it('unifica tildes escritas de dos formas distintas (NFD/NFC)', () => {
    expect(normalizeName('josé')).toBe(normalizeName('josé'));
  });
});

describe('isValidPersonName', () => {
  it.each(['Hugo', 'María José', "O'Brien", 'Ñahui', 'Ana-Lucía'])('acepta %j', (v) => {
    expect(isValidPersonName(v)).toBe(true);
  });
  it.each(['', '   ', 'Hugo2', 'hugo@', '<script>', 'a'.repeat(61)])('rechaza %j', (v) => {
    expect(isValidPersonName(v)).toBe(false);
  });
});

describe('fullName', () => {
  it('arma el nombre completo normalizado y omite el apellido materno vacío', () => {
    expect(fullName(' hugo ', 'garcía', 'lópez')).toBe('HUGO GARCÍA LÓPEZ');
    expect(fullName('hugo', 'garcía', '  ')).toBe('HUGO GARCÍA');
  });
});

describe('usuarios y contraseñas', () => {
  it('sugiere usuarios cortos, sin tildes ni espacios', () => {
    expect(suggestUsername('Rosa María', 'García López')).toBe('rosa');
    expect(suggestUsername('Ñico', 'Peña')).toBe('nico');
    expect(USERNAME_PATTERN.test(suggestUsername('A', 'Li'))).toBe(true);
  });

  it('si el nombre ya está ocupado en la Navidad, agrega el apellido y luego un número', () => {
    expect(suggestUsername('Rosa', 'García', new Set(['rosa']))).toBe('rosa.garcia');
    expect(suggestUsername('Rosa', 'García', new Set(['rosa', 'rosa.garcia']))).toBe('rosa2');
    expect(suggestUsername('Rosa', 'García', new Set(['rosa', 'rosa.garcia', 'rosa2']))).toBe('rosa3');
  });

  it('tolera mayúsculas y espacios al iniciar sesión', () => {
    expect(normalizeUsername(' Rosa.Garcia ')).toBe('rosa.garcia');
  });

  it('genera contraseñas de al menos 8 caracteres, sin símbolos difíciles', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateFriendlyPassword();
      expect(p.length).toBeGreaterThanOrEqual(8);
      expect(p).toMatch(/^[a-z]+\d{4}$/);
    }
  });

  it('código de la Navidad: normaliza y sugiere a partir del nombre', () => {
    expect(normalizeJoinCode(' garcía-25 ')).toBe('GARCIA25');
    expect(suggestJoinCode('Navidad Familia García 2026', 2026)).toBe('GARCIA26');
    expect(suggestJoinCode('Navidad en Familia', 2026)).toBe('NAVIDAD26');
    expect(JOIN_CODE_PATTERN.test(suggestJoinCode('Los Pérez de la Cruz', 2026))).toBe(true);
  });

  it('saludo en formato título', () => {
    expect(toTitleCase('ROSA MARÍA')).toBe('Rosa María');
  });
});
