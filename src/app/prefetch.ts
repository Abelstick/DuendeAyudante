/**
 * Adelanta la descarga de las secciones a las que más se entra desde el inicio
 * (Regalos, Celebración, Juegos) cuando el teléfono está desocupado, para que al
 * tocarlas abran al instante. Devuelve la función que cancela si aún no empezó.
 */
export function prefetchCommonSections(): () => void {
  const run = () => {
    void import('@/modules/wishlist/presentation/GiftsPage').catch(() => undefined);
    void import('@/modules/events/presentation/CelebrationPage').catch(() => undefined);
    void import('@/modules/games/presentation/GamesPage').catch(() => undefined);
  };
  // Con ahorro de datos activado, no se adelanta nada
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return () => undefined;

  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(run, { timeout: 5000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(run, 3000);
  return () => clearTimeout(id);
}
