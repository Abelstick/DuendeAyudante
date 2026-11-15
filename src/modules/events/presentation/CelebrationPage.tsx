import { CalendarClock, HandPlatter, PartyPopper, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { FamiliesOverview } from '@/modules/families/presentation/FamiliesOverview';
import { ResponsibilitiesSection } from '@/modules/responsibilities/presentation/ResponsibilitiesSection';
import { ScheduleSection } from '@/modules/schedule/presentation/ScheduleSection';
import { PageTitle } from '@/shared/ui/Card';
import { SegmentedTabs } from '@/shared/ui/Tabs';

const TABS = [
  { value: 'aportes', label: 'Aportes y tareas', icon: <HandPlatter className="size-5" aria-hidden /> },
  { value: 'cronograma', label: 'Cronograma', icon: <CalendarClock className="size-5" aria-hidden /> },
  { value: 'familias', label: 'Familias', icon: <Users className="size-5" aria-hidden /> },
] as const;
type Tab = (typeof TABS)[number]['value'];

/** Celebración: quién lleva qué, el cronograma del día y las familias. */
export function CelebrationPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.some((t) => t.value === params.get('vista')) ? (params.get('vista') as Tab) : 'aportes';

  return (
    <div className="space-y-5">
      <PageTitle icon={<PartyPopper className="size-8" aria-hidden />} title="Celebración" subtitle="Quién lleva qué, los horarios y las familias" />

      <SegmentedTabs
        label="Secciones de la celebración"
        value={tab}
        options={TABS}
        onChange={(value) => setParams(value === 'aportes' ? {} : { vista: value }, { replace: true })}
      />

      <div role="tabpanel" key={tab} className="animate-rise">
        {tab === 'aportes' && <ResponsibilitiesSection />}
        {tab === 'cronograma' && <ScheduleSection />}
        {tab === 'familias' && <FamiliesOverview />}
      </div>
    </div>
  );
}
