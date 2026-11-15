import { CheckCircle2, PartyPopper, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { ConfettiBurst } from './Confetti';

interface ToastItem {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'celebrate';
}

interface ToastApi {
  success(message: string): void;
  error(message: string): void;
  /** Como `success`, pero con confeti: para logros (completar todo, guardar un regalo, ganar). */
  celebrate(message: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

const toneStyles: Record<ToastItem['tone'], string> = {
  success: 'bg-pine-600 text-white',
  error: 'bg-berry-600 text-white',
  celebrate: 'bg-gold-400 text-night-900',
};

/** Confirmaciones claras y visibles después de cada acción (sin ventanas emergentes). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [burst, setBurst] = useState<number | null>(null);
  const nextId = useRef(1);

  const push = useCallback((message: string, tone: ToastItem['tone']) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), tone === 'error' ? 7000 : 4000);
    if (tone === 'celebrate') {
      setBurst(id);
      setTimeout(() => setBurst((current) => (current === id ? null : current)), 1800);
    }
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push(m, 'success'), error: (m) => push(m, 'error'), celebrate: (m) => push(m, 'celebrate') }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {burst !== null && <ConfettiBurst key={burst} />}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : undefined}
            className={`animate-pop-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border-2 border-night-900 px-5 py-4 text-lg font-bold shadow-block ${toneStyles[t.tone]}`}
          >
            {t.tone === 'success' && <CheckCircle2 className="size-7 shrink-0" aria-hidden />}
            {t.tone === 'error' && <XCircle className="size-7 shrink-0" aria-hidden />}
            {t.tone === 'celebrate' && <PartyPopper className="size-7 shrink-0 motion-safe:animate-wiggle" aria-hidden />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
