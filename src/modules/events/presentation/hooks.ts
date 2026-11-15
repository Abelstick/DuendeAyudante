import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import type { CreateEventInput } from '../domain/Event';

export const eventKeys = {
  mine: ['events', 'mine'] as const,
  detail: (id: string) => ['event', id] as const,
  context: (id: string) => ['event', id, 'context'] as const,
};

export function useMyEvents(enabled = true) {
  const { events } = useServices();
  return useQuery({ queryKey: eventKeys.mine, queryFn: () => events.listMine(), enabled });
}

export function useEvent(eventId: string) {
  const { events } = useServices();
  return useQuery({ queryKey: eventKeys.detail(eventId), queryFn: () => events.getById(eventId), enabled: Boolean(eventId) });
}

export function useEventContext(eventId: string) {
  const { events } = useServices();
  return useQuery({ queryKey: eventKeys.context(eventId), queryFn: () => events.getMyContext(eventId), enabled: Boolean(eventId) });
}

export function useJoinCodeChecker() {
  const { events } = useServices();
  return (code: string) => events.isJoinCodeAvailable(code);
}

export function useChangeJoinCode(eventId: string) {
  const { events } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (newCode: string) => events.changeJoinCode(eventId, newCode),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      void qc.invalidateQueries({ queryKey: eventKeys.mine });
    },
  });
}

export function useCreateEvent() {
  const { events } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) => events.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: eventKeys.mine }),
  });
}
