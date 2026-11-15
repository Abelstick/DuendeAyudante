import { useEventScope } from '@/app/layout/EventLayout';
import { displayName } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { useResponsibilities } from '@/modules/responsibilities/presentation/hooks';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/modules/responsibilities/domain/Responsibility';
import { Spinner } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/Card';
import { FAMILY_COLORS, FAMILY_THEMES } from '../domain/Family';
import { useFamilies } from './hooks';

/** Tarjetas de cada familia: color, vestimenta, integrantes y lo que aporta. */
export function FamiliesOverview() {
  const { event, context } = useEventScope();
  const families = useFamilies(event.id);
  const participants = useParticipants(event.id);
  const responsibilities = useResponsibilities(event.id);

  if (families.isLoading || participants.isLoading) return <Spinner label="Cargando familias…" />;
  const list = families.data ?? [];
  if (list.length === 0) return <EmptyState emoji="👨‍👩‍👧‍👦" title="Todavía no hay familias." />;

  const people = participants.data ?? [];

  return (
    <div className="stagger grid gap-4 sm:grid-cols-2">
      {list.map((f) => {
        const color = FAMILY_COLORS[f.color];
        const members = people.filter((p) => p.familyId === f.id);
        const memberIds = members.map((m) => m.id);
        const contributions = (responsibilities.data ?? []).filter(
          (r) => r.familyIds.includes(f.id) || r.participantIds.some((id) => memberIds.includes(id)),
        );
        const isMine = context.me?.familyId === f.id;
        return (
          <article key={f.id} className={`overflow-hidden rounded-2xl border-[3px] border-night-900 bg-white ${isMine ? 'shadow-[0_5px_0_0_var(--color-gold-400)]' : 'shadow-block'}`}>
            <header className="snow-bg border-b-[3px] border-night-900 px-4 py-3 text-white" style={{ backgroundColor: FAMILY_THEMES[f.color].strong }}>
              <h3 className="text-xl font-black">Familia {f.name}</h3>
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                Color: {color.label}
                {isMine && <span className="rounded-full bg-gold-400 px-2.5 py-0.5 font-black text-night-900">⭐ Tu familia</span>}
              </p>
            </header>
            <div className="space-y-3 p-4">
              {f.dressCodeNote && <p className="text-base">👕 Vestimenta: <strong>{f.dressCodeNote}</strong></p>}
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-ink-500">Integrantes ({members.length})</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {members.map((m) => (
                    <li key={m.id} className="rounded-full px-3 py-1 text-sm font-bold" style={{ backgroundColor: color.soft, color: color.text }}>
                      {displayName(m)}
                    </li>
                  ))}
                </ul>
              </div>
              {contributions.length > 0 && (
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-ink-500">Aportes y tareas</p>
                  <ul className="mt-1 space-y-1">
                    {contributions.map((r) => (
                      <li key={r.id} className="text-base">
                        <span aria-hidden>{CATEGORY_LABELS[r.category].emoji}</span> {r.title}{' '}
                        <span className="text-sm text-ink-700">
                          ({STATUS_LABELS[r.status].emoji} {STATUS_LABELS[r.status].label.toLowerCase()})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
