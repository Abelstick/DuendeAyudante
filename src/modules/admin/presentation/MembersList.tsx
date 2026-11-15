import { ClipboardPlus, KeyRound, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { ROLE_LABELS, type EventRole } from '@/modules/events/domain/Event';
import type { Family } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { displayName, type Member } from '@/modules/members/domain/Participant';
import { useMemberMutations } from '@/modules/members/presentation/hooks';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/Card';
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

  if (members.length === 0) {
    return <EmptyState emoji="🧑‍🤝‍🧑" title="Todavía no agregaste familiares." />;
  }

  const byId = new Map(members.map((m) => [m.id, m]));

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

  return (
    <>
      <ul className="stagger grid gap-3 md:grid-cols-2">
        {members.map((m) => {
          const guardians = m.guardianIds.map((id) => byId.get(id)).filter((g): g is Member => Boolean(g));
          return (
            <li key={m.id} className="space-y-3 rounded-xl border-2 border-night-900 bg-white p-4 shadow-block">
              <div className="space-y-1">
                <p className="font-display text-lg font-bold leading-tight text-night-900">{displayName(m)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <FamilyBadge family={families.find((f) => f.id === m.familyId)} />
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
                  <select
                    value={m.familyId ?? ''}
                    onChange={(e) => changeFamily(m, e.target.value)}
                    className="min-h-12 rounded-xl border-2 border-night-900 bg-white px-3 text-base text-ink-900"
                  >
                    <option value="">Sin familia</option>
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
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
