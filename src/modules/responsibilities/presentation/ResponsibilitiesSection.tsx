import { Check, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants, canEditContent } from '@/modules/events/domain/Event';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { formatDateOnly } from '@/shared/lib/datetime';
import { applySort, DEFAULT_LIST_PREFS, matchesSearch, toggleSort, type ListPrefs, type SortValue } from '@/shared/lib/listing';
import { useSessionState } from '@/shared/lib/useSessionState';
import { eventAppLink } from '@/shared/lib/appLink';
import { whatsappShareUrl } from '@/shared/lib/whatsapp';
import { toTitleCase } from '@/shared/validation/names';
import { responsibilityReminderMessage } from '@/modules/reminders/domain/Reminders';
import { Button, Spinner } from '@/shared/ui/Button';
import { EmptyState, Notice } from '@/shared/ui/Card';
import { DataTable, RowAction, type Column } from '@/shared/ui/DataTable';
import { FilterSelect, ListToolbar } from '@/shared/ui/ListToolbar';
import { chipClasses } from '@/shared/ui/Tabs';
import { errorMessage } from '@/shared/ui/errorMessages';
import { DEFAULT_FILTERS, ResponsibilityService, type ResponsibilityFilters } from '../application/ResponsibilityService';
import { CATEGORY_LABELS, isAssignedTo, KIND_LABELS, STATUS_LABELS, type Responsibility, type ResponsibilityKind, type ResponsibilityStatus } from '../domain/Responsibility';
import { useResponsibilities, useStatusChanger } from './hooks';
import { ResponsibilityCard } from './ResponsibilityCard';
import { ResponsibilityFormModal } from './ResponsibilityFormModal';

type Editing = { item: Responsibility | null; kind: ResponsibilityKind } | null;

const STATUS_ORDER: Record<ResponsibilityStatus, number> = { pending: 0, in_progress: 1, done: 2 };

const SORT_OPTIONS = [
  { value: 'default', label: 'Recomendado (lo pendiente primero)' },
  { value: 'title', label: 'Nombre' },
  { value: 'dueDate', label: 'Fecha límite' },
  { value: 'status', label: 'Estado' },
  { value: 'category', label: 'Categoría' },
] as const;

