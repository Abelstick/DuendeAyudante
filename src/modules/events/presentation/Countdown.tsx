import { useEffect, useState } from 'react';
import { countdownTo, formatEventDate } from '@/shared/lib/datetime';

export function Countdown({ target, timezone }: { target: Date; timezone: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const c = countdownTo(target, now);
  const units = [
    { value: c.days, label: c.days === 1 ? 'día' : 'días' },
    { value: c.hours, label: c.hours === 1 ? 'hora' : 'horas' },
    { value: c.minutes, label: 'minutos' },
    { value: c.seconds, label: 'segundos' },
  ];

  return (
    <section aria-labelledby="countdown-title" className="snow-bg animate-pop-in rounded-3xl bg-brand p-5 text-white shadow-md">
      <h2 id="countdown-title" className="flex items-center gap-2 text-xl font-bold">
        <span aria-hidden>⭐</span> {c.isOver ? '¡Feliz Navidad!' : '¡La Navidad se acerca!'}
      </h2>
      <p className="mt-1 text-base capitalize text-white/85">{formatEventDate(target, timezone)}</p>
      {!c.isOver && (
        <div className="mt-4 grid grid-cols-4 gap-2" role="timer" aria-live="off">
          {units.map((u) => (
            <div key={u.label} className="rounded-2xl bg-white/12 px-1 py-3 text-center">
              <span className="block text-3xl font-bold tabular-nums text-brand-accent">{u.value}</span>
              <span className="block text-sm">{u.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
