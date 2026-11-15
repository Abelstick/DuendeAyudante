import { Dices, Merge, Plus, RotateCcw, Vote } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants, canEditContent } from '@/modules/events/domain/Event';
import type { Participant } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { Button, Spinner } from '@/shared/ui/Button';
import { Card, EmptyState, Notice, PageTitle, SectionTitle } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';
import { toTitleCase } from '@/shared/validation/names';
import { type Game, gameCredits, rankGames } from '../domain/Game';
import { GameCard } from './GameCard';
import { GameFormModal } from './GameFormModal';
import { useGameMutations, useGamePoll, useGames, useGameVotes } from './hooks';
import { MergeGamesModal } from './MergeGamesModal';
import { Roulette } from './Roulette';

type Editing = { game: Game | null } | null;

export function GamesPage() {
  const { event, context } = useEventScope();
  const games = useGames(event.id);
  const poll = useGamePoll(event.id);
  const votes = useGameVotes(event.id);
  const participants = useParticipants(event.id);
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
      <PageTitle icon={<Dices className="size-8 text-brand" aria-hidden />} title="Juegos y actividades" subtitle="Propón ideas, vota y ¡a jugar!" />

      <Roulette
        games={active}
        participants={people}
        canMarkPlayed={isEditor}
        onMarkPlayed={(g) => run(() => mutations.setStatus.mutateAsync({ id: g.id, status: 'played' }), `«${g.name}» quedó como jugado. 🎉`)}
      />

      {/* Estado de la votación */}
      {pollStatus === 'open' && voter && (
        <Card className="space-y-3 border-2 border-brand">
          <p className="flex items-center gap-2 text-lg font-bold text-brand">
            <Vote className="size-6" aria-hidden /> ¡La votación está abierta!
          </p>
          {acting.length > 1 && (
            <fieldset>
              <legend className="mb-2 text-base font-semibold">¿Por quién votas?</legend>
              <div className="flex flex-wrap gap-2">
                {acting.map((p: Participant) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={voter.id === p.id}
                    onClick={() => setVoterId(p.id)}
                    className={`min-h-12 rounded-full border-2 px-4 text-base font-semibold ${
                      voter.id === p.id ? 'border-brand bg-brand text-white' : 'border-cream-200 bg-white'
                    }`}
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
        <Card className="space-y-3 border-2 border-gold-400 bg-gold-100/40">
          <SectionTitle>Organizar juegos</SectionTitle>
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
                  className="min-h-12 rounded-xl border-2 border-cream-200 bg-white px-3 text-base"
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
        <Button size="lg" onClick={() => setEditing({ game: null })} icon={<Plus className="size-6" aria-hidden />}>
          Agregar idea de juego o actividad
        </Button>
      )}

      {active.length === 0 ? (
        <EmptyState emoji="🎲" title="Todavía no hay juegos.">
          ¡Sé el primero! Toca «Agregar idea de juego o actividad».
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {ranked.map(({ game, votes: n, percent }, i) => {
            const hasVoted = myVotes.some((v) => v.gameId === game.id);
            const busy =
              (mutations.vote.isPending && mutations.vote.variables?.gameId === game.id) ||
              (mutations.unvote.isPending && mutations.unvote.variables?.gameId === game.id);
            return (
              <GameCard
                key={game.id}
                game={game}
                rank={i + 1}
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

      {played.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>✅ Ya jugamos</SectionTitle>
          <ul className="space-y-2">
            {played.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3">
                <span className="text-base font-semibold">{g.name}</span>
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
        <div className="fixed inset-x-0 bottom-20 z-30 px-4 md:bottom-6">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-white shadow-xl">
            <span className="text-base font-semibold">{selected.length} elegidos</span>
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
