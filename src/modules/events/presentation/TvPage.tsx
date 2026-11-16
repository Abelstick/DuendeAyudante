import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Maximize, Megaphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FullPageSpinner } from '@/app/layout/FullPageSpinner';
import { useAnnouncements } from '@/modules/announcements/presentation/hooks';
import { useGames, useGameVotes } from '@/modules/games/presentation/hooks';
import { currentScheduleItemId, nextScheduleItem } from '@/modules/schedule/domain/Schedule';
import { useSchedule } from '@/modules/schedule/presentation/hooks';
import { countdownTo, formatTime } from '@/shared/lib/datetime';
import { ButtonLink } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Moon, Snowfall, Tree, WinterScene } from '@/shared/ui/illustrations';
import { celebrationPhase } from '../domain/Celebration';
import { useEvent } from './hooks';

const pad = (n: number) => String(n).padStart(2, '0');

/** Mantiene la pantalla encendida mientras la página está abierta (si el navegador lo permite). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
        const l = await nav.wakeLock?.request('screen');
        if (cancelled) await l?.release();
        else lock = l ?? null;
      } catch {
        // sin permiso o no disponible: la pantalla se apagará según la configuración del equipo
      }
    };
    void request();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

/**
 * Pantalla para la tele: letras grandes, cuenta regresiva (a la celebración y
 * luego a la medianoche), qué actividad está pasando, qué sigue, el último
 * anuncio y los juegos favoritos. Se actualiza sola cada 30 segundos.
 */
