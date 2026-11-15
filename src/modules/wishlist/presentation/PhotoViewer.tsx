import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import type { WishlistPhoto } from '../domain/WishlistPhoto';
import { DrivePhoto } from './DrivePhoto';

interface Props {
  title: string;
  photos: WishlistPhoto[];
  startAt?: number;
  onClose: () => void;
}

/** Visor de las fotos de un regalo: grande, con anterior/siguiente (botones, flechas del teclado o deslizando). */
export function PhotoViewer({ title, photos, startAt = 0, onClose }: Props) {
  const [index, setIndex] = useState(Math.min(startAt, photos.length - 1));
  const [touchX, setTouchX] = useState<number | null>(null);
  const total = photos.length;
  const go = (delta: number) => setIndex((i) => (i + delta + total) % total);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const photo = photos[index];
  if (!photo) return null;

  return (
    <Modal open title={title} onClose={onClose} size="wide">
      <div className="space-y-3">
        <div
          className="relative flex h-[min(70dvh,40rem)] items-center justify-center overflow-hidden rounded-xl bg-night-900"
          onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const end = e.changedTouches[0]?.clientX;
            if (touchX !== null && end !== undefined && Math.abs(end - touchX) > 50) go(end < touchX ? 1 : -1);
            setTouchX(null);
          }}
        >
          <DrivePhoto key={photo.id} driveFileId={photo.driveFileId} alt={`${title}, foto ${index + 1} de ${total}`} width={1600} fit="contain" className="size-full" />
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Foto anterior"
                className="absolute left-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full border-2 border-night-900 bg-white/90 text-night-900 shadow-block"
              >
                <ChevronLeft className="size-7" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Foto siguiente"
                className="absolute right-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full border-2 border-night-900 bg-white/90 text-night-900 shadow-block"
              >
                <ChevronRight className="size-7" aria-hidden />
              </button>
            </>
          )}
        </div>
        {total > 1 && (
          <>
            <p className="text-center text-base font-bold text-ink-700" aria-live="polite">
              Foto {index + 1} de {total}
            </p>
            <ul className="flex justify-center gap-2 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <li key={p.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Ver foto ${i + 1}`}
                    aria-current={i === index}
                    className={`block size-16 overflow-hidden rounded-lg border-2 ${i === index ? 'border-brand ring-2 ring-gold-400' : 'border-mist-300'}`}
                  >
                    <DrivePhoto driveFileId={p.driveFileId} alt="" width={160} className="size-full" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
