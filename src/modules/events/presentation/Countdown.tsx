import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { countdownTo, formatEventDate } from '@/shared/lib/datetime';
import { Stars, WinterScene } from '@/shared/ui/illustrations';

interface Props {
  target: Date;
  timezone: string;
  /** Nombre de la celebración (aparece como título del banner). */
  title?: string;
  description?: string | null;
}

/** Banner principal del inicio: noche navideña con la cuenta regresiva (se actualiza sola cada segundo). */
export function Countdown({ target, timezone, title, description }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const c = countdownTo(target, now);
  const units = [
    { key: 'd', value: c.days, label: c.days === 1 ? 'día' : 'días' },
    { key: 'h', value: c.hours, label: c.hours === 1 ? 'hora' : 'horas' },
    { key: 'm', value: c.minutes, label: 'min' },
    { key: 's', value: c.seconds, label: 'seg' },
  ];
  const headline = c.isOver ? '¡Feliz Navidad!' : c.days === 0 ? '¡Es hoy!' : c.days === 1 ? '¡Falta solo 1 día!' : `¡Faltan ${c.days} días!`;

  return (
    <section
      aria-labelledby="countdown-title"
      className="sky-bg relative animate-pop-in overflow-hidden rounded-[1.75rem] px-5 pb-24 pt-5 text-white shadow-lift"
    >
      <Stars />
      {/* Luna */}
      <span
        className="absolute right-5 top-5 size-12 rounded-full bg-gold-100 shadow-[0_0_28px_6px_rgb(242_210_125/0.45)] motion-safe:animate-float"
        aria-hidden
      />

      <div className="relative pr-16">
        {title && <p className="text-sm font-bold uppercase tracking-wider text-gold-300">{title}</p>}
        <h2 id="countdown-title" className="text-3xl font-black leading-tight">
          {headline}
        </h2>
        <p className="mt-1 flex items-start gap-1.5 text-base text-white/90">
          <CalendarDays className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span className="first-letter:uppercase">{formatEventDate(target, timezone)}</span>
        </p>
        {description && <p className="mt-1 text-base text-white/80">{description}</p>}
      </div>

      {!c.isOver && (
        <div className="relative mt-4 grid grid-cols-4 gap-2" role="timer" aria-live="off" aria-label={`Faltan ${c.days} días, ${c.hours} horas y ${c.minutes} minutos`}>
          {units.map((u) => (
            <div key={u.key} className="rounded-2xl border border-white/15 bg-white/12 px-1 py-2.5 text-center backdrop-blur-sm">
              <span key={u.key === 's' ? u.value : undefined} className={`block text-3xl font-black tabular-nums text-gold-300 ${u.key === 's' ? 'motion-safe:animate-tick' : ''}`}>
                {u.value}
              </span>
              <span className="block text-sm font-semibold text-white/90">{u.label}</span>
            </div>
          ))}
        </div>
      )}
      {c.isOver && <p className="relative mt-3 text-lg font-bold">🎉 ¡Que la disfruten todos juntos!</p>}

      <WinterScene className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full text-white" />
    </section>
  );
}
