import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { promptInstall, useInstallState } from './install';

const DISMISS_KEY = 'duende:install-dismissed-at';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // si dice «Ahora no», se vuelve a preguntar en 3 días

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // sin almacenamiento: se volverá a preguntar la próxima vez
  }
}

/**
 * Aviso al entrar a la app que ofrece instalarla en el celular o la computadora.
 * · Chrome/Edge/Android: abre el diálogo nativo de instalación.
 * · iPhone/iPad: explica cómo agregarla desde «Compartir».
 * No aparece si ya está instalada o si la persona eligió «Ahora no» hace poco.
 */
export function InstallPrompt() {
  const state = useInstallState();
  const [hidden, setHidden] = useState(recentlyDismissed);
  const [iosHelp, setIosHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  const visible = !hidden && (state === 'available' || state === 'ios');

  const dismiss = () => {
    rememberDismiss();
    setHidden(true);
  };

  const install = async () => {
    if (state === 'ios') {
      setIosHelp(true);
      return;
    }
    setBusy(true);
    try {
      const accepted = await promptInstall();
      if (!accepted) dismiss();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {visible && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <section
            role="dialog"
            aria-labelledby="install-title"
            className="animate-pop-in pointer-events-auto w-full max-w-md rounded-2xl border-2 border-night-900 bg-white p-4 text-ink-900 shadow-block"
          >
            <div className="flex items-start gap-3">
              <img src="/icons/icon-192.png" alt="" className="size-14 shrink-0 rounded-xl border-2 border-night-900" />
              <div className="min-w-0 flex-1">
                <h2 id="install-title" className="font-display text-lg font-bold text-night-900">
                  ¿Instalar la app en tu celular?
                </h2>
                <p className="text-base text-ink-700">Ábrela con un toque desde tu pantalla de inicio, como cualquier otra app.</p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Cerrar aviso de instalación"
                className="-mr-1 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-mist-100"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={install} loading={busy} className="flex-1" icon={<Download className="size-5" aria-hidden />}>
                Instalar app
              </Button>
              <Button variant="ghost" onClick={dismiss}>
                Ahora no
              </Button>
            </div>
          </section>
        </div>
      )}

      <Modal
        open={iosHelp}
        title="Instalar en iPhone"
        onClose={() => setIosHelp(false)}
        footer={
          <Button
            size="lg"
            onClick={() => {
              setIosHelp(false);
              dismiss();
            }}
          >
            Entendido
          </Button>
        }
      >
        <ol className="space-y-4 text-lg">
          <li className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-400 font-bold text-night-900">1</span>
            <span>
              Toca el botón <strong>Compartir</strong> <Share className="inline size-5 align-text-bottom text-sky-600" aria-label="(ícono de compartir)" /> en
              la barra de Safari.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-400 font-bold text-night-900">2</span>
            <span>
              Elige <strong>Agregar a inicio</strong> <SquarePlus className="inline size-5 align-text-bottom" aria-hidden />.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-400 font-bold text-night-900">3</span>
            <span>
              Toca <strong>Agregar</strong>. ¡Listo! Verás el arbolito 🎄 en tu pantalla de inicio.
            </span>
          </li>
        </ol>
      </Modal>
    </>
  );
}
