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
      className="grid gap-1.5 rounded-2xl bg-mist-200 p-1.5"
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
            className={`flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-sm font-extrabold leading-tight transition-colors sm:flex-row sm:gap-2 sm:text-base ${
              active ? 'bg-white text-brand shadow-card' : 'text-ink-700 hover:bg-white/60'
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
  return `min-h-12 rounded-full border-2 px-4 text-base font-bold transition-colors ${
    active ? 'border-brand bg-brand text-white' : 'border-mist-300 bg-white text-ink-900 hover:border-brand'
  }`;
}

/** Estilo común de los <select>. */
export const selectClasses = 'min-h-12 w-full rounded-xl border-2 border-mist-300 bg-white px-3 text-base text-ink-900 focus:border-brand focus:outline-none';
