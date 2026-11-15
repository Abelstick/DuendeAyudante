import { CalendarClock, HandPlatter, PartyPopper, Receipt, Tv, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { ExpensesSection } from '@/modules/expenses/presentation/ExpensesSection';
import { FamiliesOverview } from '@/modules/families/presentation/FamiliesOverview';
import { ResponsibilitiesSection } from '@/modules/responsibilities/presentation/ResponsibilitiesSection';
import { ScheduleSection } from '@/modules/schedule/presentation/ScheduleSection';
import { ButtonLink } from '@/shared/ui/Button';
import { PageTitle } from '@/shared/ui/Card';
import { SegmentedTabs } from '@/shared/ui/Tabs';

const TABS = [
  { value: 'aportes', label: 'Aportes y tareas', icon: <HandPlatter className="size-5" aria-hidden /> },
  { value: 'cronograma', label: 'Cronograma', icon: <CalendarClock className="size-5" aria-hidden /> },
  { value: 'cuentas', label: 'Cuentas', icon: <Receipt className="size-5" aria-hidden /> },
  { value: 'familias', label: 'Familias', icon: <Users className="size-5" aria-hidden /> },
] as const;
type Tab = (typeof TABS)[number]['value'];

/** Celebración: quién lleva qué, el cronograma del día, las cuentas y las familias. */
export function CelebrationPage() {
  const { event } = useEventScope();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.some((t) => t.value === params.get('vista')) ? (params.get('vista') as Tab) : 'aportes';

  return (
    <div className="space-y-5">
      <PageTitle icon={<PartyPopper className="size-8" aria-hidden />} title="Celebración" subtitle="Quién lleva qué, los horarios, las cuentas y las familias" />

      <SegmentedTabs
        label="Secciones de la celebración"
        value={tab}
        options={TABS}
        onChange={(value) => setParams(value === 'aportes' ? {} : { vista: value }, { replace: true, preventScrollReset: true })}
      />

      <div role="tabpanel" key={tab} className="animate-rise space-y-5">
        {tab === 'aportes' && <ResponsibilitiesSection />}
        {tab === 'cronograma' && (
          <>
            <ScheduleSection />
            <ButtonLink to={`/e/${event.id}/tv`} variant="secondary" icon={<Tv className="size-5" aria-hidden />}>
              Ver en la tele (pantalla grande)
            </ButtonLink>
          </>
        )}
        {tab === 'cuentas' && <ExpensesSection />}
        {tab === 'familias' && <FamiliesOverview />}
      </div>
    </div>
  );
}
