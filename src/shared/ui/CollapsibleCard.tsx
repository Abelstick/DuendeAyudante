import { ChevronDown } from 'lucide-react';
import { useCallback, useId, useState, type ReactNode } from 'react';
import { IconBubble, type Tone } from './Card';

const PREFIX = 'duende:contraido:';

function readCollapsed(id: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw === null ? fallback : raw === '1';
  } catch {
    return fallback; // sin almacenamiento (modo privado): abierto por defecto
  }
}

/** Abierto/contraído, recordado en este dispositivo (cada persona decide qué quiere ver en su inicio). */
export function useCollapsed(id: string, defaultCollapsed = true): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(id, defaultCollapsed));
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PREFIX + id, next ? '1' : '0');
      } catch {
        // solo en memoria
      }
      return next;
    });
  }, [id]);
  return [collapsed, toggle];
}

interface Props {
  /** Identificador estable para recordar si está contraída (p. ej. "inicio:anuncios"). */
  id: string;
  icon?: ReactNode;
  tone?: Tone;
  title: ReactNode;
  /** Dato que sigue visible aunque esté contraída (p. ej. un contador). Va debajo del título. */
  action?: ReactNode;
  /** Empieza contraída (por defecto sí: el inicio queda corto y cada quien abre lo que quiere). */
  defaultCollapsed?: boolean;
  className?: string;
  /** Nombre con el que la guía paso a paso resalta esta tarjeta (`data-tour`). */
  tourId?: string;
  children: ReactNode;
}

/**
 * Tarjeta con título que se puede contraer tocando el encabezado.
 * El contenido se pliega con una transición suave (sin animación si la persona la desactivó).
 */
export function CollapsibleCard({ id, icon, tone = 'brand', title, action, defaultCollapsed = true, className = '', tourId, children }: Props) {
  const [collapsed, toggle] = useCollapsed(id, defaultCollapsed);
  const contentId = useId();

  return (
    <section data-tour={tourId} className={`animate-pop-in rounded-xl border-2 border-line bg-surface shadow-block ${className}`}>
      <h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={contentId}
          className="flex w-full items-center gap-3 rounded-xl p-4 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gold-400 sm:p-5"
        >
          {icon && <IconBubble tone={tone}>{icon}</IconBubble>}
          {/* El contador va debajo del título: en el celular no le quita espacio y nunca se monta encima */}
          <span className="min-w-0 flex-1">
            <span className="block text-xl leading-tight font-extrabold text-heading hyphens-auto wrap-break-word sm:text-[1.4rem]">{title}</span>
            {action && <span className="mt-1 flex flex-wrap gap-1">{action}</span>}
          </span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg text-night-ink" aria-hidden>
            <ChevronDown className={`size-6 motion-safe:transition-transform motion-safe:duration-200 ${collapsed ? '-rotate-90' : ''}`} />
          </span>
          <span className="sr-only">{collapsed ? 'Mostrar' : 'Ocultar'}</span>
        </button>
      </h2>
      <div
        id={contentId}
        className={`grid grid-cols-1 motion-safe:transition-[grid-template-rows] motion-safe:duration-300 motion-safe:ease-out ${collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}
        inert={collapsed}
      >
        <div className="relative min-h-0 overflow-hidden">
          <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
        </div>
      </div>
    </section>
  );
}
