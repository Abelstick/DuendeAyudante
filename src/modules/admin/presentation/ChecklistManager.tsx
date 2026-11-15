import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { appliesTo, SCOPE_LABELS, type ChecklistItem, type ChecklistScope } from '@/modules/checklist/domain/Checklist';
import { useChecklistItems, useChecklistMutations, useChecklistProgress } from '@/modules/checklist/presentation/hooks';
import type { Family } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { displayName, type Member } from '@/modules/members/domain/Participant';
import { applySort, DEFAULT_LIST_PREFS, matchesSearch, toggleSort, type ListPrefs, type SortValue } from '@/shared/lib/listing';
import { useSessionState } from '@/shared/lib/useSessionState';
import { Button, Spinner } from '@/shared/ui/Button';
import { EmptyState, Notice } from '@/shared/ui/Card';
import { DataTable, RowAction, type Column } from '@/shared/ui/DataTable';
import { FilterSelect, ListToolbar } from '@/shared/ui/ListToolbar';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { TextArea, TextField } from '@/shared/ui/TextField';

type Editing = { mode: 'create' } | { mode: 'edit'; item: ChecklistItem } | null;

interface ChecklistPrefs extends ListPrefs {
  /** '' = cualquiera · alcance de la tarea */
  scope: string;
}

const DEFAULT_PREFS: ChecklistPrefs = { ...DEFAULT_LIST_PREFS, scope: '' };
const SCOPE_ORDER: Record<ChecklistScope, number> = { all: 0, family: 1, participant: 2 };

interface Props {
  eventId: string;
  families: Family[];
  members: Member[];
}

