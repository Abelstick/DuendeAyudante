import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import type { GameStatus, MergeGamesData, PollStatus, SaveGameData } from '../domain/Game';

export const gameKeys = {
  all: (eventId: string) => ['games', eventId] as const,
  list: (eventId: string) => ['games', eventId, 'list'] as const,
  poll: (eventId: string) => ['games', eventId, 'poll'] as const,
  votes: (eventId: string) => ['games', eventId, 'votes'] as const,
};

export function useGames(eventId: string) {
  const { games } = useServices();
  return useQuery({ queryKey: gameKeys.list(eventId), queryFn: () => games.list(eventId) });
}

export function useGamePoll(eventId: string) {
  const { games } = useServices();
  return useQuery({ queryKey: gameKeys.poll(eventId), queryFn: () => games.getPoll(eventId) });
}

export function useGameVotes(eventId: string) {
  const { games } = useServices();
  // Con la votación abierta, se refresca para ver los votos de los demás
  return useQuery({ queryKey: gameKeys.votes(eventId), queryFn: () => games.listVotes(eventId), refetchInterval: 20_000 });
}

export function useGameMutations(eventId: string) {
  const { games } = useServices();
  const qc = useQueryClient();
  const refreshAll = () => qc.invalidateQueries({ queryKey: gameKeys.all(eventId) });
  const refreshVotes = () => qc.invalidateQueries({ queryKey: gameKeys.votes(eventId) });
  return {
    save: useMutation({ mutationFn: (data: SaveGameData) => games.save(data), onSuccess: refreshAll }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: Exclude<GameStatus, 'merged'> }) => games.setStatus(id, status),
      onSuccess: refreshAll,
    }),
    remove: useMutation({ mutationFn: (id: string) => games.remove(id), onSuccess: refreshAll }),
    merge: useMutation({ mutationFn: (data: MergeGamesData) => games.merge(data), onSuccess: refreshAll }),
    setPoll: useMutation({
      mutationFn: ({ status, maxVotes }: { status: PollStatus; maxVotes: number | null }) => games.setPoll(eventId, status, maxVotes),
      onSuccess: refreshAll,
    }),
    vote: useMutation({
      mutationFn: ({ gameId, participantId }: { gameId: string; participantId: string }) => games.vote(gameId, participantId),
      onSuccess: refreshVotes,
    }),
    unvote: useMutation({
      mutationFn: ({ gameId, participantId }: { gameId: string; participantId: string }) => games.unvote(gameId, participantId),
      onSuccess: refreshVotes,
    }),
  };
}
