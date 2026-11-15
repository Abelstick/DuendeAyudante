import { describe, expect, it } from 'vitest';
import { countdownTo, instantToZonedParts, zonedDateTimeToInstant } from './datetime';

describe('zona horaria del evento', () => {
  it('24/12 7:00 p. m. en Lima es 25/12 00:00 UTC', () => {
    expect(zonedDateTimeToInstant('2026-12-24', '19:00', 'America/Lima').toISOString()).toBe('2026-12-25T00:00:00.000Z');
  });

  it('respeta zonas con horario de verano (Madrid en diciembre es UTC+1)', () => {
    expect(zonedDateTimeToInstant('2026-12-24', '21:00', 'Europe/Madrid').toISOString()).toBe('2026-12-24T20:00:00.000Z');
  });

  it('ida y vuelta', () => {
    const instant = zonedDateTimeToInstant('2026-12-24', '19:30', 'America/Lima');
    expect(instantToZonedParts(instant, 'America/Lima')).toEqual({ date: '2026-12-24', time: '19:30' });
  });
});

describe('cuenta regresiva', () => {
  it('calcula días, horas, minutos y segundos', () => {
    const target = new Date('2026-12-25T00:00:00Z');
    const now = new Date('2026-12-23T22:58:30Z');
    expect(countdownTo(target, now)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 30, isOver: false });
  });

  it('no muestra números negativos cuando ya pasó', () => {
    expect(countdownTo(new Date('2020-01-01'), new Date('2026-01-01')).isOver).toBe(true);
  });
});

describe('fecha límite', () => {
  it('muestra el día correcto sin desfases de zona horaria', async () => {
    const { formatDateOnly } = await import('./datetime');
    expect(formatDateOnly('2026-12-23')).toBe('miércoles, 23 de diciembre');
  });
});
