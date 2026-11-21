/* Elige el modo claro u oscuro ANTES de pintar la página, para que no destelle en blanco de noche.
 * Es un archivo aparte (no un <script> dentro del HTML) porque la política de seguridad solo
 * permite scripts propios. Debe coincidir con src/shared/ui/colorScheme.ts (clave y valores). */
(function () {
  var preference = 'system';
  try {
    preference = localStorage.getItem('nf-color-scheme') || 'system';
  } catch (e) {
    /* modo privado */
  }
  var dark =
    preference === 'dark' ||
    (preference !== 'light' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
