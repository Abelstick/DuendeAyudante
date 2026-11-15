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
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[1.75rem] bg-white p-0 text-ink-900 shadow-2xl sm:m-auto sm:max-w-lg sm:rounded-[1.75rem]"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-mist-200 bg-brand-soft py-3 pl-5 pr-3">
            <h2 id={titleId} className="text-xl font-extrabold text-brand">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-12 shrink-0 items-center gap-1 rounded-full bg-white px-4 text-base font-bold text-brand shadow-card hover:bg-mist-50"
            >
              <X className="size-5" aria-hidden />
              Cerrar
            </button>
          </header>
          <div className="overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
          {footer && <footer className="border-t border-mist-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
