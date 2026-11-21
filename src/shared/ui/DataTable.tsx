import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SortDir } from '@/shared/lib/listing';

export interface Column<T> {
  key: string;
  header: string;
  /** Campo de orden que activa el encabezado. Sin él, la columna no se puede ordenar. */
  sortKey?: string;
  cell: (row: T) => ReactNode;
  /** Clases extra para las celdas (ancho, alineación…). */
  className?: string;
}

interface Props<T> {
  /** Descripción de la tabla para lectores de pantalla. */
  label: string;
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  sort?: { field: string; dir: SortDir };
  /** Se llama al tocar el encabezado de una columna ordenable. */
  onSort?: (field: string) => void;
  rowClassName?: (row: T) => string;
}

/**
 * Vista de tabla de una lista.
 *  · Celular: ocupa la columna y se desplaza hacia los lados.
 *  · Escritorio: sale de la columna central y se ensancha (centrada) hasta donde lo pida su
 *    contenido, con tope en el espacio libre junto al menú lateral (`--nf-side`, de EventLayout).
 */
export function DataTable<T>({ label, rows, columns, rowKey, sort, onSort, rowClassName }: Props<T>) {
  return (
    <div
      className="relative overflow-x-auto rounded-xl border-2 border-line bg-surface shadow-block md:relative md:left-1/2 md:w-max md:min-w-full md:max-w-[min(80rem,calc(100vw_-_var(--nf-side,0px)_-_3rem))] md:-translate-x-1/2"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="w-full min-w-[40rem] border-collapse text-left text-base">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="bg-night-800 text-white">
            {columns.map((c) => {
              const active = sort && c.sortKey === sort.field;
              return (
                <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className="px-3 py-2 text-sm font-bold">
                  {c.sortKey && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.sortKey!)}
                      className={`-mx-2 flex min-h-10 items-center gap-1 rounded-lg px-2 hover:bg-white/15 ${active ? 'text-gold-300' : ''}`}
                    >
                      {c.header}
                      {active ? (
                        sort.dir === 'asc' ? (
                          <ArrowUp className="size-4" aria-hidden />
                        ) : (
                          <ArrowDown className="size-4" aria-hidden />
                        )
                      ) : (
                        <ChevronsUpDown className="size-4 opacity-60" aria-hidden />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={`border-t-2 border-mist-200 align-middle odd:bg-surface even:bg-mist-100/60 ${rowClassName?.(row) ?? ''}`}>
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${c.className ?? ''}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Botón pequeño para las acciones dentro de una fila. */
export function RowAction({ icon, children, onClick, disabled }: { icon?: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-line bg-surface px-2.5 text-sm font-bold text-heading hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-55 [&>svg]:shrink-0"
    >
      {icon}
      {children}
    </button>
  );
}
