import { CalendarDays, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { countdownTo, formatEventDate } from '@/shared/lib/datetime';
import { formatMoneyWords } from '@/shared/lib/money';
import { Moon, Snowfall, WinterScene } from '@/shared/ui/illustrations';

interface Props {
  target: Date;
  timezone: string;
  /** Nombre de la celebración (aparece como rótulo del banner). */
  title?: string;
  description?: string | null;
  /** Monto acordado del intercambio (se muestra debajo de la fecha). */
  budget?: number | null;
  currency?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Banner principal del inicio: noche nevada con la cuenta regresiva.
 * Se actualiza sola cada segundo; la ficha de los segundos da un saltito al cambiar.
 */
export function Countdown({ target, timezone, title, description, budget, currency }: Props) {
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
    <section aria-labelledby="countdown-title" className="sky-bg snow-bg relative animate-pop-in overflow-hidden rounded-xl border-2 border-night-900 px-4 pb-24 pt-4 text-white shadow-lift sm:px-5 sm:pb-32 sm:pt-5">
      <Snowfall fall={380} />
      <Moon className="absolute right-4 top-4 w-14 motion-safe:animate-float" />

      <div className="relative pr-16">
        <p className="eyebrow text-gold-300">Cuenta regresiva{title ? ` · ${title}` : ''}</p>
        <h2 id="countdown-title" className="mt-1 text-[2.1rem] leading-[0.95] font-extrabold wrap-break-word sm:text-[2.6rem]">
          {headline}
        </h2>
      </div>

      {!c.isOver && (
        <div className="relative mt-4 grid grid-cols-4 gap-1.5 sm:mt-5 sm:gap-2" role="timer" aria-live="off" aria-label={`Faltan ${c.days} días, ${c.hours} horas y ${c.minutes} minutos`}>
          {units.map((u) => (
            <div key={u.key} className="count-tile px-1 py-2 text-center">
              {/* `key` cambia con el valor: el número da un saltito al cambiar */}
              <span key={u.value} className="font-display block text-[1.6rem] leading-none font-extrabold text-gold-300 tabular-nums motion-safe:animate-tick sm:text-[1.9rem]">
                {u.value}
              </span>
              <span className="eyebrow mt-1 block truncate tracking-[0.02em]! text-white/85 sm:tracking-[0.08em]!">{u.label}</span>
            </div>
          ))}
        </div>
      )}
      {c.isOver && <p className="font-display relative mt-3 text-xl font-bold">¡Que la disfruten todos juntos!</p>}

      <p className="relative mt-4 flex items-start gap-2 text-base font-semibold text-white">
        <CalendarDays className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden />
        <span className="first-letter:uppercase">{formatEventDate(target, timezone)}</span>
      </p>
      {budget != null && (
        <p className="relative mt-1 flex items-start gap-2 text-base font-semibold text-white">
          <Wallet className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden />
          <span>
            Monto acordado: <strong className="text-gold-300 uppercase">{formatMoneyWords(budget, currency)}</strong>
          </span>
        </p>
      )}
      {description && <p className="relative mt-1 text-base text-white/85">{description}</p>}

      <WinterScene className="h-20 sm:h-28" />
    </section>
  );
}
