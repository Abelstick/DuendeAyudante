import { CheckCircle2, HardDrive, Link2Off, RefreshCw, TriangleAlert, Users } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Family } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import type { DriveConnection, DriveTarget } from '@/modules/family-drive/domain/FamilyDrive';
import { useEventDrive, useFamilyDriveMutations, useFamilyDrives } from '@/modules/family-drive/presentation/hooks';
import { Button, Spinner } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';

interface Props {
  eventId: string;
  families: Family[];
}

/** Resultado que trae la URL al volver de Google (?drive=…). */
const RETURN_MESSAGES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  conectado: { tone: 'success', text: '¡Google Drive conectado! Ya pueden subir fotos a sus regalos.' },
  cancelado: { tone: 'error', text: 'No se conectó: se canceló en Google. Puedes intentarlo otra vez.' },
  'sin-permiso': { tone: 'error', text: 'No se conectó: hay que marcar el permiso de Google Drive. Inténtalo otra vez y deja marcada esa casilla.' },
  error: { tone: 'error', text: 'No pudimos conectar Google Drive. Vuelve a intentarlo en un momento.' },
};

const keyOf = (t: DriveTarget) => ('familyId' in t ? `f:${t.familyId}` : `e:${t.eventId}`);

/**
 * Organizar → Fotos de los regalos. Se puede conectar una sola cuenta de Google
 * para todas las familias y, si alguna familia quiere, una cuenta propia que
 * reemplaza a la general solo para ella.
 */
