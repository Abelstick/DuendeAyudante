import { ArrowRight, Check, HandCoins, Pencil, Plus, Receipt, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants, canEditContent } from '@/modules/events/domain/Event';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { useResponsibilities } from '@/modules/responsibilities/presentation/hooks';
import { formatShortDateTime } from '@/shared/lib/datetime';
import { formatMoney } from '@/shared/lib/money';
import { whatsappShareUrl } from '@/shared/lib/whatsapp';
import { Button, buttonClasses, Spinner } from '@/shared/ui/Button';
import { CardTitle, EmptyState, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { toTitleCase } from '@/shared/validation/names';
import { canWriteExpense, computeBalances, settle, totalSpent, type Expense, type ExpenseKind, type Transfer } from '../domain/Expense';
import { useExpenses } from './hooks';
import { ExpenseFormModal } from './ExpenseFormModal';

type Editing = { initial: Expense | null; kind: ExpenseKind; preset?: { paidById: string; toId: string; amount: number } } | null;

/** Cuentas claras: quién puso cuánto y quién le paga a quién para quedar a mano. */
export function ExpensesSection() {
  const { event, context } = useEventScope();
  const expenses = useExpenses(event.id);
  const participants = useParticipants(event.id);
  const families = useFamilies(event.id);
  const responsibilities = useResponsibilities(event.id);
  const [editing, setEditing] = useState<Editing>(null);

  if (expenses.isLoading || participants.isLoading) return <Spinner label="Cargando…" />;
  if (expenses.error) return <Notice tone="error">{errorMessage(expenses.error)}</Notice>;

  const list = expenses.data ?? [];
  const people = participants.data ?? [];
  const isEditor = canEditContent(context.role);
  const acting = actingParticipants(context);
  const actingIds = acting.map((p) => p.id);
  const payerOptions = isEditor ? people : people.filter((p) => actingIds.includes(p.id));
  const money = (n: number) => formatMoney(n, event.currency);
  const nameOf = (id: string) => {
    const p = people.find((x) => x.id === id);
    return p ? displayName(p) : 'Alguien que ya no está';
  };
  const shortName = (id: string) => {
    const p = people.find((x) => x.id === id);
    return p ? toTitleCase(p.firstName) : '—';
  };

  const balances = computeBalances(list).sort((a, b) => b.net - a.net);
  const transfers = settle(balances);
  const spent = totalSpent(list);
  const canSettle = (t: Transfer) => isEditor || actingIds.includes(t.fromId) || actingIds.includes(t.toId);

  const shareText = [
    `🧾 Cuentas claras de «${event.name}»`,
    `Total gastado: ${money(spent)}`,
    '',
    transfers.length === 0 ? '¡Todos estamos a mano! 🎉' : 'Para quedar a mano:',
    ...transfers.map((t) => `• ${shortName(t.fromId)} le paga ${money(t.amount)} a ${shortName(t.toId)}`),
  ].join('\n');

  const canAdd = payerOptions.length > 0;

  return (
    <div className="space-y-6">
      <p className="text-base text-ink-700">
        Anota lo que cada uno pagó para la celebración y la app calcula quién le paga a quién para que todos pongan lo mismo.
      </p>

      {canAdd && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => setEditing({ initial: null, kind: 'expense' })} icon={<Plus className="size-5" aria-hidden />}>
            Anotar un gasto
          </Button>
          <Button variant="secondary" onClick={() => setEditing({ initial: null, kind: 'payment' })} icon={<HandCoins className="size-5" aria-hidden />}>
            Anotar un pago
          </Button>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState emoji="🧾" title="Todavía no hay gastos.">
          Por ejemplo: «Pavo, S/ 180, lo pagó Juan, entre todos».
        </EmptyState>
      ) : (
        <>
          <div className="rounded-2xl border-2 border-night-900 bg-gold-50 p-4 shadow-block">
            <p className="text-sm font-bold uppercase tracking-wide text-gold-700">Total gastado</p>
            <p className="text-3xl font-black tabular-nums text-ink-900">{money(spent)}</p>
          </div>

          <section className="space-y-3">
            <CardTitle icon={<HandCoins className="size-6" />} tone="gold">
              ¿Quién le paga a quién?
            </CardTitle>
            {transfers.length === 0 ? (
              <Notice tone="success">🎉 ¡Todos están a mano!</Notice>
            ) : (
              <ul className="space-y-2">
                {transfers.map((t) => (
                  <li key={`${t.fromId}-${t.toId}`} className="space-y-2 rounded-2xl border-2 border-mist-300 bg-white p-3">
                    <p className="flex flex-wrap items-center gap-x-2 text-base">
                      <strong>{nameOf(t.fromId)}</strong>
                      <ArrowRight className="size-5 shrink-0 text-ink-500" aria-label="le paga a" />
                      <strong>{nameOf(t.toId)}</strong>
                      <span className="ml-auto text-xl font-black tabular-nums text-berry-700">{money(t.amount)}</span>
                    </p>
                    {canSettle(t) && (
                      <Button
                        variant="secondary"
                        onClick={() => setEditing({ initial: null, kind: 'payment', preset: { paidById: t.fromId, toId: t.toId, amount: t.amount } })}
                        icon={<Check className="size-5" aria-hidden />}
                      >
                        Ya se pagó
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <a href={whatsappShareUrl(shareText)} target="_blank" rel="noopener noreferrer" className={buttonClasses('whatsapp', 'md')}>
              <Share2 className="size-5" aria-hidden />
              Compartir las cuentas
            </a>
          </section>

          <section className="space-y-3">
            <CardTitle icon={<Receipt className="size-6" />}>Cuánto puso cada uno</CardTitle>
            <ul className="divide-y-2 divide-mist-200 rounded-2xl border-2 border-mist-300 bg-white">
              {balances.map((b) => (
                <li key={b.participantId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-bold text-ink-900">{nameOf(b.participantId)}</span>
                    <span className="block text-sm text-ink-700">
                      Puso {money(b.paid)} · le toca {money(b.share)}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-bold ${
                      b.net > 0.004 ? 'bg-pine-100 text-pine-700' : b.net < -0.004 ? 'bg-berry-50 text-berry-700' : 'bg-mist-200 text-ink-700'
                    }`}
                  >
                    {b.net > 0.004 ? `Le deben ${money(b.net)}` : b.net < -0.004 ? `Debe ${money(-b.net)}` : 'A mano'}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <CardTitle icon={<Receipt className="size-6" />}>Gastos y pagos</CardTitle>
            <ul className="space-y-2">
              {list.map((e) => {
                const editable = canWriteExpense(e, { isEditor, actingIds });
                return (
                  <li key={e.id} className={`space-y-1 rounded-2xl border-2 p-3 ${e.kind === 'payment' ? 'border-pine-600/30 bg-pine-50' : 'border-mist-300 bg-white'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-bold text-ink-900">{e.kind === 'payment' ? '🤝 Pago' : `🧾 ${e.description}`}</p>
                      <p className="text-lg font-black tabular-nums">{money(e.amount)}</p>
                    </div>
                    <p className="text-sm text-ink-700">
                      {e.kind === 'payment'
                        ? `${nameOf(e.paidById)} le pagó a ${nameOf(e.participantIds[0] ?? '')}`
                        : `Pagó ${nameOf(e.paidById)} · entre ${e.participantIds.length} ${e.participantIds.length === 1 ? 'persona' : 'personas'}`}
                      {' · '}
                      {formatShortDateTime(e.createdAt, event.timezone)}
                    </p>
                    {editable && (
                      <Button variant="ghost" onClick={() => setEditing({ initial: e, kind: e.kind })} icon={<Pencil className="size-5" aria-hidden />}>
                        Cambiar
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {editing && (
        <ExpenseFormModal
          key={editing.initial?.id ?? `${editing.kind}-${editing.preset?.paidById ?? ''}-${editing.preset?.toId ?? ''}`}
          eventId={event.id}
          currency={event.currency}
          initial={editing.initial}
          kind={editing.kind}
          preset={editing.preset}
          participants={people}
          families={families.data ?? []}
          payerOptions={editingPayers(editing, payerOptions, people)}
          contributions={(responsibilities.data ?? []).filter((r) => r.kind === 'contribution')}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/**
 * Quién puede figurar como "quién pagó": las personas por las que actúa, o todas
 * si edita contenido. Al anotar un pago sugerido que recibe uno mismo, el que
 * paga es otra persona: se agrega a la lista.
 */
function editingPayers(editing: NonNullable<Editing>, payerOptions: Participant[], people: Participant[]): Participant[] {
  const extraId = editing.preset?.paidById ?? editing.initial?.paidById;
  if (!extraId || payerOptions.some((p) => p.id === extraId)) return payerOptions;
  const extra = people.find((p) => p.id === extraId);
  return extra ? [extra, ...payerOptions] : payerOptions;
}
