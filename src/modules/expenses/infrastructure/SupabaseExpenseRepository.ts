import type { SupabaseClient } from '@supabase/supabase-js';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { IExpenseRepository } from '../application/ExpenseService';
import type { Expense, ExpenseKind, SaveExpenseData } from '../domain/Expense';

interface Row {
  id: string;
  event_id: string;
  kind: ExpenseKind;
  description: string;
  amount: number | string;
  paid_by_participant_id: string;
  responsibility_id: string | null;
  created_at: string;
  expense_shares: { participant_id: string }[] | null;
}

export class SupabaseExpenseRepository implements IExpenseRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(eventId: string): Promise<Expense[]> {
    const { data, error } = await this.supabase
      .from('expenses')
      .select('id, event_id, kind, description, amount, paid_by_participant_id, responsibility_id, created_at, expense_shares(participant_id)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .returns<Row[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((row) => ({
      id: row.id,
      eventId: row.event_id,
      kind: row.kind,
      description: row.description,
      amount: Number(row.amount),
      paidById: row.paid_by_participant_id,
      participantIds: (row.expense_shares ?? []).map((s) => s.participant_id),
      responsibilityId: row.responsibility_id,
      createdAt: new Date(row.created_at),
    }));
  }

  async save(data: SaveExpenseData): Promise<string> {
    const { data: id, error } = await this.supabase.rpc('save_expense', {
      p_event_id: data.eventId,
      p_kind: data.kind,
      p_description: data.description,
      p_amount: data.amount,
      p_paid_by: data.paidById,
      p_participant_ids: data.participantIds,
      p_responsibility_id: data.responsibilityId,
      p_id: data.id,
    });
    if (error) throw fromPostgrestError(error);
    return id as string;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.rpc('delete_expense', { p_id: id });
    if (error) throw fromPostgrestError(error);
  }
}
