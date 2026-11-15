export function formatMoney(amount: number, currency = 'PEN'): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

/** Acepta "45", "45.5", "45,50", "S/ 45" → 45.5. Devuelve null si está vacío; NaN si no es un número. */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/s\/|\s/gi, '').replace(',', '.');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}