/** Aportes y tareas de la celebración: todos ven todo; cada quien marca lo suyo. */
export function ResponsibilitiesSection() {
  const { event, context } = useEventScope();
  const responsibilities = useResponsibilities(event.id);
  const participants = useParticipants(event.id);
  const families = useFamilies(event.id);
  const { change, busyId } = useStatusChanger(event.id);
  const [filters, setFilters] = useSessionState<ResponsibilityFilters>(`${event.id}:celebracion:aportes:filtros`, DEFAULT_FILTERS);
  const [prefs, setPrefs] = useSessionState<ListPrefs>(`${event.id}:celebracion:aportes:lista`, DEFAULT_LIST_PREFS);
  const [editing, setEditing] = useState<Editing>(null);

  const isEditor = canEditContent(context.role);
  const me = actingParticipants(context);

  if (responsibilities.isLoading || participants.isLoading || families.isLoading) return <Spinner label="Cargando…" />;
  if (responsibilities.error) return <Notice tone="error">{errorMessage(responsibilities.error)}</Notice>;

  const all = responsibilities.data ?? [];
  const people = participants.data ?? [];
  const familyList = families.data ?? [];
  const namesOf = (r: Responsibility) => [
    ...r.familyIds.map((id) => familyList.find((f) => f.id === id)?.name),
    ...r.participantIds.map((id) => {
      const p = people.find((x) => x.id === id);
      return p ? displayName(p) : undefined;
    }),
  ];
  const sorters: Record<string, (r: Responsibility) => SortValue> = {
    title: (r) => r.title,
    dueDate: (r) => r.dueDate,
    status: (r) => STATUS_ORDER[r.status],
    category: (r) => `${KIND_LABELS[r.kind].one} ${CATEGORY_LABELS[r.category].label}`,
    responsible: (r) => namesOf(r).filter(Boolean).join(' '),
  };
  const visible = applySort(
    ResponsibilityService.filter(all, filters, me, people).filter((r) =>
      matchesSearch(prefs.q, r.title, r.description, r.notes, CATEGORY_LABELS[r.category].label, ...namesOf(r)),
    ),
    sorters,
    prefs.sort,
    prefs.dir,
  );
  const patch = (p: Partial<ListPrefs>) => setPrefs((prev) => ({ ...prev, ...p }));
  const remindHref = (r: Responsibility) => {
    const names = [
      ...r.familyIds.map((id) => familyList.find((f) => f.id === id)).filter((f) => f !== undefined).map((f) => `familia ${toTitleCase(f.name)}`),
      ...r.participantIds.map((id) => people.find((p) => p.id === id)).filter((p) => p !== undefined).map((p) => toTitleCase(p.firstName)),
    ];
    return whatsappShareUrl(responsibilityReminderMessage(r, names, event.name, eventAppLink(event.id, '/celebracion')));
  };
  const hasFilters = Boolean(prefs.q) || JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    patch({ q: '' });
  };
  const counts = (['pending', 'in_progress', 'done'] as ResponsibilityStatus[]).map((s) => ({ s, n: all.filter((r) => r.status === s).length }));

  const set = <K extends keyof ResponsibilityFilters>(key: K, value: ResponsibilityFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const chip = chipClasses;
  const countStyles: Record<ResponsibilityStatus, string> = {
    pending: 'bg-gold-100 text-gold-700',
    in_progress: 'bg-night-50 text-night-700',
    done: 'bg-pine-100 text-pine-700',
  };

  const columns: Column<Responsibility>[] = [
    {
      key: 'title',
      header: 'Qué',
      sortKey: 'title',
      cell: (r) => (
        <>
          <span className="font-bold text-night-900">{r.title}</span>
          {r.description && <span className="block text-sm text-ink-700">{r.description}</span>}
        </>
      ),
    },
    {
      key: 'category',
      header: 'Tipo',
      sortKey: 'category',
      className: 'text-sm',
      cell: (r) => (
        <>
          <span aria-hidden>{CATEGORY_LABELS[r.category].emoji}</span> {KIND_LABELS[r.kind].one} · {CATEGORY_LABELS[r.category].label}
        </>
      ),
    },
    {
      key: 'responsible',
      header: 'Responsables',
      sortKey: 'responsible',
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {r.familyIds.map((id) => {
            const f = familyList.find((x) => x.id === id);
            return f ? <FamilyBadge key={id} family={f} /> : null;
          })}
          {r.participantIds.map((id) => {
            const p = people.find((x) => x.id === id);
            return p ? (
              <span key={id} className="rounded-full bg-mist-200 px-2.5 py-0.5 text-sm font-bold text-ink-700">
                {displayName(p)}
              </span>
            ) : null;
          })}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Fecha límite',
      sortKey: 'dueDate',
      className: 'whitespace-nowrap text-sm',
      cell: (r) => (r.dueDate ? formatDateOnly(r.dueDate) : <span className="text-ink-500">—</span>),
    },
    {
      key: 'status',
      header: 'Estado',
      sortKey: 'status',
      className: 'whitespace-nowrap',
      cell: (r) => (
        <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${countStyles[r.status]}`}>
          <span aria-hidden>{STATUS_LABELS[r.status].emoji}</span> {STATUS_LABELS[r.status].label}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      cell: (r) => {
        const canChange = isEditor || isAssignedTo(r, me);
        return (
          <div className="flex gap-1.5">
            {canChange &&
              (r.status === 'done' ? (
                <RowAction disabled={busyId === r.id} onClick={() => change(r, 'pending')} icon={<RotateCcw className="size-4" aria-hidden />}>
                  Pendiente
                </RowAction>
              ) : (
                <RowAction disabled={busyId === r.id} onClick={() => change(r, 'done')} icon={<Check className="size-4" aria-hidden />}>
                  Ya lo hice
                </RowAction>
              ))}
            {isEditor && (
              <RowAction onClick={() => setEditing({ item: r, kind: r.kind })} icon={<Pencil className="size-4" aria-hidden />}>
                Editar
              </RowAction>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {all.length > 0 && (
        <ul className="grid grid-cols-3 gap-2" aria-label="Resumen">
          {counts.map(({ s, n }) => (
            <li key={s} className={`rounded-2xl px-2 py-3 text-center ${countStyles[s]}`}>
              <span className="block text-2xl font-black tabular-nums leading-none">{n}</span>
              <span className="block text-sm font-bold leading-tight">
                {s === 'in_progress' ? 'en progreso' : `${STATUS_LABELS[s].label.toLowerCase()}${n === 1 ? '' : 's'}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {isEditor && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => setEditing({ item: null, kind: 'contribution' })} icon={<Plus className="size-5" aria-hidden />}>
            Nuevo aporte
          </Button>
          <Button variant="secondary" onClick={() => setEditing({ item: null, kind: 'task' })} icon={<Plus className="size-5" aria-hidden />}>
            Nueva tarea
          </Button>
        </div>
      )}

      {/* Filtros: siempre visibles, sin menús escondidos. Se recuerdan durante la sesión. */}
      {all.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Qué mostrar">
            {(
              [
                ['all', 'Todo'],
                ['contribution', 'Aportes'],
                ['task', 'Tareas'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filters.kind === value} onClick={() => set('kind', value)} className={chip(filters.kind === value)}>
                {label}
              </button>
            ))}
            {me.length > 0 && (
              <button type="button" aria-pressed={filters.onlyMine} onClick={() => set('onlyMine', !filters.onlyMine)} className={chip(filters.onlyMine)}>
                {filters.onlyMine ? '✓ ' : ''}Solo las mías
              </button>
            )}
          </div>
          <ListToolbar
            prefs={prefs}
            onChange={patch}
            searchLabel="Buscar aporte o tarea"
            sortOptions={SORT_OPTIONS}
            showView
            summary={hasFilters ? `${visible.length} de ${all.length}` : undefined}
            onReset={hasFilters ? reset : null}
            activeFilters={(Object.keys(DEFAULT_FILTERS) as (keyof ResponsibilityFilters)[]).filter((k) => filters[k] !== DEFAULT_FILTERS[k]).length}
          >
            {familyList.length > 0 && (
              <FilterSelect label="Familia" value={filters.familyId ?? ''} onChange={(v) => set('familyId', v || null)}>
                <option value="">Todas</option>
                {familyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </FilterSelect>
            )}
            <FilterSelect label="Persona" value={filters.participantId ?? ''} onChange={(v) => set('participantId', v || null)}>
              <option value="">Todas</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Estado" value={filters.status} onChange={(v) => set('status', v as ResponsibilityFilters['status'])}>
              <option value="all">Todos</option>
              {(Object.keys(STATUS_LABELS) as ResponsibilityStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s].label}
                </option>
              ))}
            </FilterSelect>
          </ListToolbar>
        </>
      )}

      {all.length === 0 ? (
        <EmptyState emoji="🎄" title="Todavía no hay aportes ni tareas.">
          {isEditor ? 'Toca «Nuevo aporte» para anotar quién lleva el pavo, las bebidas, los postres…' : 'Pronto el organizador anotará quién lleva qué.'}
        </EmptyState>
      ) : visible.length === 0 ? (
        <Notice>No hay nada con esos filtros.</Notice>
      ) : prefs.view === 'table' ? (
        <DataTable
          label="Aportes y tareas"
          rows={visible}
          columns={columns}
          rowKey={(r) => r.id}
          sort={{ field: prefs.sort, dir: prefs.dir }}
          onSort={(field) => patch(toggleSort(prefs, field))}
          rowClassName={(r) => (r.status === 'done' ? 'text-ink-700' : '')}
        />
      ) : (
        <div className="stagger space-y-3">
          {visible.map((r) => (
            <ResponsibilityCard
              key={r.id}
              item={r}
              families={familyList}
              participants={people}
              canChangeStatus={isEditor || isAssignedTo(r, me)}
              canEdit={isEditor}
              busy={busyId === r.id}
              onStatus={(s) => change(r, s)}
              onEdit={() => setEditing({ item: r, kind: r.kind })}
              remindHref={isEditor ? remindHref(r) : undefined}
            />
          ))}
        </div>
      )}

      {editing && (
        <ResponsibilityFormModal
          key={editing.item?.id ?? `new-${editing.kind}`}
          eventId={event.id}
          initial={editing.item}
          defaultKind={editing.kind}
          families={familyList}
          participants={people}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
