import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants, canEditContent } from '@/modules/events/domain/Event';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { Button, Spinner } from '@/shared/ui/Button';
import { EmptyState, Notice } from '@/shared/ui/Card';
import { chipClasses, selectClasses } from '@/shared/ui/Tabs';
import { errorMessage } from '@/shared/ui/errorMessages';
import { DEFAULT_FILTERS, ResponsibilityService, type ResponsibilityFilters } from '../application/ResponsibilityService';
import { isAssignedTo, STATUS_LABELS, type Responsibility, type ResponsibilityKind, type ResponsibilityStatus } from '../domain/Responsibility';
import { useResponsibilities, useStatusChanger } from './hooks';
import { ResponsibilityCard } from './ResponsibilityCard';
import { ResponsibilityFormModal } from './ResponsibilityFormModal';

type Editing = { item: Responsibility | null; kind: ResponsibilityKind } | null;

/** Aportes y tareas de la celebración: todos ven todo; cada quien marca lo suyo. */
export function ResponsibilitiesSection() {
  const { event, context } = useEventScope();
  const responsibilities = useResponsibilities(event.id);
  const participants = useParticipants(event.id);
  const families = useFamilies(event.id);
  const { change, busyId } = useStatusChanger(event.id);
  const [filters, setFilters] = useState<ResponsibilityFilters>(DEFAULT_FILTERS);
  const [editing, setEditing] = useState<Editing>(null);

  const isEditor = canEditContent(context.role);
  const me = actingParticipants(context);

  if (responsibilities.isLoading || participants.isLoading || families.isLoading) return <Spinner label="Cargando…" />;
  if (responsibilities.error) return <Notice tone="error">{errorMessage(responsibilities.error)}</Notice>;

  const all = responsibilities.data ?? [];
  const people = participants.data ?? [];
  const familyList = families.data ?? [];
  const visible = ResponsibilityService.filter(all, filters, me, people);
  const counts = (['pending', 'in_progress', 'done'] as ResponsibilityStatus[]).map((s) => ({ s, n: all.filter((r) => r.status === s).length }));

  const set = <K extends keyof ResponsibilityFilters>(key: K, value: ResponsibilityFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const chip = chipClasses;
  const selectClass = selectClasses;
  const countStyles: Record<ResponsibilityStatus, string> = {
    pending: 'bg-gold-100 text-gold-700',
    in_progress: 'bg-night-50 text-night-700',
    done: 'bg-pine-100 text-pine-700',
  };

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

      {/* Filtros: siempre visibles, sin menús escondidos */}
      <section aria-label="Filtros" className="space-y-3 rounded-2xl border-[3px] border-night-900 bg-white p-4 shadow-block">
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
        <div className="grid gap-2 sm:grid-cols-3">
          {familyList.length > 0 && (
            <label className="flex flex-col gap-1 text-sm font-semibold text-ink-700">
              Familia
              <select value={filters.familyId ?? ''} onChange={(e) => set('familyId', e.target.value || null)} className={selectClass}>
                <option value="">Todas</option>
                {familyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-700">
            Persona
            <select value={filters.participantId ?? ''} onChange={(e) => set('participantId', e.target.value || null)} className={selectClass}>
              <option value="">Todas</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-700">
            Estado
            <select value={filters.status} onChange={(e) => set('status', e.target.value as ResponsibilityFilters['status'])} className={selectClass}>
              <option value="all">Todos</option>
              {(Object.keys(STATUS_LABELS) as ResponsibilityStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s].label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS) && (
          <Button variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Quitar filtros
          </Button>
        )}
      </section>

      {all.length === 0 ? (
        <EmptyState emoji="🎄" title="Todavía no hay aportes ni tareas.">
          {isEditor ? 'Toca «Nuevo aporte» para anotar quién lleva el pavo, las bebidas, los postres…' : 'Pronto el organizador anotará quién lleva qué.'}
        </EmptyState>
      ) : visible.length === 0 ? (
        <Notice>No hay nada con esos filtros.</Notice>
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
