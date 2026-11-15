import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';

export const familyDriveKeys = { event: (eventId: string) => ['family-drives', eventId] as const };

export function useFamilyDrives(eventId: string) {
  const { familyDrives } = useServices();
  return useQuery({ queryKey: familyDriveKeys.event(eventId), queryFn: () => familyDrives.listForEvent(eventId) });
}

export function useFamilyDriveMutations(eventId: string) {
  const { familyDrives } = useServices();
  const qc = useQueryClient();
  return {
    /** Lleva a Google para elegir la cuenta; al terminar, Google devuelve a Organizar. */
    connect: useMutation({
      mutationFn: async (familyId: string) => {
        window.location.assign(await familyDrives.getConnectUrl(familyId));
      },
    }),
    disconnect: useMutation({
      mutationFn: (familyId: string) => familyDrives.disconnect(familyId),
      onSuccess: () => qc.invalidateQueries({ queryKey: familyDriveKeys.event(eventId) }),
    }),
  };
}
