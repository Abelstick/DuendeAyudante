import { ClipboardPlus, KeyRound, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { ROLE_LABELS, type EventRole } from '@/modules/events/domain/Event';
import type { Family } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { displayName, type Member } from '@/modules/members/domain/Participant';
import { useMemberMutations } from '@/modules/members/presentation/hooks';
import { Button } from '@/shared/ui/Button';
import { applySort, DEFAULT_LIST_PREFS, matchesSearch, toggleSort, type ListPrefs, type SortValue } from '@/shared/lib/listing';
import { useSessionState } from '@/shared/lib/useSessionState';
import { EmptyState, Notice } from '@/shared/ui/Card';
import { DataTable, RowAction, type Column } from '@/shared/ui/DataTable';
import { FilterSelect, ListToolbar } from '@/shared/ui/ListToolbar';
import { errorMessage } from '@/shared/ui/errorMessages';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { generateFriendlyPassword } from '@/shared/validation/names';
import { AccessCard } from './AccessCard';

interface Props {
  members: Member[];
  families: Family[];
  myRole: EventRole;
  /** Abre el formulario de tareas con esta persona como responsable. */
  onAssignTask: (member: Member) => void;
}

interface MemberPrefs extends ListPrefs {
  /** '' = todas · 'none' = sin familia · id de familia */
  familyId: string;
  /** '' = todos · 'none' = sin usuario · rol */
  role: string;
}

const DEFAULT_PREFS: MemberPrefs = { ...DEFAULT_LIST_PREFS, sort: 'name', familyId: '', role: '' };

const SORT_OPTIONS = [
  { value: 'name', label: 'Nombre' },
  { value: 'family', label: 'Familia' },
  { value: 'role', label: 'Rol' },
  { value: 'username', label: 'Usuario' },
] as const;

const ROLE_ORDER: Record<EventRole, number> = { owner: 0, admin: 1, editor: 2, participant: 3 };

type Panel = { memberId: string; kind: 'access' | 'confirm-reset' | 'new-password'; password?: string } | null;

function canResetPasswordOf(member: Member, myRole: EventRole, myParticipantId: string | undefined): boolean {
  if (!member.hasAccount || member.id === myParticipantId) return false;
  if (member.role === 'owner') return false;
  if (member.role === 'admin') return myRole === 'owner';
  return true;
}

export function MembersList({ members, families, myRole, onAssignTask }: Props) {
  const { event, context } = useEventScope();
  const { resetPassword, updateFamily } = useMemberMutations(event.id);
  const toast = useToast();
  const [panel, setPanel] = useState<Panel>(null);
  const [prefs, setPrefs] = useSessionState<MemberPrefs>(`${event.id}:organizar:familiares`, DEFAULT_PREFS);

  if (members.length === 0) {
    return <EmptyState emoji="🧑‍🤝‍🧑" title="Todavía no agregaste familiares." />;
  }

  const byId = new Map(members.map((m) => [m.id, m]));
  const familyOf = (m: Member) => families.find((f) => f.id === m.familyId);
  const patch = (p: Partial<MemberPrefs>) => setPrefs((prev) => ({ ...prev, ...p }));

  const filtered = members.filter((m) => {
    if (!matchesSearch(prefs.q, displayName(m), m.username, familyOf(m)?.name)) return false;
    if (prefs.familyId && (prefs.familyId === 'none' ? Boolean(familyOf(m)) : m.familyId !== prefs.familyId)) return false;
    if (prefs.role && (prefs.role === 'none' ? m.role !== null : m.role !== prefs.role)) return false;
    return true;
  });
  const sorters: Record<string, (m: Member) => SortValue> = {
    name: (m) => displayName(m),
    family: (m) => familyOf(m)?.name,
    role: (m) => (m.role ? ROLE_ORDER[m.role] : null),
    username: (m) => m.username,
  };
  const visible = applySort(filtered, sorters, prefs.sort, prefs.dir);
  const hasFilters = Boolean(prefs.q || prefs.familyId || prefs.role);

  const doReset = async (member: Member) => {
    const password = generateFriendlyPassword();
    try {
      await resetPassword.mutateAsync({ participantId: member.id, password });
      setPanel({ memberId: member.id, kind: 'new-password', password });
      toast.success('Nueva contraseña creada. Envíasela por WhatsApp.');
    } catch (err) {
      toast.error(errorMessage(err));
      setPanel(null);
    }
  };

  const changeFamily = async (member: Member, familyId: string) => {
    try {
      await updateFamily.mutateAsync({ participantId: member.id, familyId: familyId || null });
      toast.success('Familia actualizada.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const open = panel ? byId.get(panel.memberId) : undefined;

  const familySelect = (m: Member, label?: string) => (
    <select
      aria-label={label}
      value={m.familyId ?? ''}
      onChange={(e) => changeFamily(m, e.target.value)}
      className="min-h-12 w-full rounded-xl border-2 border-night-900 bg-white px-3 text-base text-ink-900"
    >
      <option value="">Sin familia</option>
      {families.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  );

  const columns: Column<Member>[] = [
    {
      key: 'name',
      header: 'Nombre',
      sortKey: 'name',
      cell: (m) => {
        const guardians = m.guardianIds.map((id) => byId.get(id)).filter((g): g is Member => Boolean(g));
        return (
          <>
            <span className="font-bold text-night-900">{displayName(m)}</span>
            {guardians.length > 0 && <span className="block text-sm text-ink-700">Lo manejan: {guardians.map((g) => displayName(g)).join(', ')}</span>}
          </>
        );
      },
    },
    {
      key: 'family',
      header: 'Familia',
      sortKey: 'family',
      className: 'min-w-44',
      cell: (m) => (families.length > 0 ? familySelect(m, `Familia de ${displayName(m)}`) : <FamilyBadge family={undefined} />),
    },
    { key: 'role', header: 'Rol', sortKey: 'role', className: 'whitespace-nowrap', cell: (m) => (m.role ? ROLE_LABELS[m.role] : 'Sin usuario') },
    { key: 'username', header: 'Usuario', sortKey: 'username', cell: (m) => m.username ?? <span className="text-ink-500">—</span> },
    {
      key: 'actions',
      header: 'Acciones',
      cell: (m) => (
        <div className="flex gap-1.5">
          <RowAction onClick={() => onAssignTask(m)} icon={<ClipboardPlus className="size-4" aria-hidden />}>
            Tarea
          </RowAction>
          {m.username && m.id !== context.me?.id && (
            <>
              <RowAction onClick={() => setPanel({ memberId: m.id, kind: 'access' })} icon={<MessageCircle className="size-4" aria-hidden />}>
                Acceso
              </RowAction>
              {canResetPasswordOf(m, myRole, context.me?.id) && (
                <RowAction onClick={() => setPanel({ memberId: m.id, kind: 'confirm-reset' })} icon={<KeyRound className="size-4" aria-hidden />}>
                  Contraseña
                </RowAction>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <ListToolbar
        prefs={prefs}
        onChange={patch}
        searchLabel="Buscar familiar"
        sortOptions={SORT_OPTIONS}
        showView
        summary={hasFilters ? `${visible.length} de ${members.length} familiares` : undefined}
        onReset={hasFilters ? () => patch({ q: '', familyId: '', role: '' }) : null}
      >
        {families.length > 0 && (
          <FilterSelect label="Familia" value={prefs.familyId} onChange={(familyId) => patch({ familyId })}>
            <option value="">Todas</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value="none">Sin familia</option>
          </FilterSelect>
        )}
        <FilterSelect label="Rol" value={prefs.role} onChange={(role) => patch({ role })}>
          <option value="">Todos</option>
          {(Object.keys(ROLE_LABELS) as EventRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
          <option value="none">Sin usuario</option>
        </FilterSelect>
      </ListToolbar>

      {visible.length === 0 ? (
        <Notice>No hay familiares con esos filtros.</Notice>
      ) : prefs.view === 'table' ? (
        <DataTable
          label="Familiares"
          rows={visible}
          columns={columns}
          rowKey={(m) => m.id}
          sort={{ field: prefs.sort, dir: prefs.dir }}
          onSort={(field) => patch(toggleSort(prefs, field))}
        />
      ) : (
      <ul className="stagger grid gap-3 md:grid-cols-2">
        {visible.map((m) => {
          const guardians = m.guardianIds.map((id) => byId.get(id)).filter((g): g is Member => Boolean(g));
          return (
            <li key={m.id} className="space-y-3 rounded-xl border-2 border-night-900 bg-white p-4 shadow-block">
              <div className="space-y-1">
                <p className="font-display text-lg font-bold leading-tight text-night-900">{displayName(m)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <FamilyBadge family={familyOf(m)} />
                  <span className="rounded-lg bg-mist-200 px-2.5 py-0.5 text-sm font-bold text-ink-700">{m.role ? ROLE_LABELS[m.role] : 'Sin usuario'}</span>
                </div>
                {m.username && (
                  <p className="text-base text-ink-700">
                    Usuario: <strong className="text-ink-900">{m.username}</strong>
                  </p>
                )}
                {guardians.length > 0 && <p className="text-sm text-ink-700">Lo manejan: {guardians.map((g) => displayName(g)).join(', ')}</p>}
              </div>

              {families.length > 0 && (
                <label className="flex flex-col gap-1 text-sm font-bold text-ink-700">
                  Familia
                  {familySelect(m)}
                </label>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => onAssignTask(m)} icon={<ClipboardPlus className="size-5" aria-hidden />}>
                  Asignar tarea
                </Button>
                {m.username && m.id !== context.me?.id && (
                  <>
                    <Button variant="ghost" onClick={() => setPanel({ memberId: m.id, kind: 'access' })} icon={<MessageCircle className="size-5" aria-hidden />}>
                      Reenviar acceso
                    </Button>
                    {canResetPasswordOf(m, myRole, context.me?.id) && (
                      <Button variant="ghost" onClick={() => setPanel({ memberId: m.id, kind: 'confirm-reset' })} icon={<KeyRound className="size-5" aria-hidden />}>
                        Nueva contraseña
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      )}

      {/* Acceso y contraseñas: en una ventana, para no alargar la lista */}
      {panel && open && (
        <Modal
          open
          title={panel.kind === 'confirm-reset' ? 'Nueva contraseña' : `Acceso de ${displayName(open)}`}
          onClose={() => setPanel(null)}
        >
          {panel.kind === 'access' && open.username && <AccessCard firstName={open.firstName} username={open.username} password={null} />}

          {panel.kind === 'confirm-reset' && (
            <div className="space-y-4" role="alert">
              <p className="text-lg font-semibold">¿Crear una nueva contraseña para {displayName(open)}? La anterior dejará de funcionar.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button loading={resetPassword.isPending} onClick={() => doReset(open)}>
                  Sí, crear una nueva
                </Button>
                <Button variant="secondary" onClick={() => setPanel(null)}>
                  No
                </Button>
              </div>
            </div>
          )}

          {panel.kind === 'new-password' && open.username && panel.password && (
            <AccessCard firstName={open.firstName} username={open.username} password={panel.password} />
          )}
        </Modal>
      )}
    </>
  );
}
