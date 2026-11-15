import { ChevronRight, Dices } from 'lucide-react';
import { useEventScope } from '@/app/layout/EventLayout';
import { ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { useGamePoll, useGames } from './hooks';

/** En Inicio: cuántas ideas de juegos hay y si se puede votar. */
export function GamesTeaserCard() {
  const { event } = useEventScope();
  const games = useGames(event.id);
  const poll = useGamePoll(event.id);
  if (!games.data) return null;

  const count = games.data.filter((g) => g.status === 'active').length;
  const open = poll.data?.status === 'open';

  return (
    <Card className={`space-y-3 ${open ? 'border-2 border-brand' : ''}`}>
      <h2 className="flex items-center gap-2 text-xl font-bold text-brand">
        <Dices className="size-6" aria-hidden /> Juegos y actividades
      </h2>
      <p className="text-base">
        {open ? (
          <strong>🗳️ ¡La votación está abierta! Elige tus juegos favoritos.</strong>
        ) : count === 0 ? (
          '¿Se te ocurre un juego para la noche? ¡Propónlo!'
        ) : (
          <>
            Hay <strong>{count}</strong> {count === 1 ? 'idea' : 'ideas'} de juegos. ¿Tienes otra?
          </>
        )}
      </p>
      <ButtonLink to={`/e/${event.id}/juegos`} variant={open ? 'primary' : 'secondary'} icon={<ChevronRight className="size-5" aria-hidden />}>
        {open ? 'Ir a votar' : 'Ver juegos'}
      </ButtonLink>
    </Card>
  );
}
