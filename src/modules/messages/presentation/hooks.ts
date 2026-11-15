import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import type { SaveMessageData } from '../domain/HolidayMessage';

export const messageKeys = {
  sent: (eventId: string) => ['messages', eventId, 'sent'] as const,
  received: (eventId: string) => ['messages', eventId, 'received'] as const,
};

export function useSentMessages(eventId: string) {
  const { messages } = useServices();
  return useQuery({ queryKey: messageKeys.sent(eventId), queryFn: () => messages.listSent(eventId) });
}

/** Se vuelve a pedir cada minuto: así los mensajes se abren solos a la medianoche. */
export function useReceivedMessages(eventId: string) {
  const { messages } = useServices();
  return useQuery({ queryKey: messageKeys.received(eventId), queryFn: () => messages.listReceived(eventId), refetchInterval: 60_000 });
}

export function useMessageMutations(eventId: string) {
  const { messages } = useServices();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: messageKeys.sent(eventId) });
  return {
    save: useMutation({ mutationFn: (data: SaveMessageData) => messages.save(data), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => messages.remove(id), onSuccess: refresh }),
  };
}
