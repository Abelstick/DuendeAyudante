import { House, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { GiftBox } from '@/shared/ui/illustrations';

const RELOAD_KEY = 'duende:recarga-por-version';

/**
 * Tras publicar una versión nueva, un celular con la app abierta puede pedir
 * un archivo de la versión anterior que ya no existe. No es un error de la persona:
 * basta con recargar para traer la versión nueva.
 */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch module|ChunkLoadError/i.test(
    message,
  );
}

function readReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_KEY) === '1';
  } catch {
    return true; // sin almacenamiento: no arriesgar recargas en bucle
  }
}

function markReloaded() {
  try {
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    // sin almacenamiento
  }
}

/** Una pantalla cargó bien: se permite otra recarga automática si vuelve a pasar más adelante. */
export function clearStaleChunkReload() {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // sin almacenamiento
  }
}

/**
 * Pantalla amable cuando algo falla al mostrar una sección (en vez de la
 * página técnica en inglés de React Router). Dentro de una Navidad se ve
 * con el menú alrededor, así la persona puede ir a otra sección.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  // Sin internet, una sección que aún no se descargó falla igual que un archivo viejo: no tiene sentido recargar
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const stale = isStaleChunkError(error) && !offline;
  const autoReload = stale && !readReloaded();

  useEffect(() => {
    if (autoReload) {
      markReloaded();
      window.location.reload();
    }
  }, [autoReload]);

  useEffect(() => {
    if (!autoReload) console.error(error);
  }, [autoReload, error]);

  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const title = autoReload
    ? 'Actualizando la aplicación…'
    : offline
      ? 'Estás sin internet'
      : stale
        ? 'Hay una versión nueva'
        : notFound
          ? 'No encontramos esta página'
          : 'Algo salió mal';
  const text = autoReload
    ? 'Un momento, estamos trayendo la versión más nueva.'
    : offline
      ? 'Esta sección necesita internet la primera vez. Conéctate y toca «Volver a intentar».'
      : stale
      ? 'Toca «Volver a intentar» para cargar la versión más nueva de la aplicación.'
      : notFound
        ? 'Puede que el enlace esté incompleto. Vuelve al inicio y entra desde allí.'
        : 'No es tu culpa. Toca «Volver a intentar»; si sigue pasando, vuelve al inicio.';

  return (
    <div role="alert" className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <GiftBox tone="berry" className="w-20 motion-safe:animate-float" />
      <h1 className="text-2xl font-extrabold text-ink-900">{title}</h1>
      <p className="text-lg text-ink-700">{text}</p>
      {!autoReload && (
        <div className="flex w-full flex-col gap-2">
          <Button
            size="lg"
            onClick={() => {
              markReloaded();
              window.location.reload();
            }}
            icon={<RotateCcw className="size-6" aria-hidden />}
          >
            Volver a intentar
          </Button>
          {/* Recarga completa (no navegación interna): deja atrás el estado que falló */}
          <a
            href="/"
            className="btn-3d font-display flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-line bg-surface px-6 py-3 text-xl font-semibold text-heading"
          >
            <House className="size-6" aria-hidden />
            Ir al inicio
          </a>
        </div>
      )}
    </div>
  );
}
