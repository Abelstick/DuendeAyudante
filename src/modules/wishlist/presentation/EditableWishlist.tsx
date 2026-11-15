import { Plus } from 'lucide-react';
import { useState } from 'react';
import { usePhotoUploadStatus } from '@/modules/family-drive/presentation/hooks';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import type { WishlistItem } from '../domain/WishlistItem';
import type { WishlistPhoto } from '../domain/WishlistPhoto';
import { useWishlistMutations } from './hooks';
import { WishlistItemCard } from './WishlistItemCard';
import { WishlistItemForm, type WishFormPhotos, type WishFormResult } from './WishlistItemForm';

interface Props {
  eventId: string;
  participantId: string;
  items: WishlistItem[];
  budget: number | null;
  currency: string;
  /** Nombre de la persona cuando no es uno mismo (tutor u organizador). */
  forName?: string;
  startAdding?: boolean;
}

/** Lista de regalos de una persona. Agregar y cambiar se hacen en una ventana, para no alargar la pantalla. */
export function EditableWishlist({ eventId, participantId, items, budget, currency, forName, startAdding = false }: Props) {
  const { save, remove, uploadPhotos, removePhoto } = useWishlistMutations(eventId);
  const participants = useParticipants(eventId);
  const toast = useToast();
  const [adding, setAdding] = useState(startAdding);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // Las fotos van al Google Drive de la familia de esta persona o, si no tiene, al general
  const familyId = participants.data?.find((p) => p.id === participantId)?.familyId;
  const status = usePhotoUploadStatus(eventId, familyId);

  /** Sube las fotos nuevas. Devuelve false si alguna falló (el regalo ya quedó guardado). */
  const sendPhotos = async (itemId: string, files: File[], alreadyAttached: number): Promise<boolean> => {
    if (files.length === 0) return true;
    try {
      const r = await uploadPhotos.mutateAsync({
        itemId,
        files,
        alreadyAttached,
        onProgress: (done, total) => setProgress(done < total ? `Subiendo foto ${done + 1} de ${total}…` : null),
      });
      if (r.failed === 0) return true;
      setFormError(
        `El regalo se guardó, pero ${r.failed === 1 ? 'una foto no se pudo subir' : `${r.failed} fotos no se pudieron subir`}. ${errorMessage(r.firstError)}`,
      );
      return false;
    } catch (err) {
      setFormError(`El regalo se guardó, pero las fotos no se pudieron subir. ${errorMessage(err)}`);
      return false;
    } finally {
      setProgress(null);
    }
  };

  const handleSave = async (item: WishlistItem | null, { newPhotos, ...data }: WishFormResult): Promise<boolean> => {
    setFormError(null);
    let itemId: string;
    try {
      itemId = await save.mutateAsync({ id: item?.id ?? null, eventId, participantId, ...data });
    } catch (err) {
      setFormError(errorMessage(err));
      return false;
    }
    const photosOk = await sendPhotos(itemId, newPhotos, item?.photos.length ?? 0);
    if (item) {
      if (photosOk) {
        toast.success('¡Cambios guardados!');
        setEditingId(null);
      }
    } else if (photosOk) {
      toast.celebrate('¡Regalo guardado! 🎁');
    } else {
      // Se pasa a "cambiar" ese regalo para que pueda reintentar las fotos
      setAdding(false);
      setEditingId(itemId);
    }
    return true;
  };

  const handleRemovePhoto = async (photo: WishlistPhoto) => {
    try {
      await removePhoto.mutateAsync(photo.id);
      toast.success('Quitamos la foto.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleDelete = async (item: WishlistItem) => {
    try {
      await remove.mutateAsync(item.id);
      toast.success(`Quitamos «${item.title}» de la lista.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const editing = items.find((item) => item.id === editingId);
  const closeForm = () => {
    setAdding(false);
    setEditingId(null);
    setFormError(null);
  };
  const busy = save.isPending || uploadPhotos.isPending;
  const photos: WishFormPhotos = {
    status,
    removingId: removePhoto.isPending ? (removePhoto.variables ?? null) : null,
    onRemoveExisting: handleRemovePhoto,
  };

  return (
    <div className="space-y-4">
      <Button size="lg" onClick={() => setAdding(true)} icon={<Plus className="size-6" aria-hidden />}>
        Agregar regalo
      </Button>

      {items.length === 0 && (
        <EmptyState emoji="🎁" title={forName ? `${forName} todavía no tiene regalos.` : 'Todavía no agregaste regalos.'}>
          Toca «Agregar regalo» y escribe lo que te gustaría recibir.
        </EmptyState>
      )}

      {items.map((item) => (
        <WishlistItemCard
          key={item.id}
          item={item}
          budget={budget}
          currency={currency}
          canEdit
          deleting={remove.isPending && remove.variables === item.id}
          onEdit={() => setEditingId(item.id)}
          onDelete={() => handleDelete(item)}
        />
      ))}

      {adding && (
        <Modal open title="Nuevo regalo" onClose={busy ? () => undefined : closeForm}>
          <WishlistItemForm
            budget={budget}
            currency={currency}
            forName={forName}
            submitting={busy}
            progress={progress}
            error={formError}
            photos={photos}
            onSubmit={(data) => handleSave(null, data)}
            onCancel={closeForm}
          />
        </Modal>
      )}

      {editing && (
        <Modal open title="Cambiar regalo" onClose={busy ? () => undefined : closeForm}>
          <WishlistItemForm
            key={editing.id}
            initial={editing}
            budget={budget}
            currency={currency}
            forName={forName}
            submitting={busy}
            progress={progress}
            error={formError}
            photos={photos}
            onSubmit={(data) => handleSave(editing, data)}
            onCancel={closeForm}
          />
        </Modal>
      )}
    </div>
  );
}
