import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useServices } from '@/app/ContainerContext';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { TextField } from '@/shared/ui/TextField';

interface Props {
  title: string;
  /** Explica para qué se pide la contraseña. */
  children: ReactNode;
  confirmLabel: string;
  onVerified: () => void;
  onClose: () => void;
}

/** Pide la contraseña de la cuenta antes de mostrar algo privado. No recuerda nada: se pide cada vez. */
export function PasswordGateModal({ title, children, confirmLabel, onVerified, onClose }: Props) {
  const { auth } = useServices();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formId = 'password-gate-form';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Escribe tu contraseña.');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      await auth.verifyPassword(password);
      onVerified();
    } catch (err) {
      setError(errorMessage(err));
      setChecking(false);
    }
  };

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" form={formId} size="lg" loading={checking} icon={<LockKeyhole className="size-6" aria-hidden />}>
            {confirmLabel}
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="text-base text-ink-700">{children}</div>
        <TextField
          label="Tu contraseña"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          autoCapitalize="none"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          trailing={
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-pressed={show}
              className="flex min-h-13 shrink-0 items-center gap-1.5 rounded-xl border-2 border-night-900 bg-white px-3 text-base font-bold text-night-900 hover:bg-brand-soft"
            >
              {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              {show ? 'Ocultar' : 'Ver'}
            </button>
          }
        />
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Modal>
  );
}
