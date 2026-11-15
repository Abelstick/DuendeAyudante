import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/app/AuthContext';
import { useServices } from '@/app/ContainerContext';
import { prepareImageForUpload } from '@/shared/lib/image';
import { PhotoUploadQueue, type QueuedPhoto } from '../application/PhotoUploadQueue';
import type { WishlistService } from '../application/WishlistService';
import { IndexedDbPhotoQueueStorage } from '../infrastructure/IndexedDbPhotoQueueStorage';
import { wishlistKeys } from './hooks';

// Una sola cola para toda la app: sigue subiendo aunque se cierre el formulario o se cambie de pantalla
let queue: PhotoUploadQueue | null = null;

function getQueue(wishlist: WishlistService, qc: QueryClient): PhotoUploadQueue {
  queue ??= new PhotoUploadQueue(new IndexedDbPhotoQueueStorage(), (itemId, image) => wishlist.uploadPhoto(itemId, image), {
    // Al subir cada foto, la lista se refresca y la foto aparece en el regalo
    onUploaded: (job) => void qc.invalidateQueries({ queryKey: wishlistKeys.event(job.eventId) }),
  });
  return queue;
}

export function usePhotoQueue(): PhotoUploadQueue {
  const { wishlist } = useServices();
  const qc = useQueryClient();
  return getQueue(wishlist, qc);
}

const EMPTY: readonly QueuedPhoto[] = [];

/** Fotos de un regalo que esperan o se están subiendo en este dispositivo. */
export function useQueuedPhotos(itemId: string | undefined): readonly QueuedPhoto[] {
  const q = usePhotoQueue();
  const all = useSyncExternalStore(q.subscribe, q.getSnapshot);
  return useMemo(() => (itemId ? all.filter((j) => j.itemId === itemId) : EMPTY), [all, itemId]);
}

/** Achica las fotos y las pone en cola. Devuelve cuántas no se pudieron abrir. */
export function useEnqueuePhotos() {
  const q = usePhotoQueue();
  return useCallback(
    async (itemId: string, eventId: string, files: readonly File[]) => {
      const images: Blob[] = [];
      let unreadable = 0;
      for (const file of files) {
        try {
          images.push(await prepareImageForUpload(file));
        } catch {
          unreadable++;
        }
      }
      await q.enqueue(itemId, eventId, images);
      return unreadable;
    },
    [q],
  );
}

/**
 * Mantiene la cola andando: retoma lo pendiente al abrir la app, sube solo
 * las fotos de quien tiene la sesión y reintenta en cuanto vuelve el internet.
 */
export function PhotoQueueRunner() {
  const q = usePhotoQueue();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    q.setUser(userId);
    void q.start();
  }, [q, userId]);

  useEffect(() => {
    const onOnline = () => q.retryNow();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [q]);

  return null;
}
