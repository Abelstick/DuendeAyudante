export function formatMoney(amount: number, currency = 'PEN'): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

/** En palabras, para leer de un vistazo: 70 → '70 soles', 70.5 → '70.50 soles' (otras monedas: formato normal). */
export function formatMoneyWords(amount: number, currency = 'PEN'): string {
  if (currency !== 'PEN') return formatMoney(amount, currency);
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${n} ${amount === 1 ? 'sol' : 'soles'}`;
}

/** Acepta "45", "45.5", "45,50", "S/ 45" → 45.5. Devuelve null si está vacío; NaN si no es un número. */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/s\/|\s/gi, '').replace(',', '.');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}
