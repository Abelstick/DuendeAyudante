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
import { useEnqueuePhotos, usePhotoQueue } from './photoQueue';
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

/**
 * Lista de regalos de una persona. Agregar y cambiar se hacen en una ventana.
 * Al guardar, la ventana se cierra enseguida y las fotos suben en segundo plano
 * (la tarjeta del regalo muestra cuáles están en cola o subiendo).
 */
export function EditableWishlist({ eventId, participantId, items, budget, currency, forName, startAdding = false }: Props) {
  const { save, remove, removePhoto } = useWishlistMutations(eventId);
  const queue = usePhotoQueue();
  const enqueuePhotos = useEnqueuePhotos();
  const participants = useParticipants(eventId);
  const toast = useToast();
  const [adding, setAdding] = useState(startAdding);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Las fotos van al Google Drive de la familia de esta persona o, si no tiene, al general
  const familyId = participants.data?.find((p) => p.id === participantId)?.familyId;
  const status = usePhotoUploadStatus(eventId, familyId);

  const closeForm = () => {
    setAdding(false);
    setEditingId(null);
    setFormError(null);
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

    closeForm();
    if (newPhotos.length === 0) {
      if (item) toast.success('¡Cambios guardados!');
      else toast.celebrate('¡Regalo guardado! 🎁');
      return true;
    }

    toast.celebrate(
      `${item ? '¡Cambios guardados!' : '¡Regalo guardado! 🎁'} ${newPhotos.length === 1 ? 'La foto se está subiendo.' : 'Las fotos se están subiendo.'}`,
    );
    // Se achican y suben en segundo plano: no hace falta esperar con la ventana abierta
    void enqueuePhotos(itemId, eventId, newPhotos)
      .then((unreadable) => {
        if (unreadable > 0) toast.error(unreadable === 1 ? 'Una foto no se pudo abrir. Prueba con otra.' : `${unreadable} fotos no se pudieron abrir. Prueba con otras.`);
      })
      .catch(() => toast.error('No pudimos preparar las fotos. Vuelve a intentarlo.'));
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
      await queue.discardItem(item.id); // sus fotos en cola ya no tienen dónde ir
      toast.success(`Quitamos «${item.title}» de la lista.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const editing = items.find((item) => item.id === editingId);
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
        <Modal open title="Nuevo regalo" onClose={save.isPending ? () => undefined : closeForm}>
          <WishlistItemForm
            budget={budget}
            currency={currency}
            forName={forName}
            submitting={save.isPending}
            error={formError}
            photos={photos}
            onSubmit={(data) => handleSave(null, data)}
            onCancel={closeForm}
          />
        </Modal>
      )}

      {editing && (
        <Modal open title="Cambiar regalo" onClose={save.isPending ? () => undefined : closeForm}>
          <WishlistItemForm
            key={editing.id}
            initial={editing}
            budget={budget}
            currency={currency}
            forName={forName}
            submitting={save.isPending}
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
