import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import type { SaveExpenseData } from '../domain/Expense';

export const expenseKeys = { list: (eventId: string) => ['expenses', eventId] as const };

export function useExpenses(eventId: string) {
  const { expenses } = useServices();
  return useQuery({ queryKey: expenseKeys.list(eventId), queryFn: () => expenses.list(eventId) });
}

export function useExpenseMutations(eventId: string) {
  const { expenses } = useServices();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: expenseKeys.list(eventId) });
  return {
    save: useMutation({ mutationFn: (data: SaveExpenseData) => expenses.save(data), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => expenses.remove(id), onSuccess: refresh }),
  };
}
