import { AlertTriangle, Loader2, RotateCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/shared/ui/errorMessages';
import { AppError } from '@/shared/domain/errors';
import type { QueuedPhoto } from '../application/PhotoUploadQueue';
import { usePhotoQueue } from './photoQueue';

/** Vista previa local (la foto todavía no está en Drive). Se libera al dejar de mostrarse. */
function useBlobUrl(blob: Blob) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/**
 * Foto que espera subir desde este dispositivo: "En cola", "Subiendo…" (animado)
 * o "No se pudo subir" (con reintentar y quitar).
 */
export function QueuedPhotoTile({ job, className = '' }: { job: QueuedPhoto; className?: string }) {
  const queue = usePhotoQueue();
  const url = useBlobUrl(job.image);
  const retrying = job.status === 'queued' && job.attempts > 0;

  return (
    <div className={`relative overflow-hidden rounded-xl border-2 border-line bg-mist-200 ${className}`}>
      {url && <img src={url} alt="" className="size-full object-cover" />}

      {job.status === 'uploading' && (
        <span className="photo-shimmer absolute inset-0 flex flex-col items-center justify-center gap-1 bg-night-900/45 text-white" role="status">
          <Loader2 className="size-7 motion-safe:animate-spin" aria-hidden />
          <span className="rounded-md bg-night-900/70 px-1.5 text-xs font-bold">Subiendo…</span>
        </span>
      )}

      {job.status === 'queued' && (
        <span className="absolute inset-0 flex flex-col items-center justify-end gap-1 bg-white/50 pb-1" role="status">
          <span className="rounded-md bg-night-900/75 px-1.5 text-center text-xs font-bold text-white">{retrying ? 'Sin conexión: reintentando' : 'En cola'}</span>
        </span>
      )}

      {job.status === 'failed' && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-berry-800/70 p-1 text-white" role="alert">
          <AlertTriangle className="size-5" aria-hidden />
          <span className="text-center text-xs font-bold leading-tight" title={errorMessage(new AppError(job.error ?? 'UNEXPECTED'))}>
            No se pudo subir
          </span>
          <span className="flex gap-1">
            <button
              type="button"
              onClick={() => void queue.retry(job.id)}
              aria-label="Volver a intentar subir la foto"
              className="flex size-9 items-center justify-center rounded-full border-2 border-line bg-surface text-heading"
            >
              <RotateCw className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => void queue.discard(job.id)}
              aria-label="Quitar la foto"
              className="flex size-9 items-center justify-center rounded-full border-2 border-line bg-surface text-berry-700"
            >
              <X className="size-4" aria-hidden />
            </button>
          </span>
        </span>
      )}
    </div>
  );
}
