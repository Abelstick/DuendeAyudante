import { Dices, Merge, Plus, RotateCcw, Settings, Vote } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants, canEditContent } from '@/modules/events/domain/Event';
import type { Participant } from '@/modules/members/domain/Participant';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { applySort, DEFAULT_LIST_PREFS, matchesSearch, type ListPrefs, type SortValue } from '@/shared/lib/listing';
import { useSessionState } from '@/shared/lib/useSessionState';
import { Button, Spinner } from '@/shared/ui/Button';
import { Card, CardTitle, EmptyState, Notice, PageTitle, Pill, SectionTitle } from '@/shared/ui/Card';
import { chipClasses, selectClasses } from '@/shared/ui/Tabs';
import { errorMessage } from '@/shared/ui/errorMessages';
import { FilterSelect, ListToolbar } from '@/shared/ui/ListToolbar';
import { useToast } from '@/shared/ui/Toast';
import { TourButton } from '@/shared/ui/TourButton';
import type { TourStep } from '@/shared/tour/tour';
import { toTitleCase } from '@/shared/validation/names';
import { CATEGORY_LABELS, type Game, type GameCategory, gameCredits, rankGames, type RankedGame } from '../domain/Game';
import { GameCard } from './GameCard';
import { GameFormModal } from './GameFormModal';
import { useGameMutations, useGamePoll, useGames, useGameVotes } from './hooks';
import { MergeGamesModal } from './MergeGamesModal';
import { ParticipantDraw } from './ParticipantDraw';
import { Roulette } from './Roulette';

type Editing = { game: Game | null } | null;

interface GamePrefs extends ListPrefs {
  /** '' = todas · categoría */
  category: string;
}

const DEFAULT_PREFS: GamePrefs = { ...DEFAULT_LIST_PREFS, category: '' };

const SORTERS: Record<string, (r: RankedGame) => SortValue> = {
  name: (r) => r.game.name,
  category: (r) => CATEGORY_LABELS[r.game.category].label,
  duration: (r) => r.game.durationMinutes,
};

/** Guía de Juegos: solo se abre si la persona toca «¿Cómo funcionan los juegos?». */
const GAMES_TOUR: TourStep[] = [
  {
    title: 'Así funcionan los juegos 🎲',
    text: 'Son tres momentos: entre todos proponen juegos, luego votan por sus favoritos y, el día de la celebración, la ruleta elige a cuál jugar.',
  },
  {
    target: 'juegos-agregar',
    title: '1. Propón un juego',
    text: 'Toca este botón para sugerir un juego o actividad: ponle un nombre y cuenta cómo se juega. Cualquiera puede proponer.',
  },
  {
    target: 'juegos-lista',
    title: 'La lista de juegos',
    text: 'Aquí debajo aparecen todas las ideas. Puedes buscar un juego o ver los detalles de cada uno.',
  },
  {
    target: 'juegos-votacion',
    whenMissing: 'center',
    title: '2. Vota por tus favoritos',
    text: 'Cuando quien organiza abre la votación, aparece el botón «Votar» en cada juego. Tienes una cantidad limitada de votos y puedes quitar uno para cambiarlo.',
  },
  {
    target: 'juegos-organizar',
    title: 'Para quien organiza',
    text: 'Desde aquí abres o cierras la votación, decides cuántos votos tiene cada persona y unes los juegos que se parecen.',
  },
  {
    target: 'juegos-ruleta',
    title: '3. ¡A jugar! La ruleta',
    text: 'El día de la celebración, toca «¡Girar la ruleta!» y la suerte elige un juego de la lista.',
  },
  {
    target: 'juegos-sorteo',
    title: '¿A quién le toca?',
    text: 'Este sorteo elige al azar a una o varias personas para participar en un juego o cumplir un reto.',
  },
];

