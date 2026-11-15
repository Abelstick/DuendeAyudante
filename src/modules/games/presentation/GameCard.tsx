import { CheckCircle2, ChevronDown, ChevronUp, Clock, Pencil, ThumbsUp, Users, X } from 'lucide-react';
import { useState } from 'react';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { Button } from '@/shared/ui/Button';
import { Pill } from '@/shared/ui/Card';
import { ProgressBar } from '@/shared/ui/Progress';
import { CATEGORY_LABELS, type Game, type GameCategory } from '../domain/Game';

/** Color de la "carátula" de cada categoría (la categoría también va escrita). */
const CATEGORY_COVER: Record<GameCategory, string> = {
  family_bonding: 'from-berry-500 to-berry-700',
  competition: 'from-gold-300 to-gold-400',
  board: 'from-night-600 to-night-800',
  movement: 'from-pine-600 to-pine-800',
  trivia_challenges: 'from-night-600 to-berry-600',
  kids: 'from-gold-300 to-berry-500',
  adults: 'from-pine-600 to-night-700',
};

function playersText(g: Game): string | null {
  if (g.minPlayers && g.maxPlayers) return g.minPlayers === g.maxPlayers ? `${g.minPlayers} personas` : `De ${g.minPlayers} a ${g.maxPlayers} personas`;
  if (g.minPlayers) return `Desde ${g.minPlayers} personas`;
  if (g.maxPlayers) return `Hasta ${g.maxPlayers} personas`;
  return null;
}

/** Datos para jugar: duración, personas, materiales, reglas y quién dirige. */
export function GameDetails({ game, participants, hideMeta = false }: { game: Game; participants: Participant[]; hideMeta?: boolean }) {
  const responsible = participants.find((p) => p.id === game.responsibleId);
  const players = playersText(game);
  return (
    <dl className="space-y-2 text-base">
      {!hideMeta && (game.durationMinutes || players) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {game.durationMinutes && (
            <span>
              ⏱️ <dt className="sr-only">Duración</dt>
              <dd className="inline">{game.durationMinutes} minutos</dd>
            </span>
          )}
          {players && (
            <span>
              👥 <dt className="sr-only">Participantes</dt>
              <dd className="inline">{players}</dd>
            </span>
          )}
        </div>
      )}
      {responsible && (
        <div>
          <dt className="inline font-semibold">🎤 Lo dirige: </dt>
          <dd className="inline">{displayName(responsible)}</dd>
        </div>
      )}
      {game.materials && (
        <div>
          <dt className="font-semibold">🧺 Materiales</dt>
          <dd className="whitespace-pre-line text-ink-700">{game.materials}</dd>
        </div>
      )}
      {game.instructions && (
        <div>
          <dt className="font-semibold">📖 Cómo se juega</dt>
          <dd className="whitespace-pre-line text-ink-700">{game.instructions}</dd>
        </div>
      )}
    </dl>
  );
}

interface Props {
  game: Game;
  rank?: number;
  votes?: number;
  percent?: number;
  showVotes: boolean;
  credits: Participant[];
  participants: Participant[];
  voting: null | { hasVoted: boolean; canVoteMore: boolean; busy: boolean; onVote: () => void; onUnvote: () => void };
  canEdit: boolean;
  onEdit: () => void;
  selecting: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}

