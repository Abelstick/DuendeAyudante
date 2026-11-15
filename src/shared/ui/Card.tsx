import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`animate-pop-in rounded-3xl border border-cream-200 bg-white p-5 shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function PageTitle({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <header className="mb-5">
      <h1 className="flex items-center gap-3 text-2xl font-bold text-brand sm:text-3xl">
        {icon}
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-lg text-ink-700">{subtitle}</p>}
    </header>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-xl font-bold text-brand">{children}</h2>;
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-cream-200 bg-cream-50 p-6 text-center">
      <div className="text-5xl" aria-hidden>
        {emoji}
      </div>
      <p className="mt-2 text-lg font-semibold text-ink-900">{title}</p>
      {children && <div className="mt-3 text-ink-700">{children}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'success' | 'error'; children: ReactNode }) {
  const tones = {
    info: 'bg-brand-soft text-brand border-brand-soft',
    warning: 'bg-gold-100 text-ink-900 border-gold-400',
    success: 'bg-brand-soft text-brand border-brand',
    error: 'bg-berry-50 text-berry-700 border-berry-600',
  } as const;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl border-2 px-4 py-3 text-base ${tones[tone]}`}>
      {children}
    </div>
  );
}
