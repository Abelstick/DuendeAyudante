import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import type { SaveFamilyData } from '../domain/IFamilyRepository';

export const familyKeys = { list: (eventId: string) => ['families', eventId] as const };

export function useFamilies(eventId: string) {
  const { families } = useServices();
  return useQuery({ queryKey: familyKeys.list(eventId), queryFn: () => families.list(eventId) });
}

export function useFamilyMutations(eventId: string) {
  const { families } = useServices();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: familyKeys.list(eventId) });
    void qc.invalidateQueries({ queryKey: ['participants', eventId] });
    void qc.invalidateQueries({ queryKey: ['members', eventId] });
  };
  return {
    create: useMutation({ mutationFn: (data: SaveFamilyData) => families.create(eventId, data), onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, data }: { id: string; data: SaveFamilyData }) => families.update(id, data), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => families.remove(id), onSuccess: refresh }),
  };
}
