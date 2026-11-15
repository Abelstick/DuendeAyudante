import type { HTMLAttributes, ReactNode } from 'react';

export type Tone = 'brand' | 'berry' | 'gold' | 'night';

/* Fichas de icono: color plano con contorno, como un botón de mando */
const bubbleTones: Record<Tone, string> = {
  brand: 'bg-brand text-white',
  berry: 'bg-berry-500 text-white',
  gold: 'bg-gold-400 text-night-900',
  night: 'bg-night-700 text-white',
};

/** Icono dentro de una ficha de color con contorno: ancla visual de títulos y tarjetas. */
export function IconBubble({ children, tone = 'brand', size = 'md' }: { children: ReactNode; tone?: Tone; size?: 'md' | 'lg' }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl border-2 border-night-900 shadow-[0_3px_0_0_var(--color-night-900)] ${bubbleTones[tone]} ${size === 'lg' ? 'size-14' : 'size-11'}`} aria-hidden>
      {children}
    </span>
  );
}

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`animate-pop-in rounded-xl border-2 border-night-900 bg-white p-5 shadow-block ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Título de tarjeta con icono. `action` va a la derecha (p. ej. un contador). */
export function CardTitle({ icon, tone = 'brand', children, action }: { icon?: ReactNode; tone?: Tone; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {icon && <IconBubble tone={tone}>{icon}</IconBubble>}
      <h2 className="min-w-0 flex-1 text-[1.4rem] font-extrabold leading-tight text-night-900">{children}</h2>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}

export function PageTitle({ icon, title, subtitle, tone = 'brand' }: { icon?: ReactNode; title: string; subtitle?: string; tone?: Tone }) {
  return (
    <header className="mb-5 flex items-center gap-3">
      {icon && (
        <IconBubble size="lg" tone={tone}>
          {icon}
        </IconBubble>
      )}
      <div className="min-w-0">
        <h1 className="text-[2rem] font-extrabold leading-none text-night-900 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-base text-ink-700">{subtitle}</p>}
      </div>
    </header>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-[1.4rem] font-extrabold text-night-900">{children}</h2>;
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-night-900/40 bg-white p-6 text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-2xl border-2 border-night-900 bg-sky-100 text-5xl shadow-block motion-safe:animate-float" aria-hidden>
        {emoji}
      </div>
      <p className="font-display mt-4 text-xl font-extrabold text-night-900">{title}</p>
      {children && <div className="mt-2 text-ink-700">{children}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'success' | 'error'; children: ReactNode }) {
  const tones = {
    info: 'bg-sky-100 text-night-800 border-night-900',
    warning: 'bg-gold-100 text-night-900 border-night-900',
    success: 'bg-pine-100 text-pine-800 border-night-900',
    error: 'bg-berry-50 text-berry-700 border-berry-600',
  } as const;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border-2 px-4 py-3 text-base font-semibold ${tones[tone]}`}>
      {children}
    </div>
  );
}

/** Etiqueta pequeña de estado o dato (no es un botón). */
export function Pill({ tone = 'neutral', children }: { tone?: Tone | 'neutral' | 'success'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-mist-200 text-ink-700',
    brand: 'bg-brand-soft text-brand',
    berry: 'bg-berry-50 text-berry-700',
    gold: 'bg-gold-100 text-gold-700',
    night: 'bg-night-50 text-night-700',
    success: 'bg-pine-100 text-pine-700',
  } as const;
  return <span className={`inline-flex items-center gap-1 rounded-lg border-2 border-night-900/15 px-2.5 py-0.5 text-sm font-extrabold ${tones[tone]}`}>{children}</span>;
}
