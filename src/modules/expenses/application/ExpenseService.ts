import { AppError } from '@/shared/domain/errors';
import type { Expense, SaveExpenseData } from '../domain/Expense';

export interface IExpenseRepository {
  list(eventId: string): Promise<Expense[]>;
  /** Crea o edita, reemplazando entre quiénes se divide (todo o nada). */
  save(data: SaveExpenseData): Promise<string>;
  remove(id: string): Promise<void>;
}

export class ExpenseService {
  constructor(private readonly expenses: IExpenseRepository) {}

  list(eventId: string) {
    return this.expenses.list(eventId);
  }

  save(data: SaveExpenseData): Promise<string> {
    const description = data.description.trim().replace(/\s+/g, ' ');
    if (!description || description.length > 120) throw new AppError('EXPENSE_DESCRIPTION_INVALID');
    if (!Number.isFinite(data.amount) || data.amount <= 0 || data.amount >= 100_000_000 || Math.abs(Math.round(data.amount * 100) - data.amount * 100) > 1e-6) {
      throw new AppError('AMOUNT_INVALID');
    }
    const participantIds = [...new Set(data.participantIds)];
    if (participantIds.length === 0) throw new AppError('EXPENSE_SHARES_REQUIRED');
    if (data.kind === 'payment' && (participantIds.length !== 1 || participantIds[0] === data.paidById)) {
      throw new AppError('PAYMENT_RECEIVER_INVALID');
    }
    return this.expenses.save({
      ...data,
      description,
      participantIds,
      responsibilityId: data.kind === 'expense' ? data.responsibilityId : null,
    });
  }

  remove(id: string) {
    return this.expenses.remove(id);
  }
}
