import { CircleQuestionMark } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { startTour, type TourStep } from '@/shared/tour/tour';
import { useToast } from './Toast';

interface Props {
  label: string;
  steps: TourStep[];
  /** Para dejar la pantalla lista antes de empezar (p. ej. volver a la pestaña principal). */
  onBeforeStart?: () => void;
  className?: string;
}

/**
 * Botón de ayuda: abre una guía paso a paso de la pantalla. La guía solo aparece
 * si la persona lo toca; quien ya sabe usar la app nunca la ve.
 */
export function TourButton({ label, steps, onBeforeStart, className = '' }: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  const mounted = useRef(true);

  // Al salir de la pantalla, la guía se cierra sola
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop.current?.();
    };
  }, []);

  const start = async () => {
    if (loading) return;
    setLoading(true);
    try {
      onBeforeStart?.();
      const close = await startTour(steps);
      if (mounted.current) stop.current = close;
      else close();
    } catch {
      toast.error('No pudimos abrir la guía. Revisa tu conexión y vuelve a intentarlo.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      aria-busy={loading || undefined}
      className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl border-2 border-dashed border-night-900/50 bg-white/80 px-4 py-2 text-left text-base font-bold text-night-800 transition-colors hover:border-night-900 hover:bg-sky-100 ${className}`}
    >
      <CircleQuestionMark className="size-6 shrink-0 text-sky-600" aria-hidden />
      <span className="min-w-0 flex-1">{loading ? 'Abriendo la guía…' : label}</span>
    </button>
  );
}
