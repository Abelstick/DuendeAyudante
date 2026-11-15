import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import type { SaveChecklistItemData } from '../domain/Checklist';

export const checklistKeys = {
  items: (eventId: string) => ['checklist', eventId, 'items'] as const,
  progress: (eventId: string) => ['checklist', eventId, 'progress'] as const,
};

export function useChecklistItems(eventId: string) {
  const { checklist } = useServices();
  return useQuery({ queryKey: checklistKeys.items(eventId), queryFn: () => checklist.list(eventId) });
}

export function useChecklistProgress(eventId: string) {
  const { checklist } = useServices();
  return useQuery({ queryKey: checklistKeys.progress(eventId), queryFn: () => checklist.listProgress(eventId) });
}

export function useChecklistMutations(eventId: string) {
  const { checklist } = useServices();
  const qc = useQueryClient();
  const refreshItems = () => qc.invalidateQueries({ queryKey: checklistKeys.items(eventId) });
  return {
    create: useMutation({ mutationFn: (data: SaveChecklistItemData) => checklist.create(eventId, data), onSuccess: refreshItems }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: SaveChecklistItemData }) => checklist.update(id, data),
      onSuccess: refreshItems,
    }),
    remove: useMutation({ mutationFn: (id: string) => checklist.remove(id), onSuccess: refreshItems }),
    setDone: useMutation({
      mutationFn: ({ itemId, participantId, done }: { itemId: string; participantId: string; done: boolean }) =>
        checklist.setDone(itemId, participantId, done),
      onSuccess: () => qc.invalidateQueries({ queryKey: checklistKeys.progress(eventId) }),
    }),
  };
}
