/**
 * Teclado virtual en celulares.
 *
 * Por defecto, al abrirse el teclado los navegadores solo achican el "visual
 * viewport": lo que está fijo abajo (la barra de menú, las ventanas que suben
 * desde abajo, los avisos) queda tapado por el teclado. Esto:
 *  · publica en <html data-keyboard="open"> si se está escribiendo (para ocultar la barra inferior);
 *  · publica en --kb-inset cuántos píxeles tapa el teclado (para subir ventanas y avisos);
 *  · si el campo donde se escribe quedó tapado, lo trae a la vista.
 * Funciona igual en iOS (que no soporta interactive-widget) y Android.
 */

const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'date',
  'datetime-local',
  'file',
  'hidden',
  'image',
  'month',
  'radio',
  'range',
  'reset',
  'submit',
  'time',
  'week',
]);

/** ¿Este elemento abre el teclado al enfocarlo? (las fechas y horas abren su propio selector) */
export function isTextEntry(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type) && !el.readOnly && !el.disabled;
  return el instanceof HTMLElement && el.isContentEditable;
}

/** Cuánto del fondo de la pantalla tapa el teclado (0 si no tapa nada o si el navegador ya achicó la página). */
export function keyboardInset(layoutHeight: number, visual: { height: number; offsetTop: number }): number {
  const inset = layoutHeight - visual.height - visual.offsetTop;
  // Menos de 80 px son barras del navegador que aparecen y desaparecen, no el teclado
  return inset > 80 ? Math.round(inset) : 0;
}

/** El siguiente campo de texto del mismo formulario (para que «Siguiente» pase de campo en campo). */
export function nextTextField(current: HTMLElement): HTMLElement | null {
  const form = current.closest('form');
  if (!form) return null;
  const fields = Array.from(form.elements).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && isTextEntry(el) && el.offsetParent !== null,
  );
  const i = fields.indexOf(current);
  return i >= 0 ? (fields[i + 1] ?? null) : null;
}

const isTouchDevice = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

export function installKeyboardTracking(): void {
  if (typeof window === 'undefined' || !isTouchDevice()) return;
  const root = document.documentElement;
  const vv = window.visualViewport;

  const ensureVisible = () => {
    const el = document.activeElement;
    if (!isTextEntry(el) || !(el instanceof HTMLElement)) return;
    const rect = el.getBoundingClientRect();
    const visibleTop = vv?.offsetTop ?? 0;
    const visibleBottom = visibleTop + (vv?.height ?? window.innerHeight);
    // Solo si de verdad quedó tapado: no pelear con el desplazamiento propio del navegador
    if (rect.bottom > visibleBottom - 8 || rect.top < visibleTop) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  let frame = 0;
  let lastInset = 0;
  // Traer el campo a la vista solo al enfocarlo o cuando el teclado recién aparece/crece.
  // Nunca mientras la persona desplaza la pantalla (en iOS eso mueve la vista y la "devolvería" al campo).
  let revealOnNextFrame = false;
  const update = (reveal = false) => {
    revealOnNextFrame ||= reveal;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const typing = isTextEntry(document.activeElement);
      const inset = typing && vv ? keyboardInset(window.innerHeight, vv) : 0;
      root.style.setProperty('--kb-inset', `${inset}px`);
      if (typing) root.dataset.keyboard = 'open';
      else delete root.dataset.keyboard;
      const keyboardGrew = inset > lastInset + 80;
      lastInset = inset;
      if (typing && (revealOnNextFrame || keyboardGrew)) ensureVisible();
      revealOnNextFrame = false;
    });
  };

  let blurTimer = 0;
  document.addEventListener('focusin', () => {
    clearTimeout(blurTimer);
    update(true);
  });
  // Al pasar de un campo a otro hay un instante sin foco: esperar evita que la barra parpadee
  document.addEventListener('focusout', () => {
    clearTimeout(blurTimer);
    blurTimer = window.setTimeout(() => update(), 120);
  });
  vv?.addEventListener('resize', () => update());
  vv?.addEventListener('scroll', () => update());
}

/** Para buscadores que filtran mientras se escribe: Enter solo cierra el teclado para ver los resultados. */
export function closeKeyboardOnEnter(e: { key: string; nativeEvent: KeyboardEvent; currentTarget: HTMLElement; preventDefault: () => void }): void {
  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
  e.preventDefault();
  e.currentTarget.blur();
}
