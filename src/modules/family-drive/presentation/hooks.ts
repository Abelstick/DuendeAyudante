import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import { photoUploadStatus, type DriveTarget } from '../domain/FamilyDrive';

export const familyDriveKeys = {
  event: (eventId: string) => ['family-drives', eventId] as const,
  general: (eventId: string) => ['event-drive', eventId] as const,
};

export function useFamilyDrives(eventId: string) {
  const { familyDrives } = useServices();
  return useQuery({ queryKey: familyDriveKeys.event(eventId), queryFn: () => familyDrives.listForEvent(eventId) });
}

/** Drive general de la celebración (para todas las familias). */
export function useEventDrive(eventId: string) {
  const { familyDrives } = useServices();
  return useQuery({ queryKey: familyDriveKeys.general(eventId), queryFn: () => familyDrives.getEventDrive(eventId) });
}

/** ¿Puede subir fotos alguien de esta familia? (su Drive o, si no, el general). */
export function usePhotoUploadStatus(eventId: string, familyId: string | null | undefined) {
  const family = useFamilyDrives(eventId);
  const general = useEventDrive(eventId);
  return photoUploadStatus(familyId, family.data ?? [], general.data);
}

export function useFamilyDriveMutations(eventId: string) {
  const { familyDrives } = useServices();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: familyDriveKeys.event(eventId) });
    void qc.invalidateQueries({ queryKey: familyDriveKeys.general(eventId) });
  };
  return {
    /** Lleva a Google para elegir la cuenta; al terminar, Google devuelve a Organizar. */
    connect: useMutation({
      mutationFn: async (target: DriveTarget) => {
        window.location.assign(await familyDrives.getConnectUrl(target));
      },
    }),
    disconnect: useMutation({ mutationFn: (target: DriveTarget) => familyDrives.disconnect(target), onSuccess: refresh }),
  };
}
