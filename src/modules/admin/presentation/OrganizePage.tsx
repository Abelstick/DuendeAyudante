import { CalendarDays, Check, ListChecks, Settings, UserPlus, Users, Wallet } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { canManageEvent } from '@/modules/events/domain/Event';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { useMembers } from '@/modules/members/presentation/hooks';
import { formatEventDate } from '@/shared/lib/datetime';
import { formatMoney } from '@/shared/lib/money';
import { Spinner } from '@/shared/ui/Button';
import { Card, CardTitle, Notice, PageTitle } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { AddMemberForm } from './AddMemberForm';
import { ChecklistManager } from './ChecklistManager';
import { JoinCodeEditor } from './JoinCodeEditor';
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
      <PageTitle tone="gold" icon={<Settings className="size-8" aria-hidden />} title="Organizar" subtitle={event.name} />

      <Card className="space-y-3 border-2 border-gold-400! bg-gold-50">
        <JoinCodeEditor />
        <ul className="grid gap-2 sm:grid-cols-2">
          <li className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-base">
            <CalendarDays className="size-5 shrink-0 text-night-700" aria-hidden />
            <span className="first-letter:uppercase">{formatEventDate(event.celebrationAt, event.timezone)}</span>
          </li>
          {event.giftExchange && (
            <li className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-base">
              <Wallet className="size-5 shrink-0 text-night-700" aria-hidden />
              <span>
                Presupuesto: <strong>{formatMoney(event.giftExchange.budgetMax, event.currency)}</strong>
              </span>
            </li>
          )}
        </ul>
      </Card>

      <ol className="grid gap-2 sm:grid-cols-3" aria-label="Pasos para empezar">
        {['Crea las familias', 'Agrega a tus familiares', 'Envíales su acceso por WhatsApp'].map((label, i) => (
          <li
            key={label}
            aria-current={i + 1 === step ? 'step' : undefined}
            className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-base font-bold ${
              i + 1 < step ? 'border-pine-600/30 bg-pine-100 text-pine-700' : i + 1 === step ? 'border-gold-400 bg-gold-100 text-ink-900' : 'border-mist-200 bg-white text-ink-700'
            }`}
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-base font-black ${
                i + 1 < step ? 'bg-pine-600 text-white' : i + 1 === step ? 'bg-gold-400 text-night-900' : 'bg-mist-200 text-ink-700'
              }`}
              aria-hidden
            >
              {i + 1 < step ? <Check className="size-5" strokeWidth={3} /> : i + 1}
            </span>
            <span className="sr-only">{i + 1 < step ? 'Hecho: ' : `Paso ${i + 1}: `}</span>
            {label}
          </li>
        ))}
      </ol>

      <section className="space-y-3">
        <CardTitle icon={<Users className="size-6" />}>Familias</CardTitle>
        <FamiliesManager eventId={event.id} families={familyList} participants={memberList} />
      </section>

      <section className="space-y-4">
        <CardTitle icon={<UserPlus className="size-6" />}>Familiares ({memberList.length})</CardTitle>
        <AddMemberForm families={familyList} members={memberList} myRole={context.role} />
        <MembersList members={memberList} families={familyList} myRole={context.role} />
      </section>

      <section className="space-y-3">
        <CardTitle icon={<ListChecks className="size-6" />}>Checklist de preparación</CardTitle>
        <ChecklistManager eventId={event.id} families={familyList} members={memberList} />
      </section>
    </div>
  );
}
