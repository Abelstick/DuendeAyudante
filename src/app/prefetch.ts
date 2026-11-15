/**
 * Pantallas poco frecuentes: se descargan aparte para que la primera visita pese
 * menos. Las rutas y la precarga usan las mismas funciones, así el navegador
 * reutiliza la descarga.
 */
export const RARE_PAGES = {
  signUp: () => import('@/modules/accounts/presentation/SignUpPage'),
  recover: () => import('@/modules/accounts/presentation/RecoverPage'),
  newPassword: () => import('@/modules/accounts/presentation/NewPasswordPage'),
  createEvent: () => import('@/modules/events/presentation/CreateEventPage'),
  myEvents: () => import('@/modules/events/presentation/MyEventsPage'),
  recap: () => import('@/modules/events/presentation/RecapPage'),
  tv: () => import('@/modules/events/presentation/TvPage'),
  organize: () => import('@/modules/admin/presentation/OrganizePage'),
  announcements: () => import('@/modules/announcements/presentation/AnnouncementsPage'),
  messages: () => import('@/modules/messages/presentation/MessagesPage'),
};

/**
 * Ya dentro de una Navidad, adelanta en segundo plano las secciones que se abren
 * desde el inicio (y Organizar, para quien administra), cuando el teléfono está
 * desocupado, para que también abran al instante. Devuelve cómo cancelarlo.
 */
export function prefetchEventSections(isManager: boolean): () => void {
  // Con ahorro de datos activado, no se adelanta nada
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return () => undefined;

  const run = () => {
    const loads = [RARE_PAGES.messages, RARE_PAGES.announcements, RARE_PAGES.recap, ...(isManager ? [RARE_PAGES.organize] : [])];
    for (const load of loads) void load().catch(() => undefined);
  };
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(run, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(run, 2500);
  return () => clearTimeout(id);
}
