import { Dices, Gift, House, PanelLeftClose, PanelLeftOpen, PartyPopper, Settings, UserRound } from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
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

const SIDEBAR_KEY = 'nf-sidebar-collapsed';

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

function saveSidebarCollapsed(value: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, value ? '1' : '0');
  } catch {
    // modo privado: se recuerda solo en esta visita
  }
}

export function EventLayout() {
  const { eventId = '' } = useParams();
  const event = useEvent(eventId);
  const context = useEventContext(eventId);
  const families = useFamilies(eventId);
  const myFamily = families.data?.find((f) => f.id === context.data?.me?.familyId);
  useFamilyTheme(myFamily?.color);
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      saveSidebarCollapsed(!prev);
      return !prev;
    });
  };

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
    { to: `${base}/juegos`, label: 'Juegos', icon: Dices, end: false },
    { to: `${base}/celebracion`, label: 'Celebración', icon: PartyPopper, end: false },
    ...(isManager ? [{ to: `${base}/organizar`, label: 'Organizar', icon: Settings, end: false }] : []),
    { to: `${base}/perfil`, label: 'Perfil', icon: UserRound, end: false },
  ];

  // En el celular, "Organizar" va en el encabezado para no saturar la barra inferior
  const mobileItems = items.filter((i) => !i.to.endsWith('/organizar'));

  return (
    <EventScopeContext.Provider value={{ event: event.data, context: context.data }}>
      <div className={`min-h-dvh pb-28 transition-[padding] duration-200 md:pb-0 ${collapsed ? 'md:pl-24' : 'md:pl-60'}`}>
        <header className="snow-bg flex items-center justify-between gap-2 bg-brand px-4 py-3 text-white md:hidden">
          <p className="min-w-0 truncate text-lg font-bold">🎄 {event.data.name}</p>
          {isManager && (
            <Link
              to={`${base}/organizar`}
              className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-base font-semibold hover:bg-white/25"
            >
              <Settings className="size-5" aria-hidden />
              Organizar
            </Link>
          )}
        </header>

        {/* Navegación lateral en escritorio: se puede plegar (sigue mostrando icono + texto) */}
        <nav
          aria-label="Menú principal"
          className={`fixed inset-y-0 left-0 hidden flex-col gap-2 bg-brand text-white transition-[width] duration-200 md:flex ${
            collapsed ? 'w-24 p-2' : 'w-60 p-4'
          }`}
        >
          {collapsed ? (
            <p className="mb-4 text-center text-3xl" title={event.data.name} aria-hidden>
              🎄
            </p>
          ) : (
            <p className="mb-4 px-2 text-xl font-bold leading-tight">🎄 {event.data.name}</p>
          )}
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex rounded-xl font-semibold ${
                  collapsed ? 'min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs' : 'min-h-12 items-center gap-3 px-3 text-lg'
                } ${isActive ? 'bg-white text-brand' : 'hover:bg-brand-strong'}`
              }
            >
              <Icon className={collapsed ? 'size-7' : 'size-6'} aria-hidden />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={!collapsed}
            className={`mt-auto flex rounded-xl font-semibold text-white/90 hover:bg-brand-strong ${
              collapsed ? 'min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs' : 'min-h-12 items-center gap-3 px-3 text-base'
            }`}
          >
            {collapsed ? <PanelLeftOpen className="size-6" aria-hidden /> : <PanelLeftClose className="size-6" aria-hidden />}
            {collapsed ? 'Mostrar menú' : 'Ocultar menú'}
          </button>
        </nav>

        <main className="mx-auto w-full max-w-2xl px-4 py-5">
          <Outlet />
        </main>

        {/* Barra inferior en móvil: icono + texto siempre visibles */}
        <nav
          aria-label="Menú principal"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}>
            {mobileItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex min-h-16 flex-col items-center justify-center gap-0.5 px-0.5 text-center text-xs font-semibold leading-tight ${
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
