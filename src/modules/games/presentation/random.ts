/** Número al azar en [0, 1) con el generador seguro del navegador (sorteos justos). */
export function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 2 ** 32;
}
