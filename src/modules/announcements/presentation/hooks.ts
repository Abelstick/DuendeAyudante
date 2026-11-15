import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import type { SaveAnnouncementData } from '../domain/Announcement';

export const announcementKeys = { list: (eventId: string) => ['announcements', eventId] as const };

export function useAnnouncements(eventId: string) {
  const { announcements } = useServices();
  return useQuery({ queryKey: announcementKeys.list(eventId), queryFn: () => announcements.list(eventId), refetchInterval: 60_000 });
}

export function useAnnouncementMutations(eventId: string) {
  const { announcements } = useServices();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: announcementKeys.list(eventId) });
  return {
    save: useMutation({ mutationFn: (data: SaveAnnouncementData) => announcements.save(data), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => announcements.remove(id), onSuccess: refresh }),
  };
}
