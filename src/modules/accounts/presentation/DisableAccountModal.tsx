import { UserRoundX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '@/app/ContainerContext';
import { DISABLE_CONFIRMATION_WORD, isDisableConfirmed } from '@/shared/application/ports/IAuthService';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { TextField } from '@/shared/ui/TextField';
import { useToast } from '@/shared/ui/Toast';

/**
 * Inhabilitar mi cuenta: la persona deja de poder entrar, pero no se borra nada
 * (usuario, perfil, regalos y tareas siguen ahí). Quien organiza o administra
 * la celebración puede reactivarla desde Organizar.
 */
export function DisableAccountModal({ onClose }: { onClose: () => void }) {
  const { auth } = useServices();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, setConfirm] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = isDisableConfirmed(confirm);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setWorking(true);
    setError(null);
    try {
      await auth.disableAccount(confirm);
      toast.success('Tu cuenta quedó inhabilitada. Si quieres volver, pídele a quien organiza que la reactive. 🎄');
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setWorking(false);
    }
  };

  return (
    <Modal open title="Inhabilitar mi cuenta" onClose={working ? () => undefined : onClose}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="space-y-2 text-base text-ink-700">
          <p>
            Ya <strong className="text-ink-900">no podrás entrar</strong> a la aplicación con tu usuario, en ningún dispositivo.
          </p>
          <p>
            <strong className="text-ink-900">No se borra nada:</strong> tu nombre, tus regalos (con sus fotos) y tus tareas se quedan en la celebración.
          </p>
        </div>
        <Notice>Si más adelante quieres volver, pídele a quien organiza o administra tu celebración que reactive tu cuenta. Entrarás con el mismo usuario y contraseña.</Notice>

        <TextField
          label={`Para confirmar, escribe ${DISABLE_CONFIRMATION_WORD}`}
          autoComplete="off"
          autoCapitalize="characters"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="danger" size="lg" loading={working} disabled={!ready} icon={<UserRoundX className="size-6" aria-hidden />}>
            Inhabilitar mi cuenta
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={working}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
