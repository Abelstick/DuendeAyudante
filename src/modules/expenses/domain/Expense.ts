/**
 * Cuentas claras: gastos compartidos y pagos para saldarlos.
 * Todo el cálculo se hace en céntimos (enteros) para no arrastrar decimales.
 */
export type ExpenseKind = 'expense' | 'payment';

export interface Expense {
  id: string;
  eventId: string;
  kind: ExpenseKind;
  description: string;
  amount: number;
  /** Quién puso la plata. */
  paidById: string;
  /** Gasto: entre quiénes se divide (partes iguales). Pago: quien lo recibe (una persona). */
  participantIds: string[];
  /** Aporte de la celebración al que corresponde (opcional). */
  responsibilityId: string | null;
  createdAt: Date;
}

export interface SaveExpenseData {
  id: string | null;
  eventId: string;
  kind: ExpenseKind;
  description: string;
  amount: number;
  paidById: string;
  participantIds: string[];
  responsibilityId: string | null;
}

export interface Balance {
  participantId: string;
  /** Lo que puso (gastos y pagos hechos). */
  paid: number;
  /** Lo que le toca (su parte de los gastos y pagos recibidos). */
  share: number;
  /** paid − share: positivo = le deben; negativo = debe. */
  net: number;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amount: number;
}

export const toCents = (amount: number) => Math.round(amount * 100);
const fromCents = (cents: number) => cents / 100;

/**
 * Parte de cada persona en céntimos. Si no se divide exacto, los céntimos
 * sobrantes van a los primeros de la lista (orden estable por id), así la
 * suma siempre da el total.
 */
export function splitCents(totalCents: number, participantIds: string[]): Map<string, number> {
  const ids = [...new Set(participantIds)].sort();
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const base = Math.floor(totalCents / ids.length);
  let remainder = totalCents - base * ids.length;
  for (const id of ids) {
    out.set(id, base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }
  return out;
}

/** Saldo de cada persona que aparece en algún gasto o pago. */
export function computeBalances(expenses: readonly Expense[]): Balance[] {
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  const add = (map: Map<string, number>, id: string, cents: number) => map.set(id, (map.get(id) ?? 0) + cents);

  for (const e of expenses) {
    const cents = toCents(e.amount);
    add(paid, e.paidById, cents);
    for (const [id, part] of splitCents(cents, e.participantIds)) add(share, id, part);
  }

  const ids = new Set([...paid.keys(), ...share.keys()]);
  return [...ids].map((participantId) => {
    const p = paid.get(participantId) ?? 0;
    const s = share.get(participantId) ?? 0;
    return { participantId, paid: fromCents(p), share: fromCents(s), net: fromCents(p - s) };
  });
}

/**
 * Quién le paga a quién, con la menor cantidad de pagos razonable:
 * el que más debe le paga al que más le deben, y así sucesivamente.
 */
export function settle(balances: readonly Balance[]): Transfer[] {
  const debtors = balances
    .map((b) => ({ id: b.participantId, cents: -toCents(b.net) }))
    .filter((b) => b.cents > 0)
    .sort((a, b) => b.cents - a.cents || a.id.localeCompare(b.id));
  const creditors = balances
    .map((b) => ({ id: b.participantId, cents: toCents(b.net) }))
    .filter((b) => b.cents > 0)
    .sort((a, b) => b.cents - a.cents || a.id.localeCompare(b.id));

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const cents = Math.min(debtor.cents, creditor.cents);
    if (cents > 0) transfers.push({ fromId: debtor.id, toId: creditor.id, amount: fromCents(cents) });
    debtor.cents -= cents;
    creditor.cents -= cents;
    if (debtor.cents === 0) i++;
    if (creditor.cents === 0) j++;
  }
  return transfers;
}

/** Total de lo gastado (sin contar los pagos entre personas). */
export function totalSpent(expenses: readonly Expense[]): number {
  return fromCents(expenses.filter((e) => e.kind === 'expense').reduce((sum, e) => sum + toCents(e.amount), 0));
}

/** ¿Puede escribir este gasto/pago? Igual que app.can_write_expense en la base de datos. */
export function canWriteExpense(
  e: Pick<Expense, 'kind' | 'paidById' | 'participantIds'>,
  opts: { isEditor: boolean; actingIds: readonly string[] },
): boolean {
  if (opts.isEditor) return true;
  if (opts.actingIds.includes(e.paidById)) return true;
  return e.kind === 'payment' && e.participantIds.some((id) => opts.actingIds.includes(id));
}
