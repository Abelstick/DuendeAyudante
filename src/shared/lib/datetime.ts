/** Diferencia en milisegundos entre la hora "de pared" de una zona y UTC. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - instant.getTime();
}

/** "2026-12-24" + "19:00" en "America/Lima" → instante absoluto. */
export function zonedDateTimeToInstant(date: string, time: string, timeZone: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y ?? 0, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
  const first = guess - zoneOffsetMs(new Date(guess), timeZone);
  // Segunda pasada por si el cambio de horario cae entre medio
  return new Date(guess - zoneOffsetMs(new Date(first), timeZone));
}

/** Instante → { date: "2026-12-24", time: "19:00" } en la zona del evento. */
export function instantToZonedParts(instant: Date, timeZone: string): { date: string; time: string } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => f.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/** "miércoles 24 de diciembre, 7:00 p. m." */
export function formatEventDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isOver: boolean;
}

export function countdownTo(target: Date, now: Date = new Date()): CountdownParts {
  const diff = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isOver: diff === 0,
  };
}

/** "2026-12-23" → "martes 23 de diciembre" (fecha sin hora, sin desfases de zona horaria). */
export function formatDateOnly(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12)),
  );
}

/** "7:00 p. m." en la zona horaria del evento. */
export function formatTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-PE', { timeZone, hour: 'numeric', minute: '2-digit' }).format(instant);
}

/** "24 dic., 7:00 p. m." para fechas cortas de publicación. */
export function formatShortDateTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-PE', { timeZone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(instant);
}