export function FamilyDrivesManager({ eventId, families }: Props) {
  const familyDrives = useFamilyDrives(eventId);
  const eventDrive = useEventDrive(eventId);
  const { connect, disconnect } = useFamilyDriveMutations(eventId);
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [confirming, setConfirming] = useState<string | null>(null);

  // Al volver de Google: avisar el resultado una vez y limpiar la URL
  const result = params.get('drive');
  useEffect(() => {
    if (!result) return;
    const msg = RETURN_MESSAGES[result] ?? RETURN_MESSAGES.error!;
    if (msg.tone === 'success') toast.success(msg.text);
    else toast.error(msg.text);
    const next = new URLSearchParams(params);
    next.delete('drive');
    setParams(next, { replace: true, preventScrollReset: true });
    void familyDrives.refetch();
    void eventDrive.refetch();
  }, [result]); // solo cuando llega un resultado nuevo

  if (familyDrives.isLoading || eventDrive.isLoading) return <Spinner label="Cargando…" />;
  const loadError = familyDrives.error ?? eventDrive.error;
  if (loadError) return <Notice tone="error">{errorMessage(loadError)}</Notice>;

  const general = eventDrive.data ?? null;

  const onConnect = async (target: DriveTarget) => {
    try {
      await connect.mutateAsync(target); // sale de la app hacia Google
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onDisconnect = async (target: DriveTarget) => {
    try {
      await disconnect.mutateAsync(target);
      toast.success('Desconectado. Las fotos ya subidas siguen en ese Drive y se siguen viendo.');
      setConfirming(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const slot = (target: DriveTarget, connection: DriveConnection | null, emptyText: string, disconnectText: string) => {
    const key = keyOf(target);
    return (
      <DriveSlot
        connection={connection}
        emptyText={emptyText}
        disconnectText={disconnectText}
        connecting={connect.isPending && connect.variables !== undefined && keyOf(connect.variables) === key}
        confirming={confirming === key}
        disconnecting={disconnect.isPending}
        onConnect={() => onConnect(target)}
        onAskDisconnect={() => setConfirming(key)}
        onCancelDisconnect={() => setConfirming(null)}
        onDisconnect={() => onDisconnect(target)}
      />
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-base text-ink-700">
        Para que cada uno pueda poner fotos en sus ideas de regalo, conecta una cuenta de Google. Las fotos se guardan en una carpeta nueva de ese Google Drive.
      </p>
      <ul className="space-y-1 rounded-xl bg-sky-100 px-4 py-3 text-sm text-night-800">
        <li>🔒 La app solo puede ver los archivos que ella misma crea, nunca el resto del Drive.</li>
        <li>👀 Las fotos se ven en la app y quedan como «cualquiera con el enlace puede ver».</li>
        <li>📦 Ocupan espacio de esa cuenta de Google (cada foto pesa menos de 1 MB).</li>
      </ul>

      {/* Una sola cuenta para todos */}
      <section className="space-y-3 rounded-xl border-2 border-night-900 bg-gold-50 p-4 shadow-block" aria-labelledby="drive-general-title">
        <h3 id="drive-general-title" className="flex items-center gap-2 text-lg font-extrabold text-ink-900">
          <Users className="size-5 shrink-0" aria-hidden /> Una sola cuenta para todas las familias
        </h3>
        <p className="text-sm text-ink-700">La forma más simple: todas las fotos van a este Drive, también las de quienes no tienen familia.</p>
        {slot(
          { eventId },
          general,
          'Sin cuenta general.',
          '¿Desconectar la cuenta general? Las familias sin cuenta propia no podrán subir fotos nuevas. Las ya subidas se siguen viendo.',
        )}
      </section>

      {/* Cuenta propia por familia (opcional) */}
      {families.length > 0 && (
        <section className="space-y-3" aria-labelledby="drive-families-title">
          <div>
            <h3 id="drive-families-title" className="text-lg font-extrabold text-ink-900">
              Una cuenta por familia <span className="text-base font-semibold text-ink-500">(opcional)</span>
            </h3>
            <p className="text-sm text-ink-700">
              Si una familia conecta su propia cuenta, sus fotos van ahí en vez de a la general. Si no, usan la general.
            </p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {families.map((f) => {
              const own = familyDrives.data?.find((d) => d.familyId === f.id) ?? null;
              return (
                <li key={f.id} className="space-y-3 rounded-xl border-2 border-night-900 bg-white p-4 shadow-block">
                  <FamilyBadge family={f} />
                  {slot(
                    { familyId: f.id },
                    own,
                    general && !general.needsReconnect ? 'Usa la cuenta general.' : 'Sin cuenta: todavía no pueden subir fotos.',
                    general
                      ? '¿Desconectar la cuenta de esta familia? Sus fotos nuevas irán a la cuenta general. Las ya subidas se siguen viendo.'
                      : '¿Desconectar este Drive? No podrán subir fotos nuevas hasta conectar otro. Las ya subidas se siguen viendo.',
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

interface SlotProps {
  connection: DriveConnection | null;
  emptyText: string;
  disconnectText: string;
  connecting: boolean;
  confirming: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onAskDisconnect: () => void;
  onCancelDisconnect: () => void;
  onDisconnect: () => void;
}

/** Estado de un Drive (general o de una familia) con sus botones. */
function DriveSlot({ connection, emptyText, disconnectText, connecting, confirming, disconnecting, onConnect, onAskDisconnect, onCancelDisconnect, onDisconnect }: SlotProps) {
  let status: ReactNode;
  if (!connection) {
    status = (
      <p className="flex items-center gap-2 text-base text-ink-700">
        <HardDrive className="size-5 shrink-0" aria-hidden /> {emptyText}
      </p>
    );
  } else if (connection.needsReconnect) {
    status = (
      <p className="flex items-start gap-2 text-base font-semibold text-berry-700">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden /> {connection.googleEmail} perdió el acceso. Vuelve a conectarlo.
      </p>
    );
  } else {
    status = (
      <p className="flex items-start gap-2 text-base text-ink-900">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-pine-600" aria-hidden />
        <span className="min-w-0 wrap-break-word">
          Conectado a <strong>{connection.googleEmail}</strong>
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {status}
      {confirming ? (
        <div className="space-y-2 rounded-xl bg-berry-50 p-3" role="alert">
          <p className="font-semibold text-berry-700">{disconnectText}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="danger" loading={disconnecting} onClick={onDisconnect}>
              Sí, desconectar
            </Button>
            <Button variant="secondary" onClick={onCancelDisconnect}>
              No
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={connection && !connection.needsReconnect ? 'secondary' : 'primary'}
            loading={connecting}
            onClick={onConnect}
            icon={connection ? <RefreshCw className="size-5" aria-hidden /> : <HardDrive className="size-5" aria-hidden />}
          >
            {!connection ? 'Conectar Google Drive' : connection.needsReconnect ? 'Volver a conectar' : 'Cambiar de cuenta'}
          </Button>
          {connection && (
            <Button variant="ghost" onClick={onAskDisconnect} icon={<Link2Off className="size-5" aria-hidden />}>
              Desconectar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
