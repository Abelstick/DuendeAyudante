import { ArrowLeft, Share2, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { useAnnouncements } from '@/modules/announcements/presentation/hooks';
import { useExpenses } from '@/modules/expenses/presentation/hooks';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { useGames, useGameVotes } from '@/modules/games/presentation/hooks';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { useResponsibilities } from '@/modules/responsibilities/presentation/hooks';
import { useSchedule } from '@/modules/schedule/presentation/hooks';
import { useEventWishlist } from '@/modules/wishlist/presentation/hooks';
import { formatEventDate, instantToZonedParts } from '@/shared/lib/datetime';
import { formatMoney } from '@/shared/lib/money';
import { whatsappShareUrl } from '@/shared/lib/whatsapp';
import { buttonClasses, ButtonLink, Spinner } from '@/shared/ui/Button';
import { Snowfall, Tree } from '@/shared/ui/illustrations';
import { buildRecap, recapShareText } from '../domain/Recap';

function Stat({ emoji, value, label }: { emoji: string; value: ReactNode; label: string }) {
  return (
    <li className="animate-pop-in rounded-2xl border-2 border-line bg-surface p-4 text-center shadow-block">
      <span className="block text-3xl" aria-hidden>
        {emoji}
      </span>
      <span className="block text-3xl font-black tabular-nums text-ink-900">{value}</span>
      <span className="block text-sm font-bold text-ink-700">{label}</span>
    </li>
  );
}

/** Recuerdos del año: resumen de la celebración para mirar y compartir. */
export function RecapPage() {
  const { event } = useEventScope();
  const participants = useParticipants(event.id);
  const families = useFamilies(event.id);
  const wishes = useEventWishlist(event.id);
  const games = useGames(event.id);
  const votes = useGameVotes(event.id);
  const responsibilities = useResponsibilities(event.id);
  const schedule = useSchedule(event.id);
  const announcements = useAnnouncements(event.id);
  const expenses = useExpenses(event.id);

  const queries = [participants, families, wishes, games, votes, responsibilities, schedule, announcements, expenses];
  const ready = queries.every((q) => q.data !== undefined || q.isError);

  if (!ready) return <Spinner label="Juntando los recuerdos…" />;

  const recap = buildRecap({
    eventName: event.name,
    organizerName: event.organizerName,
    participants: participants.data ?? [],
    familyCount: families.data?.length ?? 0,
    wishes: wishes.data ?? [],
    games: games.data ?? [],
    votes: votes.data ?? [],
    responsibilities: responsibilities.data ?? [],
    schedule: schedule.data ?? [],
    announcementCount: announcements.data?.length ?? 0,
    expenses: expenses.data ?? [],
  });
  const year = Number(instantToZonedParts(event.celebrationAt, event.timezone).date.slice(0, 4));
  const money = (n: number) => formatMoney(n, event.currency);
  const share = recapShareText(recap, event.name, year, money);

  return (
    <div className="space-y-6">
      <ButtonLink to={`/e/${event.id}`} variant="ghost" icon={<ArrowLeft className="size-5" aria-hidden />}>
        Volver al inicio
      </ButtonLink>

      <header className="sky-bg snow-bg relative overflow-hidden rounded-xl border-2 border-line px-5 py-6 text-white shadow-lift">
        <Snowfall fall={300} />
        <div className="relative flex items-center gap-4">
          <Tree className="h-20 w-auto shrink-0" />
          <div>
            <p className="eyebrow text-gold-300">Recuerdos del {year}</p>
            <h1 className="text-3xl font-extrabold leading-tight">{event.name}</h1>
            <p className="mt-1 text-base text-white/85 first-letter:uppercase">{formatEventDate(event.celebrationAt, event.timezone)}</p>
          </div>
        </div>
      </header>

      <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat emoji="👨‍👩‍👧‍👦" value={recap.people} label={recap.people === 1 ? 'persona' : 'personas'} />
        {recap.families > 0 && <Stat emoji="🏠" value={recap.families} label={recap.families === 1 ? 'familia' : 'familias'} />}
        <Stat emoji="🎁" value={recap.gifts} label="regalos pedidos" />
        {recap.responsibilitiesTotal > 0 && <Stat emoji="✅" value={`${recap.responsibilitiesDone}/${recap.responsibilitiesTotal}`} label="aportes y tareas cumplidos" />}
        {recap.gamesProposed > 0 && <Stat emoji="🎲" value={recap.gamesProposed} label="juegos propuestos" />}
        {recap.activities > 0 && <Stat emoji="🕒" value={recap.activities} label="actividades" />}
        {recap.announcements > 0 && <Stat emoji="📣" value={recap.announcements} label="anuncios" />}
        {recap.spent > 0 && <Stat emoji="🧾" value={money(recap.spent)} label="entre todos" />}
      </ul>

      {recap.topGame && (
        <section className="rounded-2xl border-2 border-line bg-gold-50 p-4 shadow-block">
          <p className="eyebrow text-gold-700">🏆 El juego favorito</p>
          <p className="text-2xl font-extrabold text-ink-900">{recap.topGame.name}</p>
          <p className="text-base text-ink-700">
            {recap.topGame.votes} {recap.topGame.votes === 1 ? 'voto' : 'votos'}
            {recap.gamesPlayed.length > 0 ? ` · Jugamos: ${recap.gamesPlayed.join(', ')}` : ''}
          </p>
        </section>
      )}

      {recap.helpers.length > 0 && (
        <section className="rounded-2xl border-2 border-line bg-pine-50 p-4 shadow-block">
          <p className="eyebrow text-pine-700">💪 Gracias especiales</p>
          <ul className="mt-1 space-y-1">
            {recap.helpers.map((h, i) => (
              <li key={h.name} className="text-lg font-bold text-ink-900">
                {['🥇', '🥈', '🥉'][i]} {h.name} <span className="text-base font-semibold text-ink-700">· {h.done} {h.done === 1 ? 'cumplida' : 'cumplidas'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface p-4 shadow-block">
        <Sparkles className="size-8 shrink-0 text-gold-700" aria-hidden />
        <p className="text-base text-ink-900">
          Organizó <strong>{recap.organizer}</strong>. ¡Gracias por una Navidad tan bonita! ❤️
        </p>
      </section>

      <a href={whatsappShareUrl(share)} target="_blank" rel="noopener noreferrer" className={buttonClasses('whatsapp', 'lg')}>
        <Share2 className="size-6" aria-hidden />
        Compartir los recuerdos
      </a>
    </div>
  );
}
