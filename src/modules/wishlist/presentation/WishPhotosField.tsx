import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PhotoUploadStatus } from '@/modules/family-drive/domain/FamilyDrive';
import { Button } from '@/shared/ui/Button';
import type { QueuedPhoto } from '../application/PhotoUploadQueue';
import { MAX_PHOTOS_PER_ITEM, type WishlistPhoto } from '../domain/WishlistPhoto';
import { DrivePhoto } from './DrivePhoto';
import { QueuedPhotoTile } from './QueuedPhotoTile';

interface Props {
  /** Número de paso en el modo fácil ("3. Fotos"). */
  step?: number;
  status: PhotoUploadStatus;
  /** Fotos ya guardadas del regalo (al cambiarlo). */
  existing: WishlistPhoto[];
  removingId: string | null;
  onRemoveExisting: (photo: WishlistPhoto) => void;
  /** Fotos de este regalo que esperan subir desde este dispositivo. */
  queued: readonly QueuedPhoto[];
  /** Fotos elegidas que se pondrán en cola al guardar. */
  pending: File[];
  onPendingChange: (files: File[]) => void;
}

const BLOCKED: Record<Exclude<PhotoUploadStatus, 'ready'>, string> = {
  'no-drive': 'Para subir fotos, quien organiza debe conectar un Google Drive (en Organizar).',
  reconnect: 'El Google Drive donde se guardan las fotos perdió el acceso. Pide a quien organiza que lo vuelva a conectar.',
};

/** En celulares y tablets se ofrece la cámara directamente; en la computadora, solo elegir archivos. */
function hasTouchCamera(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

export function WishPhotosField({ step, status, existing, removingId, onRemoveExisting, queued, pending, onPendingChange }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [showCamera] = useState(hasTouchCamera);

  // Vista previa local de las fotos elegidas (se liberan al cambiar o cerrar)
  const previews = useMemo(() => pending.map((f) => URL.createObjectURL(f)), [pending]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const waiting = queued.filter((j) => j.status !== 'failed');
  const used = existing.length + waiting.length + pending.length;
  const room = MAX_PHOTOS_PER_ITEM - used;
  const canAdd = status === 'ready' && room > 0;

  const addFiles = (list: FileList | null) => {
    const images = Array.from(list ?? []).filter((f) => f.type.startsWith('image/') || f.type === '');
    if (images.length > 0) onPendingChange([...pending, ...images].slice(0, MAX_PHOTOS_PER_ITEM - existing.length - waiting.length));
  };

  const total = existing.length + queued.length + pending.length;

  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-bold text-ink-900">
        {step ? `${step}. ` : ''}Fotos <span className="font-normal text-ink-500">(opcional)</span>
      </legend>
      <p className="text-sm text-ink-700">Una foto ayuda a acertar: del producto, de la etiqueta o de algo parecido. La primera será la portada.</p>

      {total > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Fotos del regalo">
          {existing.map((photo, i) => (
            <li key={photo.id} className="relative aspect-square overflow-hidden rounded-xl border-2 border-line bg-mist-200">
              <DrivePhoto driveFileId={photo.driveFileId} alt={`Foto ${i + 1}`} width={300} className="size-full" />
              {i === 0 && <span className="absolute left-1 top-1 rounded-md bg-night-900/80 px-1.5 text-xs font-bold text-white">Portada</span>}
              <button
                type="button"
                disabled={removingId === photo.id}
                onClick={() => onRemoveExisting(photo)}
                aria-label={`Quitar foto ${i + 1}`}
                className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full border-2 border-line bg-surface text-berry-700 shadow-card disabled:opacity-60"
              >
                {removingId === photo.id ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <X className="size-5" aria-hidden />}
              </button>
            </li>
          ))}
          {queued.map((job) => (
            <li key={job.id} className="aspect-square">
              <QueuedPhotoTile job={job} className="size-full" />
            </li>
          ))}
          {pending.map((file, i) => (
            <li key={`new-${i}-${file.name}`} className="relative aspect-square overflow-hidden rounded-xl border-2 border-line bg-mist-200">
              <img src={previews[i]} alt={`Foto nueva ${i + 1}`} className="size-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded-md bg-gold-400 px-1.5 text-xs font-bold text-night-900">Nueva</span>
              <button
                type="button"
                onClick={() => onPendingChange(pending.filter((_, j) => j !== i))}
                aria-label={`Quitar foto nueva ${i + 1}`}
                className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full border-2 border-line bg-surface text-berry-700 shadow-card"
              >
                <X className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {status !== 'ready' ? (
        <p className="rounded-xl border-2 border-dashed border-line/30 bg-sky-100 px-4 py-3 text-sm font-semibold text-night-ink">📷 {BLOCKED[status]}</p>
      ) : room <= 0 ? (
        <p className="text-sm text-ink-700">Llegaste al máximo de {MAX_PHOTOS_PER_ITEM} fotos.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {showCamera && (
            <Button variant="secondary" size={step ? 'lg' : 'md'} onClick={() => cameraRef.current?.click()} disabled={!canAdd} icon={<Camera className="size-5" aria-hidden />}>
              Tomar foto
            </Button>
          )}
          <Button variant="secondary" size={step ? 'lg' : 'md'} onClick={() => galleryRef.current?.click()} disabled={!canAdd} icon={<ImagePlus className="size-5" aria-hidden />}>
            {showCamera ? 'Elegir de la galería' : 'Elegir fotos'}
          </Button>
          <span className="self-center text-sm text-ink-700">
            {used} de {MAX_PHOTOS_PER_ITEM}
          </span>
        </div>
      )}

      {/* capture abre directamente la cámara trasera en el celular */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {pending.length > 0 && <p className="text-sm text-ink-700">Al tocar «Guardar», la ventana se cierra y las fotos se suben solas.</p>}
    </fieldset>
  );
}
