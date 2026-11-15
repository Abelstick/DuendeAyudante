import { Copy, MessageCircle } from 'lucide-react';
import { useEventScope } from '@/app/layout/EventLayout';
import { useAccessMessage } from '@/modules/members/presentation/hooks';
import { whatsappShareUrl } from '@/shared/lib/whatsapp';
import { Button, buttonClasses } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { toTitleCase } from '@/shared/validation/names';

interface Props {
  firstName: string;
  username: string;
  password: string | null;
  onClose?: () => void;
}

/** Muestra el acceso de un familiar y lo envía por WhatsApp. */
export function AccessCard({ firstName, username, password, onClose }: Props) {
  const { event } = useEventScope();
  const buildMessage = useAccessMessage();
  const toast = useToast();
  const message = buildMessage({
    firstName: toTitleCase(firstName),
    eventName: event.name,
    joinCode: event.joinCode,
    appUrl: window.location.origin,
    username,
    password,
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success('Mensaje copiado. Pégalo en WhatsApp.');
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.');
    }
  };

  return (
    <div className="animate-pop-in space-y-4 rounded-3xl border-2 border-brand bg-brand-soft p-5">
      <div className="space-y-1 text-lg">
        <p>
          🏠 Código: <strong className="select-all tracking-wider">{event.joinCode}</strong>
        </p>
        <p>
          👤 Usuario: <strong className="select-all">{username}</strong>
        </p>
        {password && (
          <p>
            🔑 Contraseña: <strong className="select-all">{password}</strong>
          </p>
        )}
      </div>
      {password && (
        <p className="text-base text-ink-700">
          Guarda o envía esta contraseña ahora: por seguridad no la volveremos a mostrar. Si se pierde, puedes crear una nueva.
        </p>
      )}
      <pre className="whitespace-pre-wrap rounded-2xl bg-white p-4 font-sans text-base text-ink-900">{message}</pre>
      <a href={whatsappShareUrl(message)} target="_blank" rel="noopener noreferrer" className={buttonClasses('whatsapp', 'lg')}>
        <MessageCircle className="size-6" aria-hidden />
        <span>Enviar por WhatsApp</span>
      </a>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" onClick={copy} icon={<Copy className="size-5" aria-hidden />}>
          Copiar mensaje
        </Button>
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </div>
    </div>
  );
}
