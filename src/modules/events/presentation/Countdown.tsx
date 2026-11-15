import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { countdownTo, formatEventDate } from '@/shared/lib/datetime';
import { LevelScene, PixelCloud, PixelStar, Snowfall } from '@/shared/ui/illustrations';

interface Props {
  target: Date;
  timezone: string;
  /** Nombre de la celebración (aparece como rótulo del banner). */
  title?: string;
  description?: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Banner principal del inicio: un "nivel nevado" con la cuenta regresiva en bloques premio.
 * Se actualiza sola cada segundo; el bloque de los segundos da un saltito al cambiar.
 */
export function Countdown({ target, timezone, title, description }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const c = countdownTo(target, now);
  const units = [
    { key: 'd', value: String(c.days), label: c.days === 1 ? 'día' : 'días' },
    { key: 'h', value: pad(c.hours), label: c.hours === 1 ? 'hora' : 'horas' },
    { key: 'm', value: pad(c.minutes), label: 'min' },
    { key: 's', value: pad(c.seconds), label: 'seg' },
  ];
  const headline = c.isOver ? '¡Feliz Navidad!' : c.days === 0 ? '¡Es hoy!' : c.days === 1 ? '¡Falta 1 día!' : `¡Faltan ${c.days} días!`;

  return (
    <section
      aria-labelledby="countdown-title"
      className="day-sky relative animate-pop-in overflow-hidden rounded-2xl border-[3px] border-night-900 px-4 pb-28 pt-4 shadow-lift"
    >
      {/* Cielo: nubes que pasan, nieve que cae y una estrella por recoger */}
      <PixelCloud className="pointer-events-none absolute left-0 top-3 w-20 motion-safe:animate-drift" />
      <PixelCloud className="pointer-events-none absolute left-0 top-24 w-14 opacity-90 motion-safe:animate-drift" style={{ animationDuration: '55s', animationDelay: '-25s' }} />
      <Snowfall fall={360} />
      <PixelStar className="absolute right-4 top-4 w-10 motion-safe:animate-spin-coin" />

      <div className="relative pr-12">
        {title && (
          <p className="font-display inline-block rounded-lg border-2 border-night-900 bg-white px-2.5 py-0.5 text-sm font-semibold uppercase tracking-wide text-night-900">
            {title}
          </p>
        )}
        <h2 id="countdown-title" className="text-outline mt-2 text-[2rem] font-bold leading-[1.1]">
          {headline}
        </h2>
      </div>

      {!c.isOver && (
        <div className="relative mt-4 grid grid-cols-4 gap-2" role="timer" aria-live="off" aria-label={`Faltan ${c.days} días, ${c.hours} horas y ${c.minutes} minutos`}>
          {units.map((u) => (
            <div key={u.key} className="text-center">
              {/* `key` cambia con el valor: el bloque "salta" como si lo golpearan desde abajo */}
              <div key={u.value} className="prize-block flex h-14 items-center justify-center motion-safe:animate-tick">
                <span className="text-[1.05rem] leading-none text-night-900" style={{ fontFamily: 'var(--font-pixel)' }}>
                  {u.value}
                </span>
              </div>
              <span className="font-display mt-2 block text-base font-semibold text-white [text-shadow:0_2px_0_var(--color-night-900)]">{u.label}</span>
            </div>
          ))}
        </div>
      )}
      {c.isOver && <p className="font-display relative mt-3 text-xl font-semibold text-white [text-shadow:0_2px_0_var(--color-night-900)]">¡Que la disfruten todos juntos!</p>}

      <p className="relative mt-3 inline-flex items-start gap-1.5 rounded-lg border-2 border-night-900 bg-white px-2.5 py-1 text-base font-bold text-night-900">
        <CalendarDays className="mt-0.5 size-5 shrink-0" aria-hidden />
        <span className="first-letter:uppercase">{formatEventDate(target, timezone)}</span>
      </p>
      {description && <p className="relative mt-2 rounded-lg bg-white/90 px-2.5 py-1 text-base text-night-900">{description}</p>}

      <LevelScene />
    </section>
  );
}
