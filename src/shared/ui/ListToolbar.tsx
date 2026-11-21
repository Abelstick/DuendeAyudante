import { ArrowDown, ArrowUp, ChevronDown, LayoutGrid, Search, SlidersHorizontal, Table2, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import type { ListPrefs, ListView } from '@/shared/lib/listing';
import { selectClasses } from './Tabs';
import { closeKeyboardOnEnter } from '@/shared/lib/virtualKeyboard';

export interface SortOption {
  value: string;
  label: string;
}

interface Props {
  prefs: ListPrefs;
  onChange: (patch: Partial<ListPrefs>) => void;
  /** Texto del buscador, p. ej. "Buscar familiar". Sin él no se muestra el buscador. */
  searchLabel?: string;
  sortOptions?: readonly SortOption[];
  /** Muestra el selector Tarjetas / Tabla. */
  showView?: boolean;
  /** Filtros propios de la lista (selects con su etiqueta). */
  children?: ReactNode;
  /** Resumen del resultado, p. ej. "8 de 20". */
  summary?: string;
  /** Si hay algo que quitar, muestra «Quitar filtros». */
  onReset?: (() => void) | null;
  /** Cuántos filtros están activos: se ve en el botón «Filtros» aunque el panel esté oculto. */
  activeFilters?: number;
}

/** Barra de controles de una lista: buscar, filtrar, ordenar (asc/desc) y elegir la vista. */
export function ListToolbar({ prefs, onChange, searchLabel, sortOptions, showView, children, summary, onReset, activeFilters = 0 }: Props) {
  const asc = prefs.dir === 'asc';
  const sortId = useId();
  const panelId = useId();
  // Filtros y orden se pliegan para que la lista quede a la vista; el buscador siempre se ve
  const [open, setOpen] = useState(false);
  const hasPanel = Boolean(children || sortOptions);
  return (
    <section aria-label="Buscar, filtrar y ordenar" className="space-y-3 rounded-2xl border-2 border-line bg-surface p-3 shadow-block sm:p-4">
      <div className="flex flex-wrap items-end gap-2">
        {searchLabel && (
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
            <input
              type="search"
              enterKeyHint="search"
              onKeyDown={closeKeyboardOnEnter}
              aria-label={searchLabel}
              placeholder={searchLabel}
              value={prefs.q}
              onChange={(e) => onChange({ q: e.target.value })}
              className="min-h-12 w-full rounded-xl border-2 border-line bg-surface pl-10 pr-11 text-base text-ink-900 placeholder:text-ink-500 focus:outline-none focus:ring-4 focus:ring-aqua-400 [&::-webkit-search-cancel-button]:hidden"
            />
            {prefs.q && (
              <button
                type="button"
                aria-label="Borrar búsqueda"
                onClick={() => onChange({ q: '' })}
                className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-700 hover:bg-mist-200"
              >
                <X className="size-5" aria-hidden />
              </button>
            )}
          </div>
        )}
        {hasPanel && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className={`flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl border-2 border-line px-3 text-base font-bold focus:outline-none focus:ring-4 focus:ring-aqua-400 ${open ? 'bg-brand-soft text-brand-ink' : 'bg-surface text-heading hover:bg-brand-soft'}`}
          >
            <SlidersHorizontal className="size-5" aria-hidden />
            {open ? 'Ocultar filtros' : 'Filtros'}
            {activeFilters > 0 && (
              <span className="flex min-w-6 items-center justify-center rounded-full bg-berry-500 px-1.5 text-sm font-black text-white">
                {activeFilters}
                <span className="sr-only">{activeFilters === 1 ? ' filtro activo' : ' filtros activos'}</span>
              </span>
            )}
            <ChevronDown className={`size-5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        )}
        {showView && <ViewToggle value={prefs.view} onChange={(view) => onChange({ view })} />}
      </div>

      {hasPanel && open && (
        <div id={panelId} className="animate-pop-in grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {children}
          {sortOptions && (
            <div className="flex flex-col gap-1 text-sm font-semibold text-ink-700">
              <label htmlFor={sortId}>Ordenar por</label>
              <div className="flex gap-2">
                <select
                  id={sortId}
                  value={sortOptions.some((o) => o.value === prefs.sort) ? prefs.sort : sortOptions[0]?.value}
                  onChange={(e) => onChange({ sort: e.target.value })}
                  className={selectClasses}
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onChange({ dir: asc ? 'desc' : 'asc' })}
                  title={asc ? 'Orden ascendente. Toca para cambiar a descendente.' : 'Orden descendente. Toca para cambiar a ascendente.'}
                  className="flex min-h-12 shrink-0 items-center gap-1 rounded-xl border-2 border-line bg-surface px-3 text-base font-bold text-heading hover:bg-brand-soft focus:outline-none focus:ring-4 focus:ring-aqua-400"
                >
                  {asc ? <ArrowUp className="size-5" aria-hidden /> : <ArrowDown className="size-5" aria-hidden />}
                  <span>{asc ? 'Asc.' : 'Desc.'}</span>
                  <span className="sr-only">{asc ? 'Orden ascendente. Cambiar a descendente.' : 'Orden descendente. Cambiar a ascendente.'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(summary || onReset) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {summary && (
            <p className="text-sm font-semibold text-ink-700" role="status">
              {summary}
            </p>
          )}
          {onReset && (
            <button type="button" onClick={onReset} className="min-h-10 rounded-lg px-2 text-base font-bold text-brand-ink underline decoration-2 underline-offset-4 hover:bg-brand-soft">
              Quitar filtros
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** Etiqueta + <select> con el estilo de los filtros de la barra. */
export function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-ink-700">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClasses}>
        {children}
      </select>
    </label>
  );
}

function ViewToggle({ value, onChange }: { value: ListView; onChange: (view: ListView) => void }) {
  const options = [
    { value: 'cards', label: 'Tarjetas', icon: <LayoutGrid className="size-5" aria-hidden /> },
    { value: 'table', label: 'Tabla', icon: <Table2 className="size-5" aria-hidden /> },
  ] as const;
  return (
    <div role="group" aria-label="Cómo ver la lista" className="flex shrink-0 gap-1 rounded-xl border-2 border-line bg-night-800 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-bold ${value === o.value ? 'bg-gold-400 text-night-900' : 'text-white hover:bg-white/15'}`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