export function GameCard({ game, rank, votes = 0, percent = 0, showVotes, credits, participants, voting, canEdit, onEdit, selecting, selected, onToggleSelect }: Props) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORY_LABELS[game.category];
  const players = playersText(game);
  const hasDetails = Boolean(game.instructions || game.materials || game.responsibleId);
  const medal = showVotes && rank !== undefined && rank <= 3 && votes > 0 ? ['🥇', '🥈', '🥉'][rank - 1] : null;

  return (
    <article className={`animate-pop-in overflow-hidden rounded-3xl border-2 bg-white shadow-card ${selected ? 'border-brand' : voting?.hasVoted ? 'border-brand/40' : 'border-mist-200'}`}>
      {selecting && (
        <label className="flex min-h-12 cursor-pointer items-center gap-3 bg-brand-soft px-4 font-bold text-brand">
          <input type="checkbox" className="size-6 accent-brand" checked={selected} onChange={onToggleSelect} />
          Elegir para unir
        </label>
      )}

      <div className="flex items-stretch">
        {/* Carátula: emoji de la categoría, como la caja de un videojuego */}
        <div className={`relative flex w-20 shrink-0 items-center justify-center bg-gradient-to-br text-4xl ${CATEGORY_COVER[game.category]}`} aria-hidden>
          <span className="drop-shadow">{cat.emoji}</span>
          {showVotes && rank !== undefined && (
            <span className="absolute left-2 top-2 flex size-8 items-center justify-center rounded-full bg-white text-base font-black text-ink-900 shadow-card">
              {medal ?? rank}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2 p-4">
          <div>
            <p className="text-sm font-bold text-ink-500">
              {cat.label}
              {showVotes && rank !== undefined && <span className="sr-only"> · Puesto {rank}</span>}
            </p>
            <h3 className="text-xl font-extrabold leading-tight text-ink-900">{game.name}</h3>
          </div>
          {(game.durationMinutes || players) && (
            <p className="flex flex-wrap gap-1.5">
              {game.durationMinutes && (
                <Pill tone="night">
                  <Clock className="size-4" aria-hidden /> {game.durationMinutes} min
                </Pill>
              )}
              {players && (
                <Pill tone="night">
                  <Users className="size-4" aria-hidden /> {players}
                </Pill>
              )}
            </p>
          )}
          {credits.length > 0 && <p className="text-sm text-ink-700">Idea de: {credits.map((p) => displayName(p)).join(', ')}</p>}
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4 pt-1 empty:hidden">
        {game.description && <p className="whitespace-pre-line text-base text-ink-700">{game.description}</p>}

        {showVotes && (
          <div>
            <p className="mb-1 text-base">
              <strong>{votes}</strong> {votes === 1 ? 'voto' : 'votos'} · {percent}% de los que votaron
            </p>
            <ProgressBar percent={percent} label={`Votos para ${game.name}`} size="md" tone={medal === '🥇' ? 'gold' : 'brand'} />
          </div>
        )}

        {hasDetails && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="flex min-h-12 items-center gap-2 text-base font-bold text-brand underline underline-offset-4"
            >
              {open ? <ChevronUp className="size-5" aria-hidden /> : <ChevronDown className="size-5" aria-hidden />}
              {open ? 'Ocultar cómo se juega' : 'Ver cómo se juega'}
            </button>
            {open && (
              <div className="animate-pop-in rounded-2xl bg-mist-100 p-4">
                <GameDetails game={game} participants={participants} hideMeta />
              </div>
            )}
          </>
        )}

        {voting?.hasVoted && !selecting && (
          <p className="flex items-center gap-2 text-base font-bold text-brand">
            <CheckCircle2 className="size-5" aria-hidden /> Votaste por este juego
          </p>
        )}

        {!selecting && (voting || canEdit) && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {voting &&
              (voting.hasVoted ? (
                <Button variant="secondary" loading={voting.busy} onClick={voting.onUnvote} icon={<X className="size-5" aria-hidden />}>
                  Quitar mi voto
                </Button>
              ) : (
                <Button loading={voting.busy} disabled={!voting.canVoteMore} onClick={voting.onVote} icon={<ThumbsUp className="size-5" aria-hidden />}>
                  {voting.canVoteMore ? 'Votar' : 'Sin votos disponibles'}
                </Button>
              ))}
            {canEdit && (
              <Button variant="ghost" onClick={onEdit} icon={<Pencil className="size-5" aria-hidden />}>
                Editar
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
