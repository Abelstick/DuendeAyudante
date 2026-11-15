import { describe, expect, it } from 'vitest';
import { celebrationPhase } from './Celebration';
import { nextYearJoinCode, nextYearName } from './Event';

describe('Navidad del próximo año', () => {
  it('cambia el año del nombre o lo agrega', () => {
    expect(nextYearName('Navidad García 2026', 2027)).toBe('Navidad García 2027');
    expect(nextYearName('Navidad García', 2027)).toBe('Navidad García 2027');
  });

  it('sugiere el código del año siguiente', () => {
    expect(nextYearJoinCode('GARCIA2026', 2027)).toBe('GARCIA2027');
    expect(nextYearJoinCode('GARCIA26', 2027)).toBe('GARCIA27');
    expect(nextYearJoinCode('GARCIA', 2027)).toBe('GARCIA27');
    expect(nextYearJoinCode('ABCDEFGHIJKLMNOPQRST', 2027)).toHaveLength(20);
  });
});

describe('momento de la celebración', () => {
  const at = new Date('2026-12-25T00:00:00Z'); // 24 dic, 7:00 p. m. en Lima

  it('antes: cuenta regresiva a la celebración', () => {
    expect(celebrationPhase(at, 'America/Lima', new Date('2026-12-24T12:00:00Z'))).toEqual({ phase: 'before', target: at });
  });

  it('durante la fiesta: cuenta regresiva a la medianoche', () => {
    expect(celebrationPhase(at, 'America/Lima', new Date('2026-12-25T02:00:00Z'))).toEqual({
      phase: 'party',
      target: new Date('2026-12-25T05:00:00Z'),
    });
  });

  it('después de la medianoche', () => {
    expect(celebrationPhase(at, 'America/Lima', new Date('2026-12-25T05:00:01Z')).phase).toBe('after');
  });
});
