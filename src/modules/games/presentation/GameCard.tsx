import { ChevronDown, ChevronUp, Pencil, ThumbsUp, X } from 'lucide-react';
import { useState } from 'react';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { Button } from '@/shared/ui/Button';
import { CATEGORY_LABELS, type Game } from '../domain/Game';

function playersText(g: Game): string | null {
  if (g.minPlayers && g.maxPlayers) return g.minPlayers === g.maxPlayers ? `${g.minPlayers} personas` : `De ${g.minPlayers} a ${g.maxPlayers} personas`;
  if (g.minPlayers) return `Desde ${g.minPlayers} personas`;
  if (g.maxPlayers) return `Hasta ${g.maxPlayers} personas`;
  return null;
}

/** Datos para jugar: duración, personas, materiales, reglas y quién dirige. */
export function GameDetails({ game, participants }: { game: Game; participants: Participant[] }) {
  const responsible = participants.find((p) => p.id === game.responsibleId);
  const players = playersText(game);
  return (
    <dl className="space-y-2 text-base">
      {(game.durationMinutes || players) && (
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
  const hasDetails = Boolean(game.instructions || game.materials || game.durationMinutes || game.minPlayers || game.maxPlayers || game.responsibleId);

  return (
    <article className={`animate-pop-in space-y-3 rounded-3xl border-2 bg-white p-4 shadow-sm ${selected ? 'border-brand' : 'border-transparent'}`}>
      {selecting && (
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-brand-soft px-3 font-semibold text-brand">
          <input type="checkbox" className="size-6 accent-brand" checked={selected} onChange={onToggleSelect} />
          Elegir para unir
        </label>
      )}

      <div className="flex items-start gap-3">
        {showVotes && rank !== undefined && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg font-bold text-brand" aria-label={`Puesto ${rank}`}>
            {rank <= 3 && votes > 0 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-700">
            <span aria-hidden>{cat.emoji}</span> {cat.label}
          </p>
          <h3 className="text-xl font-bold text-ink-900">{game.name}</h3>
          {credits.length > 0 && <p className="text-sm text-ink-700">Idea de: {credits.map((p) => displayName(p)).join(', ')}</p>}
        </div>
      </div>

      {game.description && <p className="whitespace-pre-line text-base text-ink-700">{game.description}</p>}

      {showVotes && (
        <div>
          <p className="mb-1 text-base">
            <strong>{votes}</strong> {votes === 1 ? 'voto' : 'votos'} · {percent}% de los que votaron
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-cream-200" aria-hidden>
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {hasDetails && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-h-12 items-center gap-2 text-base font-semibold text-brand underline"
          >
            {open ? <ChevronUp className="size-5" aria-hidden /> : <ChevronDown className="size-5" aria-hidden />}
            {open ? 'Ocultar cómo se juega' : 'Ver cómo se juega'}
          </button>
          {open && <GameDetails game={game} participants={participants} />}
        </>
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
      {voting?.hasVoted && !selecting && <p className="text-base font-semibold text-brand">✅ Votaste por este juego</p>}
    </article>
  );
}
