import { PartyPopper } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { FamiliesOverview } from '@/modules/families/presentation/FamiliesOverview';
import { ResponsibilitiesSection } from '@/modules/responsibilities/presentation/ResponsibilitiesSection';
import { ScheduleSection } from '@/modules/schedule/presentation/ScheduleSection';
import { PageTitle } from '@/shared/ui/Card';

const TABS = [
  { key: 'aportes', label: 'Aportes y tareas' },
  { key: 'cronograma', label: 'Cronograma' },
  { key: 'familias', label: 'Familias' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/** Celebración: quién lleva qué, el cronograma del día y las familias. */
export function CelebrationPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.some((t) => t.key === params.get('vista')) ? (params.get('vista') as Tab) : 'aportes';

  return (
    <div className="space-y-5">
      <PageTitle icon={<PartyPopper className="size-8 text-brand" aria-hidden />} title="Celebración" />

      <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-cream-200 p-1.5" role="tablist" aria-label="Secciones de la celebración">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setParams(t.key === 'aportes' ? {} : { vista: t.key }, { replace: true })}
            className={`min-h-13 rounded-xl px-1 text-sm font-bold leading-tight sm:text-base ${tab === t.key ? 'bg-white text-brand shadow' : 'text-ink-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'aportes' && <ResponsibilitiesSection />}
        {tab === 'cronograma' && <ScheduleSection />}
        {tab === 'familias' && <FamiliesOverview />}
      </div>
    </div>
  );
}
