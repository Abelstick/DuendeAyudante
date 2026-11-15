import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';

export const familyAccessKeys = {
  list: (eventId: string) => ['family-access', eventId] as const,
  info: (token: string) => ['family-link', token] as const,
};

/** Enlaces de familia ya creados (solo organizador/administradores). */
export function useFamilyAccessList(eventId: string) {
  const { familyAccess } = useServices();
  return useQuery({ queryKey: familyAccessKeys.list(eventId), queryFn: () => familyAccess.listForEvent(eventId) });
}

export function useSetFamilyWord(eventId: string) {
  const { familyAccess } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, word }: { familyId: string; word: string }) => familyAccess.setWord(familyId, word),
    onSuccess: () => qc.invalidateQueries({ queryKey: familyAccessKeys.list(eventId) }),
  });
}

/** Datos públicos del enlace (nombre de la Navidad y de la familia). */
export function useFamilyLinkInfo(token: string) {
  const { familyAccess } = useServices();
  return useQuery({ queryKey: familyAccessKeys.info(token), queryFn: () => familyAccess.getInfo(token), retry: false, staleTime: Infinity });
}