/** Tareas del checklist que el organizador crea para todos, una familia o una persona. */
export function ChecklistManager({ eventId, families, members }: Props) {
  const items = useChecklistItems(eventId);
  const progress = useChecklistProgress(eventId);
  const [editing, setEditing] = useState<Editing>(null);
  const [prefs, setPrefs] = useSessionState<ChecklistPrefs>(`${eventId}:organizar:checklist`, DEFAULT_PREFS);
  const active = members.filter((m) => m.status === 'active');

  if (items.isLoading) return <Spinner label="Cargando…" />;
  if (items.error) return <Notice tone="error">{errorMessage(items.error)}</Notice>;

  const list = items.data ?? [];
  const patch = (p: Partial<ChecklistPrefs>) => setPrefs((prev) => ({ ...prev, ...p }));
  const progressOf = (item: ChecklistItem) => {
    const target = active.filter((m) => appliesTo(item, m));
    const done = target.filter((m) => progress.data?.some((p) => p.itemId === item.id && p.participantId === m.id)).length;
    return { done, total: target.length };
  };
  const scopeText = (item: ChecklistItem) => {
    if (item.scope === 'family') return families.find((f) => f.id === item.familyId)?.name;
    if (item.scope === 'participant') {
      const m = members.find((x) => x.id === item.participantId);
      return m ? displayName(m) : undefined;
    }
    return 'todos';
  };
  const sorters: Record<string, (item: ChecklistItem) => SortValue> = {
    title: (item) => item.title,
    scope: (item) => `${SCOPE_ORDER[item.scope]} ${scopeText(item) ?? ''}`,
    progress: (item) => {
      const { done, total } = progressOf(item);
      return total ? done / total : null;
    },
  };
  const visible = applySort(
    list.filter((item) => (!prefs.scope || item.scope === prefs.scope) && matchesSearch(prefs.q, item.title, item.description, scopeText(item))),
    sorters,
    prefs.sort,
    prefs.dir,
  );
  const hasFilters = Boolean(prefs.q || prefs.scope);

  const columns: Column<ChecklistItem>[] = [
    {
      key: 'title',
      header: 'Tarea',
      sortKey: 'title',
      cell: (item) => (
        <>
          <span className="font-bold text-night-900">{item.title}</span>
          {item.description && <span className="block text-sm text-ink-700">{item.description}</span>}
        </>
      ),
    },
    { key: 'scope', header: 'Para quién', sortKey: 'scope', className: 'text-sm', cell: (item) => <ScopeLabel item={item} families={families} members={members} /> },
    {
      key: 'progress',
      header: 'Avance',
      sortKey: 'progress',
      className: 'whitespace-nowrap tabular-nums',
      cell: (item) => {
        const { done, total } = progressOf(item);
        return `${done} de ${total}`;
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      cell: (item) => (
        <RowAction onClick={() => setEditing({ mode: 'edit', item })} icon={<Pencil className="size-4" aria-hidden />}>
          Editar
        </RowAction>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-base text-ink-700">
        Cada persona ya tiene una tarea automática: <strong>«Agrega tus opciones de regalo»</strong> (se marca sola). Aquí puedes agregar otras.
      </p>

      {list.length === 0 ? (
        <EmptyState emoji="✅" title="Todavía no hay tareas extra.">
          Por ejemplo: «Confirma tu asistencia», «Trae un postre», «Compra el regalo de tu amigo secreto».
        </EmptyState>
      ) : (
        <ListToolbar
          prefs={prefs}
          onChange={patch}
          searchLabel="Buscar en el checklist"
          sortOptions={[
            { value: 'default', label: 'Orden de creación' },
            { value: 'title', label: 'Nombre' },
            { value: 'scope', label: 'Para quién' },
            { value: 'progress', label: 'Avance' },
          ]}
          showView
          summary={hasFilters ? `${visible.length} de ${list.length} tareas` : undefined}
          onReset={hasFilters ? () => patch({ q: '', scope: '' }) : null}
        >
          <FilterSelect label="Para quién" value={prefs.scope} onChange={(scope) => patch({ scope })}>
            <option value="">Cualquiera</option>
            {(Object.keys(SCOPE_LABELS) as ChecklistScope[]).map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABELS[s]}
              </option>
            ))}
          </FilterSelect>
        </ListToolbar>
      )}

      {list.length === 0 ? null : visible.length === 0 ? (
        <Notice>No hay tareas con esos filtros.</Notice>
      ) : prefs.view === 'table' ? (
        <DataTable
          label="Checklist de preparación"
          rows={visible}
          columns={columns}
          rowKey={(item) => item.id}
          sort={{ field: prefs.sort, dir: prefs.dir }}
          onSort={(field) => patch(toggleSort(prefs, field))}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => {
            const { done, total } = progressOf(item);
            return (
              <li key={item.id} className="space-y-2 rounded-2xl border-2 border-mist-300 bg-white p-4">
                <p className="text-lg font-semibold">{item.title}</p>
                {item.description && <p className="text-sm text-ink-700">{item.description}</p>}
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
                  <ScopeLabel item={item} families={families} members={members} />
                  <span>
                    · Hecho por {done} de {total}
                  </span>
                </div>
                <Button variant="secondary" onClick={() => setEditing({ mode: 'edit', item })} icon={<Pencil className="size-5" aria-hidden />}>
                  Editar
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Button onClick={() => setEditing({ mode: 'create' })} icon={<Plus className="size-5" aria-hidden />}>
        Nueva tarea
      </Button>

      {editing && (
        <ChecklistItemModal
          key={editing.mode === 'edit' ? editing.item.id : 'create'}
          eventId={eventId}
          editing={editing}
          families={families}
          members={active}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ScopeLabel({ item, families, members }: { item: ChecklistItem; families: Family[]; members: Member[] }) {
  if (item.scope === 'family') return <FamilyBadge family={families.find((f) => f.id === item.familyId)} />;
  if (item.scope === 'participant') {
    const m = members.find((x) => x.id === item.participantId);
    return <span className="rounded-full bg-mist-200 px-3 py-1 font-semibold">Para {m ? displayName(m) : 'una persona'}</span>;
  }
  return <span className="rounded-full bg-mist-200 px-3 py-1 font-semibold">Para todos</span>;
}

const schema = z.object({
  title: z.string().trim().min(1, 'Escribe qué hay que hacer (ej. Confirma tu asistencia).').max(120, 'Usa un texto más corto.'),
  description: z.string().max(500, 'La explicación es muy larga.'),
});
type FormValues = z.infer<typeof schema>;

interface ModalProps {
  eventId: string;
  editing: NonNullable<Editing>;
  families: Family[];
  members: Member[];
  onClose: () => void;
}

function ChecklistItemModal({ eventId, editing, families, members, onClose }: ModalProps) {
  const { create, update, remove } = useChecklistMutations(eventId);
  const toast = useToast();
  const initial = editing.mode === 'edit' ? editing.item : null;
  const [scope, setScope] = useState<ChecklistScope>(initial?.scope ?? 'all');
  const [familyId, setFamilyId] = useState<string>(initial?.familyId ?? families[0]?.id ?? '');
  const [participantId, setParticipantId] = useState<string>(initial?.participantId ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: initial?.title ?? '', description: initial?.description ?? '' },
  });
  const formId = 'checklist-form';

  const onSubmit = async (v: FormValues) => {
    setFormError(null);
    const data = {
      title: v.title,
      description: v.description || null,
      scope,
      familyId: scope === 'family' ? familyId || null : null,
      participantId: scope === 'participant' ? participantId || null : null,
    };
    try {
      if (initial) await update.mutateAsync({ id: initial.id, data });
      else await create.mutateAsync(data);
      toast.success(initial ? 'Tarea actualizada.' : 'Tarea agregada al checklist.');
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    try {
      await remove.mutateAsync(initial.id);
      toast.success('Tarea quitada.');
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const selectClass = 'min-h-13 w-full rounded-xl border-2 border-mist-300 bg-white px-3 text-lg text-ink-900';

  return (
    <Modal
      open
      title={initial ? 'Editar tarea' : 'Nueva tarea'}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            form={formId}
            size="lg"
            loading={create.isPending || update.isPending}
            icon={initial ? <Save className="size-6" aria-hidden /> : <Plus className="size-6" aria-hidden />}
          >
            {initial ? 'Guardar cambios' : 'Agregar tarea'}
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <TextField label="¿Qué hay que hacer?" placeholder="ej. Confirma tu asistencia" autoFocus error={errors.title?.message} {...register('title')} />
        <TextArea label="Explicación" optional rows={2} error={errors.description?.message} {...register('description')} />

        <fieldset>
          <legend className="mb-2 text-base font-semibold">¿Para quién es?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(SCOPE_LABELS) as ChecklistScope[])
              .filter((s) => s !== 'family' || families.length > 0)
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={scope === s}
                  onClick={() => setScope(s)}
                  className={`min-h-13 rounded-xl border-2 px-3 text-base font-semibold ${
                    scope === s ? 'border-brand bg-brand text-white' : 'border-mist-200 bg-white'
                  }`}
                >
                  {scope === s ? '✓ ' : ''}
                  {SCOPE_LABELS[s]}
                </button>
              ))}
          </div>
        </fieldset>

        {scope === 'family' && (
          <label className="flex flex-col gap-1.5 text-base font-semibold">
            Familia
            <select value={familyId} onChange={(e) => setFamilyId(e.target.value)} className={selectClass}>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {scope === 'participant' && (
          <label className="flex flex-col gap-1.5 text-base font-semibold">
            Persona
            <select value={participantId} onChange={(e) => setParticipantId(e.target.value)} className={selectClass}>
              <option value="">Elige a una persona…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {displayName(m)}
                </option>
              ))}
            </select>
          </label>
        )}

        {formError && <Notice tone="error">{formError}</Notice>}

        {initial && (
          <div className="border-t border-mist-200 pt-4">
            {confirmingDelete ? (
              <div className="space-y-2 rounded-xl bg-berry-50 p-3" role="alert">
                <p className="font-semibold text-berry-700">¿Quitar esta tarea del checklist de todos?</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="danger" loading={remove.isPending} onClick={onDelete}>
                    Sí, quitar
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                    No
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmingDelete(true)} icon={<Trash2 className="size-5" aria-hidden />} className="text-berry-700! hover:bg-berry-50!">
                Quitar esta tarea
              </Button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
