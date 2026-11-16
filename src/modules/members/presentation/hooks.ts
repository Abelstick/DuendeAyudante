import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import { eventKeys } from '@/modules/events/presentation/hooks';
import type { NewMemberData } from '../domain/IMemberAccountService';
import type { ParticipantDetails } from '../domain/IParticipantRepository';

export const memberKeys = {
  participants: (eventId: string) => ['participants', eventId] as const,
  members: (eventId: string) => ['members', eventId] as const,
};

export function useParticipants(eventId: string) {
  const { members } = useServices();
  return useQuery({ queryKey: memberKeys.participants(eventId), queryFn: () => members.listActive(eventId) });
}

/** Solo organizador/administradores. */
export function useMembers(eventId: string) {
  const { members } = useServices();
  return useQuery({ queryKey: memberKeys.members(eventId), queryFn: () => members.listMembers(eventId) });
}

export function useMemberMutations(eventId: string) {
  const { members } = useServices();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: memberKeys.members(eventId) });
    void qc.invalidateQueries({ queryKey: memberKeys.participants(eventId) });
  };
  return {
    add: useMutation({ mutationFn: (data: NewMemberData) => members.addMember(data), onSuccess: refresh }),
    resetPassword: useMutation({
      mutationFn: ({ participantId, password }: { participantId: string; password: string }) =>
        members.resetPassword(eventId, participantId, password),
    }),
    updateFamily: useMutation({
      mutationFn: ({ participantId, familyId }: { participantId: string; familyId: string | null }) =>
        members.updateFamily(participantId, familyId),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ participantId, details }: { participantId: string; details: ParticipantDetails }) => members.updateMember(participantId, details),
      onSuccess: refresh,
    }),
    setGuardians: useMutation({
      mutationFn: ({ participantId, guardianIds }: { participantId: string; guardianIds: string[] }) => members.setGuardians(eventId, participantId, guardianIds),
      onSuccess: () => {
        refresh();
        // Si quien administra se eligió a sí mismo, sus "personas a cargo" cambian al instante
        void qc.invalidateQueries({ queryKey: eventKeys.context(eventId) });
      },
    }),
  };
}

export function useAccessMessage() {
  const { members } = useServices();
  return members.buildAccessMessage.bind(members);
}
