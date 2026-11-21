import { CalendarPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { instantToZonedParts } from '@/shared/lib/datetime';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { TextField } from '@/shared/ui/TextField';
import { nextYearJoinCode, nextYearName, type ChristmasEvent } from '../domain/Event';
import { useDuplicateEvent } from './hooks';

interface Props {
  event: ChristmasEvent;
  onClose: () => void;
}

/** El mismo día y hora, un año después ("2026-12-24" → "2027-12-24"). */
function sameDayNextYear(date: string): string {
  const [y, m, d] = date.split('-');
  // El 29 de febrero no existe el año siguiente: queda el 28
  return `${Number(y) + 1}-${m}-${m === '02' && d === '29' ? '28' : d}`;
}

const OPTIONS = [
  { key: 'copyMembers', label: 'Familias e integrantes', hint: 'Con sus mismos usuarios, roles y personas a cargo.' },
  { key: 'copyChecklist', label: 'Checklist de preparación', hint: 'Las tareas extra que creaste.' },
  { key: 'copyResponsibilities', label: 'Aportes y tareas', hint: 'Vuelven a quedar pendientes, con los mismos responsables.' },
  { key: 'copySchedule', label: 'Cronograma', hint: 'Con las mismas horas, en la nueva fecha.' },
] as const;
type OptionKey = (typeof OPTIONS)[number]['key'];

/** Crear la Navidad del próximo año copiando lo que sirve de esta. */
export function DuplicateEventModal({ event, onClose }: Props) {
  const duplicate = useDuplicateEvent();
  const navigate = useNavigate();
  const toast = useToast();
  const parts = instantToZonedParts(event.celebrationAt, event.timezone);
  const nextYear = Number(parts.date.slice(0, 4)) + 1;
  const [name, setName] = useState(() => nextYearName(event.name, nextYear));
  const [joinCode, setJoinCode] = useState(() => nextYearJoinCode(event.joinCode, nextYear));
  const [date, setDate] = useState(() => sameDayNextYear(parts.date));
  const [time, setTime] = useState(parts.time);
  const [copy, setCopy] = useState<Record<OptionKey, boolean>>({ copyMembers: true, copyChecklist: true, copyResponsibilities: false, copySchedule: false });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const id = await duplicate.mutateAsync({ sourceEventId: event.id, name, joinCode, date, time, timezone: event.timezone, ...copy });
      toast.celebrate(`¡Listo! Ya está creada «${name.trim()}». 🎄`);
      onClose();
      navigate(`/e/${id}/organizar`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open
      title="Crear la Navidad del próximo año"
      onClose={duplicate.isPending ? () => undefined : onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" loading={duplicate.isPending} onClick={submit} icon={<CalendarPlus className="size-6" aria-hidden />}>
            Crear Navidad
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={duplicate.isPending}>
            Cancelar
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-base text-ink-700">
          Empieza el año que viene sin cargar todo de nuevo. Esta Navidad no cambia: queda guardada con sus recuerdos.
        </p>
        <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <TextField
          label="Código para entrar"
          hint="Entre 4 y 20 letras o números. Tiene que ser distinto al de esta Navidad."
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          maxLength={20}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="Hora" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-base font-bold text-ink-900">¿Qué copiamos?</legend>
          {OPTIONS.map((o) => {
            const disabled = o.key === 'copyResponsibilities' && !copy.copyMembers;
            return (
              <label key={o.key} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border-2 border-mist-300 bg-surface p-3 ${disabled ? 'opacity-60' : ''}`}>
                <input
                  type="checkbox"
                  className="mt-1 size-5 accent-brand"
                  checked={copy[o.key] && !disabled}
                  disabled={disabled}
                  onChange={(e) => setCopy((c) => ({ ...c, [o.key]: e.target.checked }))}
                />
                <span>
                  <span className="block text-base font-semibold">{o.label}</span>
                  <span className="block text-sm text-ink-700">{disabled ? 'Necesita copiar también a las familias e integrantes.' : o.hint}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <Notice>
          No se copian regalos, juegos, anuncios, cuentas ni mensajes. Los <strong>enlaces de cada familia</strong> y el <strong>Google Drive</strong> se
          configuran de nuevo en Organizar. Tus familiares entran con su mismo usuario y contraseña (y el código de antes) o con el nuevo enlace de su
          familia.
        </Notice>

        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Modal>
  );
}
