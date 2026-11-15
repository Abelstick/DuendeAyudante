import { CalendarClock, ChevronRight, Dices, Gift, HandPlatter, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { useGamePoll, useGames } from '@/modules/games/presentation/hooks';
import { ResponsibilityService } from '@/modules/responsibilities/application/ResponsibilityService';
import { useResponsibilities } from '@/modules/responsibilities/presentation/hooks';
import { useSchedule } from '@/modules/schedule/presentation/hooks';
import { useEventWishlist } from '@/modules/wishlist/presentation/hooks';
import { actingParticipants } from '../domain/Event';

interface Tile {
  to: string;
  title: string;
  /** Dato vivo de esa sección (qué hay o qué falta). */
  detail: string;
  icon: LucideIcon;
  /** Fondo y texto del mosaico. */
  style: string;
  /** Resalta el mosaico cuando hay algo que hacer ahora. */
  badge?: string;
}

/** Accesos rápidos del inicio: cuatro mosaicos grandes, cada uno con su color y un dato útil. */
export function QuickAccessGrid() {
  const { event, context } = useEventScope();
  const wishlist = useEventWishlist(event.id);
  const games = useGames(event.id);
  const poll = useGamePoll(event.id);
  const responsibilities = useResponsibilities(event.id);
  const schedule = useSchedule(event.id);

  const base = `/e/${event.id}`;
  const me = actingParticipants(context);
  const myWishes = (wishlist.data ?? []).filter((w) => w.participantId === context.me?.id).length;
  const gameCount = (games.data ?? []).filter((g) => g.status === 'active').length;
  const pollOpen = poll.data?.status === 'open';
  const mine = ResponsibilityService.mine(responsibilities.data ?? [], me);
  const pending = mine.filter((r) => r.status !== 'done').length;
  const activities = (schedule.data ?? []).filter((s) => s.status !== 'cancelled').length;

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const tiles: Tile[] = [
    {
      to: `${base}/regalos`,
      title: 'Regalos',
      detail: myWishes === 0 ? 'Agrega tu lista de deseos' : `${plural(myWishes, 'regalo', 'regalos')} en tu lista`,
      icon: Gift,
      style: 'bg-berry-500 text-white',
    },
    {
      to: `${base}/juegos`,
      title: 'Juegos',
      detail: pollOpen ? 'Elige tus favoritos' : gameCount === 0 ? 'Propón el primero' : `${plural(gameCount, 'idea', 'ideas')} para jugar`,
      icon: Dices,
      style: 'bg-sky-500 text-white',
      badge: pollOpen ? '¡A votar!' : undefined,
    },
    {
      to: `${base}/celebracion`,
      title: 'Aportes y tareas',
      detail: mine.length === 0 ? 'Quién lleva qué' : pending === 0 ? '¡Todo listo de tu parte!' : `Te ${pending === 1 ? 'falta' : 'faltan'} ${pending}`,
      icon: HandPlatter,
      style: 'bg-pine-600 text-white',
      badge: pending > 0 ? `${pending}` : undefined,
    },
    {
      to: `${base}/celebracion?vista=cronograma`,
      title: 'Cronograma',
      detail: activities === 0 ? 'Horarios del día' : plural(activities, 'actividad', 'actividades'),
      icon: CalendarClock,
      style: 'bg-gold-400 text-night-900',
    },
  ];

  return (
    <nav aria-label="Accesos rápidos">
      <ul className="stagger grid grid-cols-2 gap-3">
        {tiles.map(({ to, title, detail, icon: Icon, style, badge }) => (
          <li key={to}>
            <Link
              to={to}
              className={`tap-card select-ring relative flex h-full min-h-32 flex-col justify-between gap-2 overflow-hidden rounded-2xl border-[3px] border-night-900 p-3.5 shadow-block active:shadow-none ${style}`}
            >
              {/* franja de brillo, como la carátula de un juego */}
              <span className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-white/25" aria-hidden />
              <span className="relative flex items-start justify-between gap-2">
                <span className="flex size-12 items-center justify-center rounded-xl border-2 border-night-900 bg-white text-night-900 shadow-[0_3px_0_0_var(--color-night-900)]">
                  <Icon className="size-7" aria-hidden />
                </span>
                {badge && (
                  <span className="font-display whitespace-nowrap rounded-lg border-2 border-night-900 bg-white px-2 py-0.5 text-sm font-semibold text-berry-700 motion-safe:animate-float">
                    {badge}
                  </span>
                )}
              </span>
              <span className="relative">
                <span className="font-display flex items-center gap-0.5 text-lg font-semibold leading-tight">
                  {title}
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </span>
                <span className="block text-sm font-bold leading-snug">{detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
