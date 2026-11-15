import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/app/ContainerContext';
import type { SaveWishlistItemData } from '../domain/WishlistItem';

export const wishlistKeys = { event: (eventId: string) => ['wishlist', eventId] as const };

export function useEventWishlist(eventId: string) {
  const { wishlist } = useServices();
  return useQuery({ queryKey: wishlistKeys.event(eventId), queryFn: () => wishlist.listByEvent(eventId) });
}

/** Lee nombre y precio del enlace de una tienda (Edge Function link-preview). */
export function useLinkPreview() {
  const { linkPreview } = useServices();
  return useMutation({ mutationFn: (url: string) => linkPreview.read(url) });
}

/** Guardar, quitar y quitar fotos. Las fotos nuevas se suben con la cola (ver photoQueue.ts). */
export function useWishlistMutations(eventId: string) {
  const { wishlist } = useServices();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: wishlistKeys.event(eventId) });
  return {
    save: useMutation({ mutationFn: (data: SaveWishlistItemData) => wishlist.save(data), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => wishlist.remove(id), onSuccess: refresh }),
    removePhoto: useMutation({ mutationFn: (photoId: string) => wishlist.removePhoto(photoId), onSuccess: refresh }),
  };
}
