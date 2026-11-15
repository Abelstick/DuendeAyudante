import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import { prepareImageForUpload } from '@/shared/lib/image';
import type { SaveWishlistItemData } from '../domain/WishlistItem';

interface UploadPhotosInput {
  itemId: string;
  files: File[];
  alreadyAttached: number;
  onProgress?: (done: number, total: number) => void;
}

export const wishlistKeys = { event: (eventId: string) => ['wishlist', eventId] as const };

export function useEventWishlist(eventId: string) {
  const { wishlist } = useServices();
  return useQuery({ queryKey: wishlistKeys.event(eventId), queryFn: () => wishlist.listByEvent(eventId) });
}

export function useWishlistMutations(eventId: string) {
  const { wishlist } = useServices();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: wishlistKeys.event(eventId) });
  return {
    save: useMutation({ mutationFn: (data: SaveWishlistItemData) => wishlist.save(data), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => wishlist.remove(id), onSuccess: refresh }),
    removePhoto: useMutation({ mutationFn: (photoId: string) => wishlist.removePhoto(photoId), onSuccess: refresh }),
    /** Achica cada foto y la sube; refresca la lista al terminar aunque alguna falle. */
    uploadPhotos: useMutation({
      mutationFn: async ({ itemId, files, alreadyAttached, onProgress }: UploadPhotosInput) => {
        const images: Blob[] = [];
        let unreadable: unknown = null;
        for (const file of files) {
          try {
            images.push(await prepareImageForUpload(file));
          } catch (err) {
            unreadable ??= err;
          }
        }
        const result = await wishlist.uploadPhotos(itemId, images, alreadyAttached, onProgress);
        return { ...result, failed: result.failed + (files.length - images.length), firstError: result.firstError ?? unreadable };
      },
      onSettled: refresh,
    }),
  };
}