export function TvPage() {
  const { eventId = '' } = useParams();
  const event = useEvent(eventId);
  const schedule = useSchedule(eventId);
  const announcements = useAnnouncements(eventId);
  const games = useGames(eventId);
  const votes = useGameVotes(eventId);
  const qc = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  useWakeLock();

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    const refresh = setInterval(() => void qc.invalidateQueries(), 30_000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [qc]);

  if (event.isLoading) return <FullPageSpinner />;
  if (event.error || !event.data) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <Notice tone="error">{errorMessage(event.error)}</Notice>
        <ButtonLink to="/" variant="secondary" size="lg">
          Volver al inicio
        </ButtonLink>
      </div>
    );
  }

  const ev = event.data;
  const phase = celebrationPhase(ev.celebrationAt, ev.timezone, now);
  const c = countdownTo(phase.target, now);
  const items = schedule.data ?? [];
  const current = items.find((i) => i.id === currentScheduleItemId(items, now));
  const next = nextScheduleItem(items, now);
  const latest = (announcements.data ?? [])[0];

  const voteCount = new Map<string, number>();
  for (const v of votes.data ?? []) voteCount.set(v.gameId, (voteCount.get(v.gameId) ?? 0) + 1);
  const topGames = (games.data ?? [])
    .filter((g) => g.status === 'active' && (voteCount.get(g.id) ?? 0) > 0)
    .sort((a, b) => (voteCount.get(b.id) ?? 0) - (voteCount.get(a.id) ?? 0))
    .slice(0, 3);

  const headline =
    phase.phase === 'before'
      ? c.days > 0
        ? `Faltan ${c.days} ${c.days === 1 ? 'día' : 'días'}`
        : 'Falta poquito'
      : phase.phase === 'party'
        ? 'Para la medianoche'
        : '¡Feliz Navidad!';

  const units = [
    ...(c.days > 0 ? [{ key: 'd', value: String(c.days), label: c.days === 1 ? 'día' : 'días' }] : []),
    { key: 'h', value: pad(c.hours), label: 'horas' },
    { key: 'm', value: pad(c.minutes), label: 'min' },
    { key: 's', value: pad(c.seconds), label: 'seg' },
  ];

  const fullscreen = () => {
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className="sky-bg snow-bg relative flex min-h-dvh flex-col overflow-hidden px-6 py-5 text-white lg:px-12 lg:py-8">
      <Snowfall fall={1100} />
      <Moon className="absolute right-8 top-20 w-20 opacity-90 motion-safe:animate-float lg:w-28" />

      <header className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Tree className="h-14 w-auto shrink-0 lg:h-20" />
          <h1 className="truncate text-3xl font-extrabold lg:text-5xl">{ev.name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-display text-4xl font-extrabold tabular-nums text-gold-300 lg:text-6xl" aria-label="Hora actual">
            {formatTime(now, ev.timezone)}
          </span>
          <button type="button" onClick={fullscreen} className="rounded-xl p-3 text-white/80 hover:bg-white/15" aria-label="Pantalla completa">
            <Maximize className="size-7" aria-hidden />
          </button>
          <Link to={`/e/${ev.id}`} className="rounded-xl p-3 text-white/80 hover:bg-white/15" aria-label="Salir de la pantalla para la tele">
            <ArrowLeft className="size-7" aria-hidden />
          </Link>
        </div>
      </header>

      <main className="relative grid flex-1 items-center gap-6 py-6 lg:grid-cols-[3fr_2fr] lg:gap-10">
        <section className="text-center" aria-live="off">
          <p className="eyebrow text-xl text-gold-300 lg:text-2xl">{phase.phase === 'party' ? '¡Ya estamos celebrando!' : 'Cuenta regresiva'}</p>
          <h2 className="mt-2 text-5xl font-extrabold leading-none lg:text-7xl">{headline}</h2>
          {phase.phase !== 'after' ? (
            <div className="mx-auto mt-8 grid max-w-3xl gap-3 lg:gap-5" style={{ gridTemplateColumns: `repeat(${units.length}, minmax(0, 1fr))` }}>
              {units.map((u) => (
                <div key={u.key} className="count-tile py-4 lg:py-6">
                  <span key={u.value} className="font-display block text-6xl font-extrabold tabular-nums text-gold-300 motion-safe:animate-tick lg:text-8xl">
                    {u.value}
                  </span>
                  <span className="eyebrow mt-2 block text-lg text-white/85">{u.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-3xl font-bold lg:text-4xl">🎄 ¡Que la disfruten todos juntos! 🎁</p>
          )}
          {ev.address && (
            <p className="mt-8 flex items-center justify-center gap-2 text-xl text-white/85 lg:text-2xl">
              <MapPin className="size-7 shrink-0 text-gold-300" aria-hidden />
              <span>
                {ev.addressHost && <strong className="text-white">Casa de {ev.addressHost} · </strong>}
                {ev.address}
              </span>
            </p>
          )}
        </section>

        <aside className="space-y-4">
          {current && (
            <div className="rounded-2xl border-2 border-night-900 bg-white/95 p-5 text-night-900 shadow-block">
              <p className="font-display inline-block rounded-lg border-2 border-night-900 bg-berry-600 px-3 py-1 text-lg font-semibold text-white">AHORA</p>
              <p className="mt-2 text-3xl font-extrabold lg:text-4xl">{current.title}</p>
              {current.description && <p className="mt-1 text-xl text-ink-700">{current.description}</p>}
            </div>
          )}
          {next && (
            <div className="rounded-2xl border-2 border-night-900 bg-white/85 p-5 text-night-900 shadow-block">
              <p className="eyebrow text-lg text-night-700">Después sigue · {formatTime(next.startsAt, ev.timezone)}</p>
              <p className="mt-1 text-2xl font-extrabold lg:text-3xl">{next.title}</p>
            </div>
          )}
          {topGames.length > 0 && (
            <div className="rounded-2xl border-2 border-night-900 bg-gold-50 p-5 text-night-900 shadow-block">
              <p className="eyebrow text-lg text-gold-700">🏆 Juegos favoritos</p>
              <ol className="mt-2 space-y-1">
                {topGames.map((g, i) => (
                  <li key={g.id} className="text-2xl font-bold">
                    {['🥇', '🥈', '🥉'][i]} {g.name} <span className="text-lg font-semibold text-ink-700">({voteCount.get(g.id)})</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </main>

      {latest && (
        <footer className="relative flex items-start gap-3 rounded-2xl border-2 border-night-900 bg-white/95 p-4 text-night-900 shadow-block">
          <Megaphone className="size-8 shrink-0 text-berry-600" aria-hidden />
          <p className="text-xl lg:text-2xl">
            <strong>{latest.title}:</strong> {latest.body}
          </p>
        </footer>
      )}

      <WinterScene className="h-24 lg:h-32" />
    </div>
  );
}
