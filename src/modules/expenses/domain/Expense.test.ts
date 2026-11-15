import { describe, expect, it } from 'vitest';
import { canWriteExpense, computeBalances, settle, splitCents, totalSpent, type Expense } from './Expense';

const expense = (paidById: string, amount: number, participantIds: string[], kind: Expense['kind'] = 'expense'): Expense => ({
  id: `${paidById}-${amount}-${kind}`,
  eventId: 'e',
  kind,
  description: 'x',
  amount,
  paidById,
  participantIds,
  responsibilityId: null,
  createdAt: new Date(),
});

describe('cuentas claras', () => {
  it('divide en partes iguales y reparte los céntimos sobrantes sin perder ninguno', () => {
    const parts = splitCents(1000, ['c', 'a', 'b']);
    expect([...parts.values()].reduce((s, n) => s + n, 0)).toBe(1000);
    expect(parts.get('a')).toBe(334);
    expect(parts.get('b')).toBe(333);
  });

  it('calcula cuánto puso y cuánto le toca a cada uno', () => {
    const balances = computeBalances([expense('juan', 120, ['juan', 'rosa', 'ana']), expense('rosa', 30, ['rosa', 'ana'])]);
    const byId = Object.fromEntries(balances.map((b) => [b.participantId, b]));
    expect(byId.juan).toEqual({ participantId: 'juan', paid: 120, share: 40, net: 80 });
    expect(byId.rosa).toEqual({ participantId: 'rosa', paid: 30, share: 55, net: -25 });
    expect(byId.ana).toEqual({ participantId: 'ana', paid: 0, share: 55, net: -55 });
  });

  it('dice quién le paga a quién para quedar a mano', () => {
    const balances = computeBalances([expense('juan', 120, ['juan', 'rosa', 'ana']), expense('rosa', 30, ['rosa', 'ana'])]);
    expect(settle(balances)).toEqual([
      { fromId: 'ana', toId: 'juan', amount: 55 },
      { fromId: 'rosa', toId: 'juan', amount: 25 },
    ]);
  });

  it('un pago registrado salda la deuda', () => {
    const list = [expense('juan', 100, ['juan', 'rosa']), expense('rosa', 50, ['juan'], 'payment')];
    expect(settle(computeBalances(list))).toEqual([]);
    expect(totalSpent(list)).toBe(100);
  });

  it('funciona con céntimos sin errores de redondeo', () => {
    const balances = computeBalances([expense('a', 10, ['a', 'b', 'c'])]);
    const transfers = settle(balances);
    // "a" pagó 10 y su parte es 3.34 (le tocó el céntimo sobrante): los otros dos le deben 3.33 cada uno
    expect(transfers).toEqual([
      { fromId: 'b', toId: 'a', amount: 3.33 },
      { fromId: 'c', toId: 'a', amount: 3.33 },
    ]);
    expect(balances.reduce((s, b) => s + Math.round(b.net * 100), 0)).toBe(0);
  });

  it('cada quien escribe lo que pagó y los pagos que recibe; el editor, todo', () => {
    const own = { kind: 'expense' as const, paidById: 'rosa', participantIds: ['rosa', 'juan'] };
    expect(canWriteExpense(own, { isEditor: false, actingIds: ['rosa'] })).toBe(true);
    expect(canWriteExpense(own, { isEditor: false, actingIds: ['juan'] })).toBe(false);
    expect(canWriteExpense({ kind: 'payment', paidById: 'juan', participantIds: ['rosa'] }, { isEditor: false, actingIds: ['rosa'] })).toBe(true);
    expect(canWriteExpense(own, { isEditor: true, actingIds: [] })).toBe(true);
  });
});
