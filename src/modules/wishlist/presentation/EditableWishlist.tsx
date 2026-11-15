import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';
import type { WishlistItem } from '../domain/WishlistItem';
import { useWishlistMutations } from './hooks';
import { WishlistItemCard } from './WishlistItemCard';
import { WishlistItemForm, type WishFormResult } from './WishlistItemForm';

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

/** Lista de regalos de una persona, con agregar / cambiar / quitar. */
export function EditableWishlist({ eventId, participantId, items, budget, currency, forName, startAdding = false }: Props) {
  const { save, remove } = useWishlistMutations(eventId);
  const toast = useToast();
  const [adding, setAdding] = useState(startAdding);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = async (id: string | null, data: WishFormResult): Promise<boolean> => {
    setFormError(null);
    try {
      await save.mutateAsync({ id, eventId, participantId, ...data });
      if (id) toast.success('¡Cambios guardados!');
      else toast.celebrate('¡Regalo guardado! 🎁');
      if (id) setEditingId(null);
      return true;
    } catch (err) {
      setFormError(errorMessage(err));
      return false;
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

  return (
    <div className="space-y-4">
      {adding ? (
        <WishlistItemForm
          budget={budget}
          currency={currency}
          forName={forName}
          submitting={save.isPending}
          error={formError}
          onSubmit={(data) => handleSave(null, data)}
          onCancel={() => {
            setAdding(false);
            setFormError(null);
          }}
        />
      ) : (
        <Button
          size="lg"
          onClick={() => {
            setEditingId(null);
            setAdding(true);
          }}
          icon={<Plus className="size-6" aria-hidden />}
        >
          Agregar regalo
        </Button>
      )}

      {items.length === 0 && !adding && (
        <EmptyState emoji="🎁" title={forName ? `${forName} todavía no tiene regalos.` : 'Todavía no agregaste regalos.'}>
          Toca «Agregar regalo» y escribe lo que te gustaría recibir.
        </EmptyState>
      )}

      {items.map((item) =>
        editingId === item.id ? (
          <WishlistItemForm
            key={item.id}
            initial={item}
            budget={budget}
            currency={currency}
            submitting={save.isPending}
            error={formError}
            onSubmit={(data) => handleSave(item.id, data)}
            onCancel={() => {
              setEditingId(null);
              setFormError(null);
            }}
          />
        ) : (
          <WishlistItemCard
            key={item.id}
            item={item}
            budget={budget}
            currency={currency}
            canEdit
            deleting={remove.isPending && remove.variables === item.id}
            onEdit={() => {
              setAdding(false);
              setEditingId(item.id);
            }}
            onDelete={() => handleDelete(item)}
          />
        ),
      )}
    </div>
  );
}
