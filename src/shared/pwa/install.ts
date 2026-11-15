import { useSyncExternalStore } from 'react';

/** Evento no estándar de Chrome/Edge/Android para ofrecer la instalación. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/**
 * Se llama una sola vez, antes de montar React: el navegador dispara
 * `beforeinstallprompt` muy pronto y hay que guardarlo para usarlo al tocar el botón.
 */
export function setupPwa() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // usamos nuestro propio aviso
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // sin service worker la app funciona igual, solo no se puede instalar/usar sin conexión
      });
    });
  }
}

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad en Safari: no hay botón automático, se instala desde «Compartir». */
export function isIos() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export type InstallState =
  | { kind: 'installed' }
  | { kind: 'available' } // Chrome/Edge/Android: se puede abrir el diálogo nativo
  | { kind: 'ios' } // hay que explicar los pasos
  | { kind: 'unavailable' };

function snapshot(): InstallState['kind'] {
  if (installed || isStandalone()) return 'installed';
  if (deferred) return 'available';
  if (isIos()) return 'ios';
  return 'unavailable';
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useInstallState(): InstallState['kind'] {
  return useSyncExternalStore(subscribe, snapshot, () => 'unavailable');
}

/** Abre el diálogo nativo de instalación. Devuelve true si la persona aceptó. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null; // el evento solo se puede usar una vez
  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome === 'accepted';
}
