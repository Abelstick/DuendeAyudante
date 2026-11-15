import type { HTMLAttributes, ReactNode } from 'react';

export type Tone = 'brand' | 'berry' | 'gold' | 'night';

const bubbleTones: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand',
  berry: 'bg-berry-50 text-berry-600',
  gold: 'bg-gold-100 text-gold-700',
  night: 'bg-night-50 text-night-700',
};

/** Icono dentro de un círculo de color suave: ancla visual de títulos y tarjetas. */
export function IconBubble({ children, tone = 'brand', size = 'md' }: { children: ReactNode; tone?: Tone; size?: 'md' | 'lg' }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-2xl ${bubbleTones[tone]} ${size === 'lg' ? 'size-14' : 'size-11'}`} aria-hidden>
      {children}
    </span>
  );
}

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`animate-pop-in rounded-3xl border border-mist-200 bg-white p-5 shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Título de tarjeta con icono. `action` va a la derecha (p. ej. un contador). */
export function CardTitle({ icon, tone = 'brand', children, action }: { icon?: ReactNode; tone?: Tone; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {icon && <IconBubble tone={tone}>{icon}</IconBubble>}
      <h2 className="min-w-0 flex-1 text-xl font-extrabold leading-tight text-ink-900">{children}</h2>
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
        <h1 className="text-2xl font-black leading-tight text-ink-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="text-base text-ink-700">{subtitle}</p>}
      </div>
    </header>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-xl font-extrabold text-ink-900">{children}</h2>;
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-mist-300 bg-white/70 p-6 text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-brand-soft text-5xl motion-safe:animate-float" aria-hidden>
        {emoji}
      </div>
      <p className="mt-3 text-lg font-extrabold text-ink-900">{title}</p>
      {children && <div className="mt-2 text-ink-700">{children}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'success' | 'error'; children: ReactNode }) {
  const tones = {
    info: 'bg-night-50 text-night-800 border-night-100',
    warning: 'bg-gold-100 text-ink-900 border-gold-400',
    success: 'bg-pine-100 text-pine-800 border-pine-600/30',
    error: 'bg-berry-50 text-berry-700 border-berry-600',
  } as const;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl border-2 px-4 py-3 text-base font-semibold ${tones[tone]}`}>
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
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${tones[tone]}`}>{children}</span>;
}
