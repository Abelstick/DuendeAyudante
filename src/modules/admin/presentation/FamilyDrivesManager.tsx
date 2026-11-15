import { CheckCircle2, HardDrive, Link2Off, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Family } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilyDriveMutations, useFamilyDrives } from '@/modules/family-drive/presentation/hooks';
import { Button, Spinner } from '@/shared/ui/Button';
import { EmptyState, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';

interface Props {
  eventId: string;
  families: Family[];
}

/** Resultado que trae la URL al volver de Google (?drive=â€¦). */
const RETURN_MESSAGES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  conectado: { tone: 'success', text: 'Â¡Google Drive conectado! Ya pueden subir fotos a sus regalos.' },
  cancelado: { tone: 'error', text: 'No se conectÃ³: se cancelÃ³ en Google. Puedes intentarlo otra vez.' },
  'sin-permiso': { tone: 'error', text: 'No se conectÃ³: hay que marcar el permiso de Google Drive. IntÃ©ntalo otra vez y deja marcada esa casilla.' },
  error: { tone: 'error', text: 'No pudimos conectar Google Drive. Vuelve a intentarlo en un momento.' },
};

/**
 * Organizar â†’ Fotos de los regalos: cada familia guarda sus fotos en un Google
 * Drive. Lo conecta el organizador o un administrador (con la cuenta que elija).
 */
export function FamilyDrivesManager({ eventId, families }: Props) {
  const drives = useFamilyDrives(eventId);
  const { connect, disconnect } = useFamilyDriveMutations(eventId);
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Al volver de Google: avisar el resultado una vez y limpiar la URL
  const result = params.get('drive');
  useEffect(() => {
    if (!result) return;
    const msg = RETURN_MESSAGES[result] ?? RETURN_MESSAGES.error!;
    if (msg.tone === 'success') toast.success(msg.text);
    else toast.error(msg.text);
    const next = new URLSearchParams(params);
    next.delete('drive');
    setParams(next, { replace: true });
    void drives.refetch();
  }, [result]); // solo cuando llega un resultado nuevo

  const onConnect = async (familyId: string) => {
    try {
      await connect.mutateAsync(familyId); // sale de la app hacia Google
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onDisconnect = async (familyId: string) => {
    try {
      await disconnect.mutateAsync(familyId);
      toast.success('Desconectado. Las fotos ya subidas siguen en ese Drive y se siguen viendo.');
      setConfirmingId(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (families.length === 0) return <EmptyState emoji="ðŸ“·" title="Primero crea las familias." />;
  if (drives.isLoading) return <Spinner label="Cargandoâ€¦" />;
  if (drives.error) return <Notice tone="error">{errorMessage(drives.error)}</Notice>;

  return (
    <div className="space-y-3">
      <p className="text-base text-ink-700">
        Para que cada uno pueda poner fotos en sus ideas de regalo, conecta una cuenta de Google por familia. Las fotos se guardan en una carpeta nueva de ese
        Google Drive.
      </p>
      <ul className="space-y-1 rounded-xl bg-sky-100 px-4 py-3 text-sm text-night-800">
        <li>ðŸ”’ La app solo puede ver los archivos que ella misma crea, nunca el resto del Drive.</li>
        <li>ðŸ‘€ Las fotos se ven en la app y quedan como Â«cualquiera con el enlace puede verÂ».</li>
        <li>ðŸ“¦ Ocupan espacio de esa cuenta de Google (cada foto pesa menos de 1 MB).</li>
      </ul>

      <ul className="grid gap-3 md:grid-cols-2">
        {families.map((f) => {
          const drive = drives.data?.find((d) => d.familyId === f.id);
          const connecting = connect.isPending && connect.variables === f.id;
          return (
            <li key={f.id} className="space-y-3 rounded-xl border-2 border-night-900 bg-white p-4 shadow-block">
              <FamilyBadge family={f} />
              {!drive ? (
                <p className="flex items-center gap-2 text-base text-ink-700">
                  <HardDrive className="size-5 shrink-0" aria-hidden /> Sin Google Drive: todavÃ­a no pueden subir fotos.
                </p>
              ) : drive.needsReconnect ? (
                <p className="flex items-start gap-2 text-base font-semibold text-berry-700">
                  <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden /> {drive.googleEmail} perdiÃ³ el acceso. Vuelve a conectarlo.
                </p>
              ) : (
                <p className="flex items-start gap-2 text-base text-ink-900">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-pine-600" aria-hidden />
                  <span className="min-w-0 wrap-break-word">
                    Conectado a <strong>{drive.googleEmail}</strong>
                  </span>
                </p>
              )}

              {confirmingId === f.id ? (
                <div className="space-y-2 rounded-xl bg-berry-50 p-3" role="alert">
                  <p className="font-semibold text-berry-700">Â¿Desconectar este Drive? No podrÃ¡n subir fotos nuevas hasta conectar otro. Las ya subidas se siguen viendo.</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="danger" loading={disconnect.isPending} onClick={() => onDisconnect(f.id)}>
                      SÃ­, desconectar
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmingId(null)}>
                      No
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={drive && !drive.needsReconnect ? 'secondary' : 'primary'}
                    loading={connecting}
                    onClick={() => onConnect(f.id)}
                    icon={drive ? <RefreshCw className="size-5" aria-hidden /> : <HardDrive className="size-5" aria-hidden />}
                  >
                    {!drive ? 'Conectar Google Drive' : drive.needsReconnect ? 'Volver a conectar' : 'Cambiar de cuenta'}
                  </Button>
                  {drive && (
                    <Button variant="ghost" onClick={() => setConfirmingId(f.id)} icon={<Link2Off className="size-5" aria-hidden />}>
                      Desconectar
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
