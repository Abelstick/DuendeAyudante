import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';
import type { Responsibility, ResponsibilityStatus, SaveResponsibilityData } from '../domain/Responsibility';

export const responsibilityKeys = { list: (eventId: string) => ['responsibilities', eventId] as const };

export function useResponsibilities(eventId: string) {
  const { responsibilities } = useServices();
  return useQuery({ queryKey: responsibilityKeys.list(eventId), queryFn: () => responsibilities.list(eventId) });
}

export function useResponsibilityMutations(eventId: string) {
  const { responsibilities } = useServices();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: responsibilityKeys.list(eventId) });
  return {
    save: useMutation({ mutationFn: (data: SaveResponsibilityData) => responsibilities.save(data), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => responsibilities.remove(id), onSuccess: refresh }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: ResponsibilityStatus }) => responsibilities.setStatus(id, status),
      onSuccess: refresh,
    }),
  };
}

const STATUS_TOASTS: Record<ResponsibilityStatus, string> = {
  done: '¡Gracias! Quedó marcado como completado. ✅',
  in_progress: 'Anotado: lo estás haciendo.',
  pending: 'Volvió a quedar pendiente.',
};

/** Cambia el estado con un mensaje claro de confirmación o de error. */
export function useStatusChanger(eventId: string) {
  const { setStatus } = useResponsibilityMutations(eventId);
  const toast = useToast();
  return {
    busyId: setStatus.isPending ? setStatus.variables?.id : undefined,
    change: async (item: Responsibility, status: ResponsibilityStatus) => {
      try {
        await setStatus.mutateAsync({ id: item.id, status });
        toast.success(STATUS_TOASTS[status]);
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
  };
}
