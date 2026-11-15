import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Botones de abajo (siempre visibles). */
  footer?: ReactNode;
}

/**
 * Ventana accesible basada en <dialog>: el foco queda dentro, se cierra con
 * Esc o con el botón "Cerrar" (con texto visible). En el celular se abre
 * desde abajo ocupando todo el ancho.
 */
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Tocar fuera de la ventana (el fondo) la cierra
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-cream-200 bg-brand-soft px-5 py-4">
            <h2 id={titleId} className="text-xl font-bold text-brand">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-12 items-center gap-1 rounded-xl px-3 text-base font-semibold text-brand hover:bg-white"
            >
              <X className="size-5" aria-hidden />
              Cerrar
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && <footer className="border-t border-cream-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
