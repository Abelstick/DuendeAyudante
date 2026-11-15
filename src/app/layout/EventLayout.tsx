import { Gift, House, Settings, UserRound } from 'lucide-react';
import { createContext, useContext } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { canManageEvent, type ChristmasEvent, type EventContext } from '@/modules/events/domain/Event';
import { useEvent, useEventContext } from '@/modules/events/presentation/hooks';
import { useFamilyTheme } from '@/modules/families/presentation/familyTheme';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { ButtonLink } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { FullPageSpinner } from './FullPageSpinner';

interface EventScope {
  event: ChristmasEvent;
  context: EventContext;
}

const EventScopeContext = createContext<EventScope | null>(null);

export function useEventScope(): EventScope {
  const scope = useContext(EventScopeContext);
  if (!scope) throw new Error('useEventScope debe usarse dentro de EventLayout');
  return scope;
}

export function EventLayout() {
  const { eventId = '' } = useParams();
  const event = useEvent(eventId);
  const context = useEventContext(eventId);
  const families = useFamilies(eventId);
  const myFamily = families.data?.find((f) => f.id === context.data?.me?.familyId);
  useFamilyTheme(myFamily?.color);

  if (event.isLoading || context.isLoading) return <FullPageSpinner />;
  if (event.error || context.error || !event.data || !context.data) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <Notice tone="error">{errorMessage(event.error ?? context.error)}</Notice>
        <ButtonLink to="/" variant="secondary" size="lg">
          Volver al inicio
        </ButtonLink>
      </div>
    );
  }

  const isManager = canManageEvent(context.data.role);
  const base = `/e/${eventId}`;
  const items = [
    { to: base, label: 'Inicio', icon: House, end: true },
    { to: `${base}/regalos`, label: 'Regalos', icon: Gift, end: false },
    ...(isManager ? [{ to: `${base}/organizar`, label: 'Organizar', icon: Settings, end: false }] : []),
    { to: `${base}/perfil`, label: 'Perfil', icon: UserRound, end: false },
  ];

  return (
    <EventScopeContext.Provider value={{ event: event.data, context: context.data }}>
      <div className="min-h-dvh pb-28 md:pb-0 md:pl-60">
        <header className="snow-bg bg-brand px-4 py-4 text-white md:hidden">
          <p className="truncate text-lg font-bold">🎄 {event.data.name}</p>
        </header>

        {/* Navegación lateral en escritorio */}
        <nav aria-label="Menú principal" className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-2 bg-brand p-4 text-white md:flex">
          <p className="mb-4 px-2 text-xl font-bold leading-tight">🎄 {event.data.name}</p>
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-xl px-3 text-lg font-semibold ${isActive ? 'bg-white text-brand' : 'hover:bg-brand-strong'}`
              }
            >
              <Icon className="size-6" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-2xl px-4 py-5">
          <Outlet />
        </main>

        {/* Barra inferior en móvil: icono + texto siempre visibles */}
        <nav
          aria-label="Menú principal"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${
                      isActive ? 'text-brand' : 'text-ink-700'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className="size-7" strokeWidth={isActive ? 2.5 : 2} aria-hidden />
                      <span>{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </EventScopeContext.Provider>
  );
}
