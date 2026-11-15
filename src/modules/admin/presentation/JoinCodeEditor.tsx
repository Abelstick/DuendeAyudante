import { Pencil, Save } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { useChangeJoinCode, useJoinCodeChecker } from '@/modules/events/presentation/hooks';
import { AppError } from '@/shared/domain/errors';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';
import { TextField } from '@/shared/ui/TextField';
import { JOIN_CODE_PATTERN, normalizeJoinCode } from '@/shared/validation/names';

/** Muestra el código de la Navidad y permite cambiarlo por una palabra más fácil. */
export function JoinCodeEditor() {
  const { event } = useEventScope();
  const change = useChangeJoinCode(event.id);
  const checkCode = useJoinCodeChecker();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(event.joinCode);
  const [status, setStatus] = useState<'unknown' | 'checking' | 'free' | 'taken'>('unknown');
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeJoinCode(value);
  const valid = JOIN_CODE_PATTERN.test(normalized);

  const verify = async () => {
    if (!valid || normalized === event.joinCode) return;
    setValue(normalized);
    setStatus('checking');
    try {
      setStatus((await checkCode(normalized)) ? 'free' : 'taken');
    } catch {
      setStatus('unknown');
    }
  };

  const save = async () => {
    setError(null);
    if (!valid) {
      setError(errorMessage(new AppError('JOIN_CODE_INVALID')));
      return;
    }
    try {
      const saved = await change.mutateAsync(normalized);
      toast.success(`¡Listo! El nuevo código es ${saved}.`);
      setEditing(false);
      setStatus('unknown');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!editing) {
    return (
      <div className="space-y-2">
        <p className="text-lg">
          🏠 Código de tu Navidad: <strong className="select-all tracking-wider text-brand">{event.joinCode}</strong>
        </p>
        <p className="text-sm text-ink-700">Tus familiares lo usan para entrar. Ya va incluido en cada mensaje de WhatsApp.</p>
        <Button
          variant="ghost"
          onClick={() => {
            setValue(event.joinCode);
            setEditing(true);
          }}
          icon={<Pencil className="size-5" aria-hidden />}
        >
          Cambiar el código
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-pop-in space-y-3 rounded-2xl border-2 border-gold-400 bg-gold-100/50 p-4">
      <TextField
        label="Nuevo código"
        hint="Una palabra sencilla, sin espacios (ej. GARCIA, NAVIDAD2026)."
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus('unknown');
        }}
        onBlur={verify}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="uppercase tracking-wider"
      />
      {status === 'checking' && <p className="text-base text-ink-700">Revisando si está libre…</p>}
      {status === 'free' && <p className="text-base font-semibold text-brand">✅ ¡Ese código está libre!</p>}
      {status === 'taken' && <p className="text-base font-semibold text-berry-700">⚠️ Ese código ya lo usa otra Navidad. Prueba con otro.</p>}
      <Notice>
        Las personas que ya entraron no tienen que hacer nada. Los mensajes que ya enviaste siguen funcionando con el código anterior.
      </Notice>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={save} loading={change.isPending} disabled={normalized === event.joinCode} icon={<Save className="size-5" aria-hidden />}>
          Guardar nuevo código
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(false);
            setError(null);
            setStatus('unknown');
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
