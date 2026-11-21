import { Pencil, Save, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { useUpdateBudget } from '@/modules/events/presentation/hooks';
import { formatMoney, parseMoney } from '@/shared/lib/money';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';
import { TextField } from '@/shared/ui/TextField';

/** Muestra el monto acordado del intercambio y permite corregirlo. */
export function BudgetEditor({ budget, onEditingChange }: { budget: number; onEditingChange?: (editing: boolean) => void }) {
  const { event } = useEventScope();
  const update = useUpdateBudget(event.id);
  const toast = useToast();
  const [editing, setEditingState] = useState(false);
  const setEditing = (next: boolean) => {
    setEditingState(next);
    onEditingChange?.(next);
  };
  const [value, setValue] = useState(String(budget));
  const [error, setError] = useState<string | null>(null);

  const amount = parseMoney(value);
  const valid = amount !== null && Number.isFinite(amount) && amount > 0;

  const save = async () => {
    setError(null);
    if (!valid) {
      setError('Escribe el monto solo con números (ej. 65).');
      return;
    }
    try {
      await update.mutateAsync(amount);
      toast.success(`¡Listo! El monto acordado ahora es ${formatMoney(amount, event.currency)}.`);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 h-full rounded-2xl bg-surface px-4 py-3 text-base">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Wallet className="size-5 shrink-0 text-night-ink" aria-hidden />
          <span>
            Monto acordado: <strong>{formatMoney(budget, event.currency)}</strong>
          </span>
        </span>
        <Button
          variant="ghost"
          onClick={() => {
            setValue(String(budget));
            setError(null);
            setEditing(true);
          }}
          icon={<Pencil className="size-5" aria-hidden />}
        >
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-pop-in space-y-3 rounded-2xl border-2 border-gold-400 bg-surface p-4">
      <TextField
        label={`Monto acordado del intercambio (${event.currency === 'PEN' ? 'S/' : event.currency})`}
        hint="Monto máximo para cada regalo del amigo secreto."
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
        }}
        error={error ?? undefined}
        autoFocus
      />
      <Notice>Todos verán el nuevo monto en Inicio, Regalos y Amigo secreto.</Notice>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={save} loading={update.isPending} disabled={amount === budget} icon={<Save className="size-5" aria-hidden />}>
          Guardar monto
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
