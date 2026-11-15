import { midnightAfter } from '@/shared/lib/datetime';

/**
 * En qué momento de la celebración estamos:
 *  · before: falta para que empiece (cuenta regresiva a la hora de la celebración);
 *  · party: ya empezó, falta para la medianoche (cuenta regresiva a las 00:00);
 *  · after: pasó la medianoche: ¡Feliz Navidad!
 */
export type CelebrationPhase = { phase: 'before'; target: Date } | { phase: 'party'; target: Date } | { phase: 'after'; target: Date };

export function celebrationPhase(celebrationAt: Date, timezone: string, now: Date = new Date()): CelebrationPhase {
  if (now < celebrationAt) return { phase: 'before', target: celebrationAt };
  const midnight = midnightAfter(celebrationAt, timezone);
  if (now < midnight) return { phase: 'party', target: midnight };
  return { phase: 'after', target: midnight };
}
