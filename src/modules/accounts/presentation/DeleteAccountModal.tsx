import { useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '@/app/ContainerContext';
import type { OwnershipChoices } from '@/shared/application/ports/IAuthService';
import { Button, Spinner } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { TextField } from '@/shared/ui/TextField';
import { useToast } from '@/shared/ui/Toast';
import { DELETE_CONFIRMATION_WORD, DELETE_EVENT_CHOICE, eventsToDelete, isDeleteConfirmed, pendingOwnedEvents } from '../domain/AccountDeletion';

/**
 * Borrar mi cuenta. Se borra el acceso (usuario y contraseña); el perfil, los
 * regalos y las tareas quedan en la celebración, sin usuario. Quien organiza
 * primero pasa cada celebración a un administrador (o la borra) y confirma
 * con su contraseña.
 */
export function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { auth } = useServices();
  const navigate = useNavigate();
  const toast = useToast();
  const owned = useQuery({ queryKey: ['owned-events'], queryFn: () => auth.listOwnedEvents() });
  const [choices, setChoices] = useState<OwnershipChoices>({});
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownedList = owned.data ?? [];
  const isOrganizer = ownedList.length > 0;
  const pending = pendingOwnedEvents(ownedList, choices);
  const doomed = eventsToDelete(ownedList, choices);
  const ready = owned.isSuccess && pending.length === 0 && isDeleteConfirmed(confirm) && (!isOrganizer || password.length > 0);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setDeleting(true);
    setError(null);
    try {
      if (isOrganizer) await auth.verifyPassword(password);
      await auth.deleteAccount(confirm, choices);
      toast.success('Tu cuenta fue borrada. ¡Gracias por compartir esta Navidad! 🎄');
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <Modal open title="Borrar mi cuenta" onClose={deleting ? () => undefined : onClose}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="space-y-2 text-base text-ink-700">
          <p>
            Se borrarán <strong className="text-ink-900">tu usuario y tu contraseña</strong>, y ya no podrás entrar a la aplicación.
          </p>
          <p>
            Tu nombre, tus regalos (con sus fotos) y tus tareas <strong className="text-ink-900">se quedan en la celebración</strong>, como alguien sin usuario.
            Si quieres que también los quiten, pídeselo a quien organiza.
          </p>
        </div>

        {owned.isLoading && <Spinner label="Revisando tus celebraciones…" />}
        {owned.error && <Notice tone="error">{errorMessage(owned.error)}</Notice>}

        {isOrganizer && (
          <div className="space-y-4">
            <Notice tone="warning">Organizas {ownedList.length === 1 ? 'una celebración' : `${ownedList.length} celebraciones`}. Antes de irte, decide quién queda a cargo.</Notice>
            {ownedList.map((ev) => (
              <fieldset key={ev.eventId} className="space-y-2 rounded-xl border-2 border-night-900 p-4">
                <legend className="px-1 text-lg font-extrabold text-ink-900">{ev.eventName}</legend>
                {ev.successors.map((s) => (
                  <label key={s.userId} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-brand-soft">
                    <input
                      type="radio"
                      name={`owner-${ev.eventId}`}
                      checked={choices[ev.eventId] === s.userId}
                      onChange={() => setChoices((c) => ({ ...c, [ev.eventId]: s.userId }))}
                      className="size-5 accent-brand"
                    />
                    <span className="text-base">
                      Pasársela a <strong>{s.name}</strong> (administrador)
                    </span>
                  </label>
                ))}
                {ev.successors.length === 0 && (
                  <p className="text-sm text-ink-700">No tiene administradores. Si prefieres pasársela a alguien, primero nómbralo administrador en Organizar.</p>
                )}
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-berry-50">
                  <input
                    type="radio"
                    name={`owner-${ev.eventId}`}
                    checked={choices[ev.eventId] === DELETE_EVENT_CHOICE}
                    onChange={() => setChoices((c) => ({ ...c, [ev.eventId]: DELETE_EVENT_CHOICE }))}
                    className="size-5 accent-berry-600"
                  />
                  <span className="text-base font-semibold text-berry-700">Borrar esta celebración y todo lo que tiene</span>
                </label>
              </fieldset>
            ))}
            {doomed.length > 0 && (
              <Notice tone="error">
                Se borrará{doomed.length === 1 ? '' : 'n'} para todos: {doomed.map((d) => `«${d.eventName}»`).join(', ')}, con sus familias, regalos, fotos, tareas y juegos. No
                se puede deshacer.
              </Notice>
            )}
            <TextField
              label="Tu contraseña"
              type="password"
              autoComplete="current-password"
              hint="Por seguridad, quien organiza confirma con su contraseña."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}

        {owned.isSuccess && (
          <TextField
            label={`Para confirmar, escribe ${DELETE_CONFIRMATION_WORD}`}
            autoComplete="off"
            autoCapitalize="characters"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}

        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="danger" size="lg" loading={deleting} disabled={!ready} icon={<Trash2 className="size-6" aria-hidden />}>
            Borrar mi cuenta
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