export function GamesPage() {
  const { event, context } = useEventScope();
  const games = useGames(event.id);
  const poll = useGamePoll(event.id);
  const votes = useGameVotes(event.id);
  const participants = useParticipants(event.id);
  const families = useFamilies(event.id);
  const mutations = useGameMutations(event.id);
  const toast = useToast();

  const isEditor = canEditContent(context.role);
  const acting = actingParticipants(context);
  const [voterId, setVoterId] = useState<string | null>(acting[0]?.id ?? null);
  const [editing, setEditing] = useState<Editing>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [maxVotes, setMaxVotes] = useState(3);
  const [prefs, setPrefs] = useSessionState<GamePrefs>(`${event.id}:juegos`, DEFAULT_PREFS);

  const all = useMemo(() => games.data ?? [], [games.data]);
  const active = all.filter((g) => g.status === 'active');
  const played = all.filter((g) => g.status === 'played');
  const people = participants.data ?? [];
  const ranked = useMemo(() => rankGames(active, votes.data ?? []), [active, votes.data]);

  if (games.isLoading || poll.isLoading || participants.isLoading) return <Spinner label="Cargando juegos…" />;
  if (games.error) return <Notice tone="error">{errorMessage(games.error)}</Notice>;

  const pollStatus = poll.data?.status ?? 'draft';
  const pollMax = poll.data?.maxVotes ?? 3;
  const showVotes = pollStatus !== 'draft';
  const voter = acting.find((p) => p.id === voterId) ?? acting[0];
  const myVotes = (votes.data ?? []).filter((v) => v.participantId === voter?.id);
  const remaining = Math.max(0, pollMax - myVotes.length);
  const byId = new Map(people.map((p) => [p.id, p]));
  // La posición del ranking se calcula antes de filtrar, para que no cambie al buscar
  const position = new Map(ranked.map((r, i) => [r.game.id, i + 1]));
  const patch = (p: Partial<GamePrefs>) => setPrefs((prev) => ({ ...prev, ...p }));
  const visibleGames = applySort(
    ranked.filter(
      ({ game }) =>
        (!prefs.category || game.category === prefs.category) &&
        matchesSearch(prefs.q, game.name, game.description, game.materials, CATEGORY_LABELS[game.category].label),
    ),
    SORTERS,
    prefs.sort,
    prefs.dir,
  );
  const hasFilters = Boolean(prefs.q || prefs.category);
  const canEditGame = (g: Game) => isEditor || acting.some((p) => p.id === g.proposedById);

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const toggleSelected = (id: string) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const stopSelecting = () => {
    setSelecting(false);
    setSelected([]);
  };

  return (
    <div className="space-y-5 pb-20">
      <PageTitle tone="night" icon={<Dices className="size-8" aria-hidden />} title="Juegos y actividades" subtitle="Propón ideas, vota y ¡a jugar!" />

      {/* Ayuda opcional: explica el flujo proponer → votar → jugar */}
      {!selecting && <TourButton label="¿Cómo funcionan los juegos? Te lo explicamos" steps={GAMES_TOUR} />}

      <Roulette
        games={active}
        participants={people}
        canMarkPlayed={isEditor}
        onMarkPlayed={(g) => run(() => mutations.setStatus.mutateAsync({ id: g.id, status: 'played' }), `«${g.name}» quedó como jugado. 🎉`)}
      />

      {/* Estado de la votación */}
      {pollStatus === 'open' && voter && (
        <Card data-tour="juegos-votacion" className="space-y-3 border-2 border-brand!">
          <CardTitle icon={<Vote className="size-6" />} action={<Pill tone={remaining > 0 ? 'brand' : 'success'}>{pollMax - remaining} de {pollMax}</Pill>}>
            ¡Votación abierta!
          </CardTitle>
          {acting.length > 1 && (
            <fieldset>
              <legend className="mb-2 text-base font-bold">¿Por quién votas?</legend>
              <div className="flex flex-wrap gap-2">
                {acting.map((p: Participant) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={voter.id === p.id}
                    onClick={() => setVoterId(p.id)}
                    className={chipClasses(voter.id === p.id)}
                  >
                    {p.id === context.me?.id ? 'Por mí' : `Por ${toTitleCase(p.firstName)}`}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <p className="text-base">
            {remaining > 0 ? (
              <>
                {voter.id === context.me?.id ? 'Te quedan' : `A ${toTitleCase(voter.firstName)} le quedan`} <strong>{remaining}</strong> de {pollMax}{' '}
                {pollMax === 1 ? 'voto' : 'votos'}. Toca «Votar» en tus juegos favoritos.
              </>
            ) : (
              <>✅ Ya usaste tus {pollMax} votos. Si quieres cambiar, quita uno primero.</>
            )}
          </p>
        </Card>
      )}
      {pollStatus === 'closed' && <Notice>🏁 La votación terminó. Así quedó el ranking.</Notice>}

      {/* Herramientas del organizador / editores */}
      {isEditor && (
        <Card data-tour="juegos-organizar" className="space-y-3 border-2 border-gold-400! bg-gold-50">
          <CardTitle icon={<Settings className="size-6" />} tone="gold">
            Organizar juegos
          </CardTitle>
          {pollStatus === 'open' ? (
            <Button
              variant="secondary"
              loading={mutations.setPoll.isPending}
              onClick={() => run(() => mutations.setPoll.mutateAsync({ status: 'closed', maxVotes: null }), 'Votación cerrada.')}
            >
              Cerrar la votación
            </Button>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Votos por persona
                <select
                  value={maxVotes}
                  onChange={(e) => setMaxVotes(Number(e.target.value))}
                  className={selectClasses}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                loading={mutations.setPoll.isPending}
                disabled={active.length === 0}
                icon={<Vote className="size-5" aria-hidden />}
                onClick={() => run(() => mutations.setPoll.mutateAsync({ status: 'open', maxVotes }), '¡Votación abierta! Ya pueden votar.')}
              >
                {pollStatus === 'closed' ? 'Volver a abrir la votación' : 'Abrir la votación'}
              </Button>
            </div>
          )}
          {active.length >= 2 &&
            (selecting ? (
              <Button variant="ghost" onClick={stopSelecting}>
                Cancelar unir juegos
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setSelecting(true)} icon={<Merge className="size-5" aria-hidden />}>
                Unir juegos parecidos
              </Button>
            ))}
          {selecting && <p className="text-base">Marca «Elegir para unir» en los juegos que se parecen y luego toca «Unir».</p>}
        </Card>
      )}

      {!selecting && (
        <Button size="lg" data-tour="juegos-agregar" onClick={() => setEditing({ game: null })} icon={<Plus className="size-6" aria-hidden />}>
          Agregar idea de juego o actividad
        </Button>
      )}

      {active.length === 0 ? (
        <EmptyState emoji="🎲" title="Todavía no hay juegos.">
          ¡Sé el primero! Toca «Agregar idea de juego o actividad».
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <h2 data-tour="juegos-lista" className="flex items-center justify-between gap-2 text-xl font-extrabold text-ink-900">
            {showVotes ? 'Ranking de juegos' : 'Catálogo de juegos'}
            <Pill tone="night">{active.length}</Pill>
          </h2>
          {active.length > 1 && (
            <ListToolbar
              prefs={prefs}
              onChange={patch}
              searchLabel="Buscar juego"
              sortOptions={[
                { value: 'default', label: showVotes ? 'Más votados' : 'Nombre (catálogo)' },
                { value: 'name', label: 'Nombre' },
                { value: 'category', label: 'Categoría' },
                { value: 'duration', label: 'Duración' },
              ]}
              summary={hasFilters ? `${visibleGames.length} de ${active.length} juegos` : undefined}
              onReset={hasFilters ? () => patch({ q: '', category: '' }) : null}
              activeFilters={prefs.category ? 1 : 0}
            >
              <FilterSelect label="Categoría" value={prefs.category} onChange={(category) => patch({ category })}>
                <option value="">Todas</option>
                {(Object.keys(CATEGORY_LABELS) as GameCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c].label}
                  </option>
                ))}
              </FilterSelect>
            </ListToolbar>
          )}
          {visibleGames.length === 0 && <Notice>No hay juegos con esos filtros.</Notice>}
          {visibleGames.map(({ game, votes: n, percent }) => {
            const hasVoted = myVotes.some((v) => v.gameId === game.id);
            const busy =
              (mutations.vote.isPending && mutations.vote.variables?.gameId === game.id) ||
              (mutations.unvote.isPending && mutations.unvote.variables?.gameId === game.id);
            return (
              <GameCard
                key={game.id}
                game={game}
                rank={position.get(game.id) ?? 0}
                votes={n}
                percent={percent}
                showVotes={showVotes}
                credits={gameCredits(game, all)
                  .map((id) => byId.get(id))
                  .filter((p): p is Participant => Boolean(p))}
                participants={people}
                voting={
                  pollStatus === 'open' && voter
                    ? {
                        hasVoted,
                        canVoteMore: remaining > 0,
                        busy,
                        onVote: () => run(() => mutations.vote.mutateAsync({ gameId: game.id, participantId: voter.id }), `¡Voto registrado para «${game.name}»!`),
                        onUnvote: () => run(() => mutations.unvote.mutateAsync({ gameId: game.id, participantId: voter.id }), 'Quitamos tu voto.'),
                      }
                    : null
                }
                canEdit={canEditGame(game)}
                onEdit={() => setEditing({ game })}
                selecting={selecting}
                selected={selected.includes(game.id)}
                onToggleSelect={() => toggleSelected(game.id)}
              />
            );
          })}
        </div>
      )}

      <ParticipantDraw participants={people} families={families.data ?? []} />

      {played.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>✅ Ya jugamos</SectionTitle>
          <ul className="space-y-2">
            {played.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-mist-300 bg-white px-4 py-3">
                <span className="text-base font-bold text-ink-700">{g.name}</span>
                {isEditor && (
                  <Button
                    variant="ghost"
                    icon={<RotateCcw className="size-5" aria-hidden />}
                    onClick={() => run(() => mutations.setStatus.mutateAsync({ id: g.id, status: 'active' }), `«${g.name}» volvió a la lista.`)}
                  >
                    Volver a la lista
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Barra fija para unir juegos */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-6 md:pl-64">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl bg-night-800 px-4 py-3 text-white shadow-lift">
            <span className="text-base font-bold">{selected.length} elegidos</span>
            <Button disabled={selected.length < 2} onClick={() => setMerging(true)} icon={<Merge className="size-5" aria-hidden />}>
              Unir
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <GameFormModal
          key={editing.game?.id ?? 'new'}
          eventId={event.id}
          initial={editing.game}
          allGames={all}
          participants={people}
          proposers={acting}
          meId={context.me?.id ?? null}
          canDelete={editing.game ? canEditGame(editing.game) : false}
          onClose={() => setEditing(null)}
        />
      )}

      {merging && (
        <MergeGamesModal
          eventId={event.id}
          games={active.filter((g) => selected.includes(g.id))}
          participants={people}
          onClose={() => setMerging(false)}
          onDone={() => {
            setMerging(false);
            stopSelecting();
          }}
        />
      )}
    </div>
  );
}
