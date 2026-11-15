import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import type { SaveScheduleData } from '../domain/Schedule';

export const scheduleKeys = { list: (eventId: string) => ['schedule', eventId] as const };

export function useSchedule(eventId: string) {
  const { schedule } = useServices();
  return useQuery({ queryKey: scheduleKeys.list(eventId), queryFn: () => schedule.list(eventId), refetchInterval: 60_000 });
}

export function useScheduleMutations(eventId: string) {
  const { schedule } = useServices();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: scheduleKeys.list(eventId) });
  return {
    save: useMutation({ mutationFn: (data: SaveScheduleData) => schedule.save(data), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => schedule.remove(id), onSuccess: refresh }),
  };
}
