import { Settings } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { canManageEvent } from '@/modules/events/domain/Event';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { useMembers } from '@/modules/members/presentation/hooks';
import { formatEventDate } from '@/shared/lib/datetime';
import { formatMoney } from '@/shared/lib/money';
import { Spinner } from '@/shared/ui/Button';
import { Card, Notice, PageTitle, SectionTitle } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { AddMemberForm } from './AddMemberForm';
import { FamiliesManager } from './FamiliesManager';
import { MembersList } from './MembersList';

/** Panel del organizador y administradores. */
export function OrganizePage() {
  const { event, context } = useEventScope();
  const families = useFamilies(event.id);
  const members = useMembers(event.id);

  if (!canManageEvent(context.role)) return <Navigate to={`/e/${event.id}`} replace />;
  if (families.isLoading || members.isLoading) return <Spinner label="Cargando…" />;
  if (families.error || members.error) return <Notice tone="error">{errorMessage(families.error ?? members.error)}</Notice>;

  const familyList = families.data ?? [];
  const memberList = members.data ?? [];
  const step = familyList.length === 0 ? 1 : memberList.length <= 1 ? 2 : 3;

  return (
    <div className="space-y-6">
      <PageTitle icon={<Settings className="size-8 text-pine-700" aria-hidden />} title="Organizar" subtitle={event.name} />

      <Card className="space-y-1">
        <p className="text-lg">
          🏠 Código de tu Navidad: <strong className="select-all tracking-wider text-pine-900">{event.joinCode}</strong>
        </p>
        <p className="text-sm text-ink-700">Tus familiares lo usan para entrar. Ya va incluido en cada mensaje de WhatsApp.</p>
        <p className="text-base capitalize text-ink-700">📅 {formatEventDate(event.celebrationAt, event.timezone)}</p>
        {event.giftExchange && <p className="text-base text-ink-700">💰 Presupuesto: {formatMoney(event.giftExchange.budgetMax, event.currency)}</p>}
      </Card>

      <ol className="grid gap-2 sm:grid-cols-3" aria-label="Pasos para empezar">
        {['Crea las familias', 'Agrega a tus familiares', 'Envíales su acceso por WhatsApp'].map((label, i) => (
          <li
            key={label}
            className={`rounded-2xl border-2 px-4 py-3 text-base font-semibold ${
              i + 1 < step ? 'border-pine-600 bg-pine-50 text-pine-900' : i + 1 === step ? 'border-gold-400 bg-gold-100' : 'border-cream-200 bg-white text-ink-700'
            }`}
          >
            {i + 1 < step ? '✓' : `${i + 1}.`} {label}
          </li>
        ))}
      </ol>

      <section>
        <SectionTitle>👨‍👩‍👧‍👦 Familias</SectionTitle>
        <FamiliesManager eventId={event.id} families={familyList} participants={memberList} />
      </section>

      <section className="space-y-4">
        <SectionTitle>🧑‍🤝‍🧑 Familiares ({memberList.length})</SectionTitle>
        <AddMemberForm families={familyList} members={memberList} myRole={context.role} />
        <MembersList members={memberList} families={familyList} myRole={context.role} />
      </section>
    </div>
  );
}
