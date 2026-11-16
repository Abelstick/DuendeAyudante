/**
 * Guías paso a paso (driver.js). Nunca empiezan solas: siempre las abre la persona
 * con un botón de ayuda (ver TourButton). La librería se descarga recién al pedir
 * la guía, para no cargar a quien no la necesita.
 */
export interface TourStep {
  /** Valor de `data-tour` del elemento a resaltar. Sin `target`, el paso sale al centro. */
  target?: string;
  title: string;
  text: string;
  /** Si el elemento no está en pantalla: saltar el paso (por defecto) o mostrarlo al centro. */
  whenMissing?: 'skip' | 'center';
}

/** El elemento visible con ese `data-tour` (el menú existe dos veces: celular y escritorio). */
function findVisible(target: string): Element | undefined {
  return Array.from(document.querySelectorAll(`[data-tour="${target}"]`)).find((el) => el.getClientRects().length > 0);
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Abre la guía y devuelve cómo cerrarla (p. ej. si la persona cambia de pantalla). */
export async function startTour(steps: TourStep[]): Promise<() => void> {
  const [{ driver }] = await Promise.all([import('driver.js'), import('driver.js/dist/driver.css')]);
  // Deja que la pantalla termine de acomodarse (p. ej. si se cambió de pestaña antes de empezar)
  await nextFrame();
  await nextFrame();

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const resolved = steps.flatMap((step) => {
    const element = step.target ? findVisible(step.target) : undefined;
    if (step.target && !element && step.whenMissing !== 'center') return [];
    return [{ element, popover: { title: step.title, description: step.text } }];
  });

  const tour = driver({
    steps: resolved,
    animate: !reducedMotion,
    smoothScroll: !reducedMotion,
    allowClose: true,
    // Durante la guía solo se mira: así nadie sale de la pantalla por tocar sin querer
    disableActiveInteraction: true,
    overlayColor: '#0f1e38',
    overlayOpacity: 0.72,
    stagePadding: 6,
    stageRadius: 12,
    popoverClass: 'duende-tour',
    showProgress: true,
    progressText: 'Paso {{current}} de {{total}}',
    nextBtnText: 'Siguiente',
    prevBtnText: 'Atrás',
    doneBtnText: '¡Entendido!',
    closeBtnLabel: 'Cerrar la guía',
  });
  tour.drive();
  return () => tour.destroy();
}
