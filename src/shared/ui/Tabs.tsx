import type { ReactNode } from 'react';

interface TabOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: readonly TabOption<T>[];
  onChange: (value: T) => void;
}

/** Pestañas siempre visibles (sin menús escondidos), con áreas táctiles amplias. */
export function SegmentedTabs<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid gap-1.5 rounded-2xl border-2 border-line bg-night-800 p-1.5 shadow-block"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`font-display flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-sm font-bold leading-tight transition-colors sm:flex-row sm:gap-2 sm:text-base ${
              active ? 'animate-hop bg-gold-400 text-night-900' : 'text-white hover:bg-white/15'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Estilo de las opciones tipo "ficha" (elegir persona, filtro, etc.). */
export function chipClasses(active: boolean) {
  return `btn-3d font-display min-h-12 rounded-xl border-2 border-line px-4 text-base font-bold ${
    active ? 'bg-brand text-white' : 'bg-surface text-heading hover:bg-brand-soft'
  }`;
}

/** Estilo común de los <select>. */
export const selectClasses = 'min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3 text-base text-ink-900 focus:outline-none focus:ring-4 focus:ring-aqua-400';
