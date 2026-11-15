import { Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { FAMILY_COLORS, type Family } from '@/modules/families/domain/Family';
import { displayName, type Participant } from '@/modules/members/domain/Participant';
import type { Responsibility } from '@/modules/responsibilities/domain/Responsibility';
import { formatMoney, parseMoney } from '@/shared/lib/money';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { selectClasses } from '@/shared/ui/Tabs';
import { useToast } from '@/shared/ui/Toast';
import { TextField } from '@/shared/ui/TextField';
import { splitCents, toCents, type Expense, type ExpenseKind } from '../domain/Expense';
import { useExpenseMutations } from './hooks';

interface Props {
  eventId: string;
  currency: string;
  initial: Expense | null;
  kind: ExpenseKind;
  /** Para un pago sugerido ("Ya se pagó"): quién paga, a quién y cuánto. */
  preset?: { paidById: string; toId: string; amount: number };
  participants: Participant[];
  families: Family[];
  /** Personas a nombre de las que puede registrar lo que pagaron (todas si edita contenido). */
  payerOptions: Participant[];
  contributions: Responsibility[];
  onClose: () => void;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function ExpenseFormModal({ eventId, currency, initial, kind: initialKind, preset, participants, families, payerOptions, contributions, onClose }: Props) {
  const { save, remove } = useExpenseMutations(eventId);
  const toast = useToast();
  const kind = initial?.kind ?? initialKind;
  const isPayment = kind === 'payment';
  const [description, setDescription] = useState(initial?.description ?? (isPayment ? 'Pago para quedar a mano' : ''));
  const [amount, setAmount] = useState(initial ? String(initial.amount) : preset ? preset.amount.toFixed(2) : '');
  const [paidById, setPaidById] = useState(initial?.paidById ?? preset?.paidById ?? payerOptions[0]?.id ?? '');
  const [shareIds, setShareIds] = useState<string[]>(
    initial?.participantIds ?? (preset ? [preset.toId] : isPayment ? [] : participants.map((p) => p.id)),
  );
  const [responsibilityId, setResponsibilityId] = useState(initial?.responsibilityId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const value = parseMoney(amount);
  const validAmount = value !== null && !Number.isNaN(value) && value > 0;
  const perPerson = validAmount && !isPayment && shareIds.length > 0 ? Math.max(...splitCents(toCents(value), shareIds).values()) / 100 : null;
  const money = (n: number) => formatMoney(n, currency);
  const payer = participants.find((p) => p.id === paidById);

  const familyMembers = (f: Family) => participants.filter((p) => p.familyId === f.id).map((p) => p.id);
  const familyOn = (f: Family) => {
    const ids = familyMembers(f);
    return ids.length > 0 && ids.every((id) => shareIds.includes(id));
  };
  const toggleFamily = (f: Family) => {
    const ids = familyMembers(f);
    setShareIds((prev) => (familyOn(f) ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
  };

  const submit = async () => {
    setError(null);
    if (!validAmount) {
      setError('Escribe el monto solo con números (ej. 45 o 45.50).');
      return;
    }
    try {
      await save.mutateAsync({
        id: initial?.id ?? null,
        eventId,
        kind,
        description,
        amount: value,
        paidById,
        participantIds: shareIds,
        responsibilityId: responsibilityId || null,
      });
      toast.success(isPayment ? '¡Pago anotado! Las cuentas ya están al día.' : initial ? 'Gasto actualizado.' : '¡Gasto anotado!');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    try {
      await remove.mutateAsync(initial.id);
      toast.success(isPayment ? 'Pago quitado.' : 'Gasto quitado.');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const title = isPayment ? (initial ? 'Cambiar pago' : 'Anotar un pago') : initial ? 'Cambiar gasto' : 'Anotar un gasto';

  return (
    <Modal
      open
      title={title}
      onClose={save.isPending ? () => undefined : onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" loading={save.isPending} onClick={submit} icon={initial ? <Save className="size-6" aria-hidden /> : <Plus className="size-6" aria-hidden />}>
            {initial ? 'Guardar cambios' : isPayment ? 'Anotar pago' : 'Anotar gasto'}
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {!isPayment && (
          <TextField label="¿En qué se gastó?" placeholder="ej. Pavo, Bebidas, Decoración" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} autoFocus />
        )}
        <TextField
          label={`Monto (${currency === 'PEN' ? 'S/' : currency})`}
          inputMode="decimal"
          placeholder="ej. 120"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus={isPayment}
        />

        <label className="flex flex-col gap-1.5 text-base font-semibold">
          {isPayment ? '¿Quién pagó?' : '¿Quién lo pagó?'}
          <select value={paidById} onChange={(e) => setPaidById(e.target.value)} className={selectClasses}>
            {payerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {displayName(p)}
              </option>
            ))}
          </select>
        </label>

        {isPayment ? (
          <label className="flex flex-col gap-1.5 text-base font-semibold">
            ¿A quién le pagó?
            <select value={shareIds[0] ?? ''} onChange={(e) => setShareIds(e.target.value ? [e.target.value] : [])} className={selectClasses}>
              <option value="">Elige a una persona…</option>
              {participants
                .filter((p) => p.id !== paidById)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayName(p)}
                  </option>
                ))}
            </select>
          </label>
        ) : (
          <fieldset className="space-y-3">
            <legend className="text-base font-semibold">¿Entre quiénes se divide?</legend>
            <p className="text-sm text-ink-700">En partes iguales. Toca una familia para marcarla o desmarcarla completa.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShareIds(shareIds.length === participants.length ? [] : participants.map((p) => p.id))}
                className="min-h-12 rounded-full border-2 border-night-900 bg-white px-4 text-base font-semibold"
              >
                {shareIds.length === participants.length ? 'Quitar a todos' : 'Todos'}
              </button>
              {families.map((f) => {
                const on = familyOn(f);
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleFamily(f)}
                    className={`min-h-12 rounded-full border-2 px-4 text-base font-semibold ${on ? 'border-ink-900 ring-2 ring-gold-400' : 'border-mist-200'}`}
                    style={{ backgroundColor: FAMILY_COLORS[f.color].soft, color: FAMILY_COLORS[f.color].text }}
                  >
                    {on ? '✓ ' : ''}Familia {f.name}
                  </button>
                );
              })}
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl">
              {participants.map((p) => (
                <label key={p.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-mist-300 bg-white px-3">
                  <input type="checkbox" className="size-5 accent-brand" checked={shareIds.includes(p.id)} onChange={() => setShareIds((ids) => toggle(ids, p.id))} />
                  <span className="text-base">{displayName(p)}</span>
                </label>
              ))}
            </div>
            {perPerson !== null && (
              <p className="text-base font-semibold text-ink-900">
                A cada uno le toca {money(perPerson)} ({shareIds.length} {shareIds.length === 1 ? 'persona' : 'personas'}).
              </p>
            )}
          </fieldset>
        )}

        {!isPayment && contributions.length > 0 && (
          <label className="flex flex-col gap-1.5 text-base font-semibold">
            ¿Es de un aporte? <span className="text-sm font-normal text-ink-700">(opcional)</span>
            <select value={responsibilityId} onChange={(e) => setResponsibilityId(e.target.value)} className={selectClasses}>
              <option value="">No</option>
              {contributions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {isPayment && payer && shareIds[0] && validAmount && (
          <Notice>
            {displayName(payer)} le pagó {money(value)} a {displayName(participants.find((p) => p.id === shareIds[0]) ?? payer)}.
          </Notice>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        {initial && (
          <div className="border-t border-mist-200 pt-4">
            {confirmingDelete ? (
              <div className="space-y-2 rounded-xl bg-berry-50 p-3" role="alert">
                <p className="font-semibold text-berry-700">¿Quitar {isPayment ? 'este pago' : 'este gasto'}? Las cuentas se recalculan.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="danger" loading={remove.isPending} onClick={onDelete}>
                    Sí, quitar
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                    No
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmingDelete(true)} icon={<Trash2 className="size-5" aria-hidden />} className="text-berry-700! hover:bg-berry-50!">
                Quitar {isPayment ? 'este pago' : 'este gasto'}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
