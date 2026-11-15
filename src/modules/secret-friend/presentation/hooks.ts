import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';

export const secretFriendKeys = { mine: (eventId: string) => ['secret-friend', eventId] as const };

export function useMySecretFriends(eventId: string) {
  const { secretFriend } = useServices();
  return useQuery({ queryKey: secretFriendKeys.mine(eventId), queryFn: () => secretFriend.listMine(eventId) });
}

export function useSecretFriendMutations(eventId: string) {
  const { secretFriend } = useServices();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: secretFriendKeys.mine(eventId) });
  return {
    set: useMutation({
      mutationFn: ({ giverId, receiverId }: { giverId: string; receiverId: string }) => secretFriend.set(eventId, giverId, receiverId),
      onSuccess: refresh,
    }),
    clear: useMutation({ mutationFn: (giverId: string) => secretFriend.clear(giverId), onSuccess: refresh }),
  };
}
