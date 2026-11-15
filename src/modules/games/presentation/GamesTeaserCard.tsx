import { Vote } from 'lucide-react';
import { useEventScope } from '@/app/layout/EventLayout';
import { ButtonLink } from '@/shared/ui/Button';
import { useGamePoll } from './hooks';

/** En Inicio: aviso destacado mientras la votación de juegos está abierta (el resto lo muestra el acceso "Juegos"). */
export function GamesTeaserCard() {
  const { event } = useEventScope();
  const poll = useGamePoll(event.id);
  if (poll.data?.status !== 'open') return null;

  return (
    <section className="sky-bg snow-bg animate-pop-in flex flex-col gap-3 rounded-3xl p-5 text-white shadow-card sm:flex-row sm:items-center" aria-labelledby="poll-open-title">
      <div className="flex flex-1 items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-gold-300 motion-safe:animate-wiggle" aria-hidden>
          <Vote className="size-7" />
        </span>
        <div>
          <h2 id="poll-open-title" className="text-xl font-black leading-tight">
            ¡La votación está abierta!
          </h2>
          <p className="text-base text-white/90">Elige tus juegos favoritos para la noche.</p>
        </div>
      </div>
      <ButtonLink to={`/e/${event.id}/juegos`} variant="gold" icon={<Vote className="size-5" aria-hidden />}>
        Ir a votar
      </ButtonLink>
    </section>
  );
}
