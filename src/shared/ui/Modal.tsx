import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Botones de abajo (siempre visibles). */
  footer?: ReactNode;
  /** `wide` para contenido ancho como tablas (en computadora). */
  size?: 'md' | 'wide';
}

/**
 * Ventana accesible basada en <dialog>: el foco queda dentro, se cierra con
 * Esc o con el botón "Cerrar" (con texto visible). En el celular se abre
 * desde abajo ocupando todo el ancho; si aparece el teclado, sube por encima de él
 * (--kb-inset, ver shared/lib/virtualKeyboard.ts) para que los botones sigan a la vista.
 */
export function Modal({ open, title, onClose, children, footer, size = 'md' }: ModalProps) {
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
      className={`m-0 mt-auto mb-(--kb-inset) max-h-[calc(92dvh-var(--kb-inset))] w-full max-w-none overflow-hidden rounded-t-2xl border-2 border-b-0 border-night-900 bg-white p-0 text-ink-900 sm:m-auto sm:rounded-2xl sm:border-b-2 ${
        size === 'wide' ? 'sm:max-w-[min(72rem,calc(100vw-2rem))]' : 'sm:max-w-lg'
      }`}
    >
      {open && (
        <div className="flex max-h-[calc(92dvh-var(--kb-inset))] flex-col">
          <header className="flex items-center justify-between gap-3 border-b-2 border-night-900 bg-gold-400 py-3 pl-5 pr-3">
            <h2 id={titleId} className="text-xl font-bold text-night-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="btn-3d font-display flex min-h-12 shrink-0 items-center gap-1 rounded-xl border-2 border-night-900 bg-white px-3 text-base font-bold text-night-900"
            >
              <X className="size-5" aria-hidden />
              Cerrar
            </button>
          </header>
          <div className="overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
          {footer && <footer className="border-t-2 border-night-900 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
