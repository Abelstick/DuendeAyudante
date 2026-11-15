import { Dices, Gift, House, PanelLeftClose, PanelLeftOpen, PartyPopper, Settings, UserRound } from 'lucide-react';
import { motion } from 'motion/react';
import { createContext, Suspense, useContext, useEffect, useState, type CSSProperties } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { canManageEvent, type ChristmasEvent, type EventContext } from '@/modules/events/domain/Event';
import { useEvent, useEventContext } from '@/modules/events/presentation/hooks';
import { useFamilyTheme } from '@/modules/families/presentation/familyTheme';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { ButtonLink } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { playSound } from '@/shared/lib/sound';
import { Garland, SnowBackdrop } from '@/shared/ui/Ambience';
import { Snowfall, Tree, WinterScene } from '@/shared/ui/illustrations';
import { SoundToggle } from '@/shared/ui/SoundToggle';
import { prefetchCommonSections } from '../prefetch';
import { FullPageSpinner } from './FullPageSpinner';
import { Spinner } from '@/shared/ui/Button';

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
  const { pathname } = useLocation();
  const event = useEvent(eventId);
  const context = useEventContext(eventId);
  const families = useFamilies(eventId);
  const myFamily = families.data?.find((f) => f.id === context.data?.me?.familyId);
  useFamilyTheme(myFamily?.color);
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);

  // Con el teléfono libre, adelanta las secciones más visitadas
  useEffect(() => prefetchCommonSections(), []);

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
      <SnowBackdrop />
      <div
        className={`relative z-10 min-h-dvh pb-[calc(6.5rem+env(safe-area-inset-bottom))] transition-[padding] duration-200 md:pb-0 ${collapsed ? 'md:pl-24' : 'md:pl-64'}`}
        // Ancho del menú lateral: las tablas lo usan para saber cuánto pueden ensancharse en escritorio
        style={{ '--nf-side': collapsed ? '6rem' : '16rem' } as CSSProperties}
      >
        {/* Encabezado móvil: nombre de la Navidad + acceso a Organizar (solo quien administra) */}
        <header className="sky-bg snow-bg snow-cap flex items-center justify-between gap-2 px-4 pb-6 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white md:hidden">
          <Link to={base} className="flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl">
            <Tree className="h-10 w-auto shrink-0" />
            <span className="font-display line-clamp-2 min-w-0 text-lg font-extrabold leading-tight">{event.data.name}</span>
          </Link>
          {isManager && (
            <Link
              to={`${base}/organizar`}
              className="btn-3d font-display flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border-2 border-night-900 bg-gold-400 px-3 text-base font-semibold text-night-900 [--btn-edge:#000] hover:bg-gold-300"
            >
              <Settings className="size-5" aria-hidden />
              Organizar
            </Link>
          )}
        </header>
        {/* Luces de colores bajo el encabezado */}
        <Garland count={8} className="-mt-1 md:hidden" />
        <Garland count={16} className="hidden md:block" />

        {/* Navegación lateral en escritorio: se puede plegar (sigue mostrando icono + texto) */}
        <nav
          aria-label="Menú principal"
          className={`sky-bg snow-bg fixed inset-y-0 left-0 z-30 hidden flex-col gap-2 overflow-hidden border-r-2 border-night-900 text-white transition-[width] duration-200 md:flex ${
            collapsed ? 'w-24 p-2' : 'w-64 p-4'
          }`}
        >
          {/* Dentro del menú también nieva, sobre un paisaje al pie */}
          <Snowfall fall={900} />
          <WinterScene className="h-24" />
          {collapsed ? (
            <p className="mb-4 mt-2 flex justify-center" title={event.data.name} aria-hidden>
              <Tree className="h-12 w-auto" />
            </p>
          ) : (
            <p className="font-display mb-4 mt-2 flex items-center gap-3 px-2 text-xl font-extrabold leading-tight">
              <Tree className="h-12 w-auto shrink-0" />
              <span className="min-w-0">{event.data.name}</span>
            </p>
          )}
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => playSound('tap')}
              className={({ isActive }) =>
                `font-display relative flex rounded-[10px] border-2 font-bold transition-colors ${
                  collapsed ? 'min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs' : 'min-h-13 items-center gap-3 px-4 text-lg'
                } ${isActive ? 'border-night-900 bg-gold-400 text-night-900 shadow-[0_4px_0_0_#000]' : 'border-transparent text-white hover:bg-white/15'}`
              }
            >
              <Icon className={collapsed ? 'size-7' : 'size-6'} aria-hidden />
              {label}
            </NavLink>
          ))}
          <SoundToggle
            compact={collapsed}
            className={`relative mt-auto flex rounded-[10px] font-semibold text-white/90 transition-colors hover:bg-white/15 ${
              collapsed ? 'min-h-16 flex-col items-center justify-center gap-1 px-1 text-center text-xs' : 'min-h-12 items-center gap-3 px-4 text-base'
            }`}
          />
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={!collapsed}
            className={`relative mb-20 flex rounded-[10px] font-semibold text-white/90 transition-colors hover:bg-white/15 ${
              collapsed ? 'min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs' : 'min-h-12 items-center gap-3 px-4 text-base'
            }`}
          >
            {collapsed ? <PanelLeftOpen className="size-6" aria-hidden /> : <PanelLeftClose className="size-6" aria-hidden />}
            {collapsed ? 'Mostrar menú' : 'Ocultar menú'}
          </button>
        </nav>

        {/* `key`: cada sección entra deslizándose con un pequeño rebote */}
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="mx-auto w-full max-w-2xl px-4 py-4 md:py-6"
        >
          {/* La sección se descarga al abrirla; mientras tanto el menú sigue visible */}
          <Suspense fallback={<Spinner label="Cargando…" />}>
            <Outlet />
          </Suspense>
        </motion.main>

        {/* Barra inferior en móvil: icono + texto siempre visibles */}
        <nav
          aria-label="Menú principal"
          className="hide-with-keyboard fixed inset-x-0 bottom-0 z-40 border-t-2 border-night-900 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="mx-auto grid max-w-2xl px-1" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}>
            {mobileItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => playSound('tap')}
                  className={({ isActive }) =>
                    `group font-display flex min-h-[4.5rem] flex-col items-center justify-center gap-1 px-0.5 text-center text-xs leading-tight ${
                      isActive ? 'font-extrabold text-night-900' : 'font-semibold text-ink-700'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex h-9 w-14 items-center justify-center rounded-xl border-2 group-active:translate-y-0.5 ${
                          isActive ? 'animate-hop border-night-900 bg-brand text-white shadow-[0_3px_0_0_var(--color-night-900)]' : 'border-transparent'
                        }`}
                      >
                        <Icon className="size-6" strokeWidth={isActive ? 2.5 : 2} aria-hidden />
                      </span>
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
