import { Camera, Check, ImagePlus, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PhotoUploadStatus } from '@/modules/family-drive/domain/FamilyDrive';
import { Button } from '@/shared/ui/Button';
import { MAX_PHOTOS_PER_ITEM, type WishlistPhoto } from '../domain/WishlistPhoto';
import { DrivePhoto } from './DrivePhoto';

interface Props {
  /** Número de paso en el modo fácil ("3. Fotos"). */
  step?: number;
  status: PhotoUploadStatus;
  /** Fotos ya guardadas del regalo (al cambiarlo). */
  existing: WishlistPhoto[];
  removingId: string | null;
  onRemoveExisting: (photo: WishlistPhoto) => void;
  /** Fotos elegidas que se subirán al guardar. */
  pending: File[];
  onPendingChange: (files: File[]) => void;
  /** Mientras se suben: cuántas de las nuevas ya subieron (en orden). */
  upload: { done: number; total: number } | null;
}

const BLOCKED: Record<Exclude<PhotoUploadStatus, 'ready'>, string> = {
  'no-drive': 'Para subir fotos, quien organiza debe conectar un Google Drive (en Organizar).',
  reconnect: 'El Google Drive donde se guardan las fotos perdió el acceso. Pide a quien organiza que lo vuelva a conectar.',
};

/** En celulares y tablets se ofrece la cámara directamente; en la computadora, solo elegir archivos. */
function hasTouchCamera(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

export function WishPhotosField({ step, status, existing, removingId, onRemoveExisting, pending, onPendingChange, upload }: Props) {
  const uploading = upload !== null;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [showCamera] = useState(hasTouchCamera);

  // Vista previa local de las fotos elegidas (se liberan al cambiar o cerrar)
  const previews = useMemo(() => pending.map((f) => URL.createObjectURL(f)), [pending]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const used = existing.length + pending.length;
  const room = MAX_PHOTOS_PER_ITEM - used;
  const canAdd = status === 'ready' && room > 0 && !uploading;

  const addFiles = (list: FileList | null) => {
    const images = Array.from(list ?? []).filter((f) => f.type.startsWith('image/') || f.type === '');
    if (images.length > 0) onPendingChange([...pending, ...images].slice(0, MAX_PHOTOS_PER_ITEM - existing.length));
  };

  const tiles = [
    ...existing.map((p) => ({ key: p.id, kind: 'saved' as const, photo: p })),
    ...pending.map((f, i) => ({ key: `new-${i}-${f.name}`, kind: 'new' as const, index: i })),
  ];

  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-bold text-ink-900">
        {step ? `${step}. ` : ''}Fotos <span className="font-normal text-ink-500">(opcional)</span>
      </legend>
      <p className="text-sm text-ink-700">Una foto ayuda a acertar: del producto, de la etiqueta o de algo parecido. La primera será la portada.</p>

      {tiles.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Fotos del regalo">
          {tiles.map((t, i) => (
            <li key={t.key} className="relative aspect-square overflow-hidden rounded-xl border-2 border-night-900 bg-mist-200">
              {t.kind === 'saved' ? (
                <DrivePhoto driveFileId={t.photo.driveFileId} alt={`Foto ${i + 1}`} width={300} className="size-full" />
              ) : (
                <img src={previews[t.index]} alt={`Foto nueva ${i + 1}`} className="size-full object-cover" />
              )}
              {i === 0 && <span className="absolute left-1 top-1 rounded-md bg-night-900/80 px-1.5 text-xs font-bold text-white">Portada</span>}
              {t.kind === 'new' && !uploading && (
                <span className="absolute bottom-1 left-1 rounded-md bg-gold-400 px-1.5 text-xs font-bold text-night-900">Nueva</span>
              )}
              {t.kind === 'new' && upload && <UploadOverlay state={t.index < upload.done ? 'done' : t.index === upload.done ? 'uploading' : 'waiting'} />}
              <button
                type="button"
                hidden={uploading && t.kind === 'new'}
                disabled={uploading || (t.kind === 'saved' && removingId === t.photo.id)}
                onClick={() => (t.kind === 'saved' ? onRemoveExisting(t.photo) : onPendingChange(pending.filter((_, j) => j !== t.index)))}
                aria-label={`Quitar foto ${i + 1}`}
                className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full border-2 border-night-900 bg-white text-berry-700 shadow-card disabled:opacity-60"
              >
                {t.kind === 'saved' && removingId === t.photo.id ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <X className="size-5" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {status !== 'ready' ? (
        <p className="rounded-xl border-2 border-dashed border-night-900/30 bg-sky-100 px-4 py-3 text-sm font-semibold text-night-800">📷 {BLOCKED[status]}</p>
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
      {pending.length > 0 && <p className="text-sm text-ink-700">Las fotos nuevas se suben al tocar «Guardar».</p>}
    </fieldset>
  );
}

/** Estado de una foto nueva mientras se suben: en cola, subiendo (animado) o lista. */
function UploadOverlay({ state }: { state: 'waiting' | 'uploading' | 'done' }) {
  if (state === 'done') {
    return (
      <span className="animate-pop-in absolute inset-0 flex items-center justify-center bg-pine-600/45" aria-label="Subida">
        <span className="flex size-10 items-center justify-center rounded-full border-2 border-night-900 bg-white text-pine-700 shadow-card">
          <Check className="size-6" strokeWidth={3} aria-hidden />
        </span>
      </span>
    );
  }
  if (state === 'uploading') {
    return (
      <span className="photo-shimmer absolute inset-0 flex flex-col items-center justify-center gap-1 bg-night-900/45 text-white" aria-label="Subiendo">
        <Loader2 className="size-8 motion-safe:animate-spin" aria-hidden />
        <span className="rounded-md bg-night-900/70 px-1.5 text-xs font-bold">Subiendo…</span>
      </span>
    );
  }
  return (
    <span className="absolute inset-0 flex items-end justify-center bg-white/55 pb-1" aria-label="En espera">
      <span className="rounded-md bg-night-900/70 px-1.5 text-xs font-bold text-white">En cola</span>
    </span>
  );
}
