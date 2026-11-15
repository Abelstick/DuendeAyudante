import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import type { NewMemberData } from '../domain/IMemberAccountService';

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
  };
}

export function useAccessMessage() {
  const { members } = useServices();
  return members.buildAccessMessage.bind(members);
}
