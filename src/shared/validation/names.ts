/**
 * Reglas de nombres compartidas por toda la app. La base de datos aplica las
 * mismas reglas (app.normalize_name / app.is_valid_person_name): aquí sirven
 * para mostrar mensajes claros antes de enviar.
 */

/** "  hUGo   garcía " → "HUGO GARCÍA". Conserva tildes y Ñ. */
export function normalizeName(raw: string | null | undefined): string {
  return (raw ?? '')
    .normalize('NFC')
    .replace(/[\s ]+/g, ' ')
    .trim()
    .toLocaleUpperCase('es-PE');
}

const VALID_PERSON_NAME = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;

export function isValidPersonName(value: string): boolean {
  const normalized = normalizeName(value);
  return normalized.length >= 1 && normalized.length <= 60 && VALID_PERSON_NAME.test(normalized);
}

export function fullName(first: string, paternal: string, maternal?: string | null): string {
  return [first, paternal, maternal].map(normalizeName).filter(Boolean).join(' ');
}

/** "ROSA MARÍA" → "Rosa María" (solo para saludos). */
export function toTitleCase(value: string): string {
  return value.toLocaleLowerCase('es-PE').replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('es-PE'));
}

/** Quita tildes y caracteres no permitidos para armar usuarios. */
function slugPart(value: string): string {
  return normalizeName(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,29}$/;

/**
 * Usuario corto y único dentro de la Navidad:
 * "rosa" → si ya existe, "rosa.garcia" → si también, "rosa2", "rosa3"…
 */
export function suggestUsername(firstName: string, paternalSurname: string, taken: ReadonlySet<string> = new Set()): string {
  const first = slugPart(firstName.split(/\s+/)[0] ?? '').slice(0, 20);
  const last = slugPart(paternalSurname.split(/\s+/)[0] ?? '').slice(0, 9);
  const base = first.length >= 2 ? first : `${first}${last}`.slice(0, 20) || 'familiar';
  const candidates = [base, last && base !== last ? `${base}.${last}` : ''].filter((c) => USERNAME_PATTERN.test(c));
  const free = candidates.find((c) => !taken.has(c));
  if (free) return free;
  for (let i = 2; i < 100; i++) {
    if (!taken.has(`${base}${i}`)) return `${base}${i}`;
  }
  return base;
}

// ---------------------------------------------------------------------
// Código de la Navidad (lo elige el organizador; los familiares lo usan para entrar)
// ---------------------------------------------------------------------

export const JOIN_CODE_PATTERN = /^[A-Z0-9]{4,20}$/;

/** "garcía 25" → "GARCIA25": mayúsculas, sin tildes, solo letras y números. */
export function normalizeJoinCode(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

const JOIN_CODE_STOPWORDS = new Set(['NAVIDAD', 'EN', 'FAMILIA', 'FAMILIAR', 'LA', 'EL', 'DE', 'DEL', 'LOS', 'LAS', 'Y', 'NUESTRA', 'MI']);

/** "Navidad Familia García 2026" → "GARCIA26". */
export function suggestJoinCode(eventName: string, year: number = new Date().getFullYear()): string {
  const words = normalizeName(eventName)
    .split(' ')
    .map(normalizeJoinCode)
    .filter((w) => w && !/^\d+$/.test(w) && !JOIN_CODE_STOPWORDS.has(w));
  const core = (words.join('') || 'NAVIDAD').slice(0, 14);
  return `${core}${String(year).slice(-2)}`;
}

/** Lo que el usuario escribe al iniciar sesión → usuario canónico. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '');
}

const PASSWORD_WORDS = [
  'estrella', 'regalo', 'campana', 'turron', 'lucero', 'paneton', 'nevada', 'galleta',
  'pesebre', 'guirnalda', 'villancico', 'chocolate', 'angelito', 'reyes', 'pinito', 'bombon',
  'muerdago', 'trineo', 'canela', 'vela', 'brindis', 'familia', 'alegria', 'cometa',
  'ponche', 'renito', 'copito', 'cascabel', 'farolito', 'abrazo', 'sorpresa', 'navidad',
];

function randomInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) % max;
}

/**
 * Contraseña fácil de dictar por teléfono: palabra navideña + 4 números
 * (ej. "estrella4821"). Siempre tiene 8 caracteres o más.
 */
export function generateFriendlyPassword(): string {
  const word = PASSWORD_WORDS[randomInt(PASSWORD_WORDS.length)] ?? 'navidad';
  const digits = String(randomInt(10000)).padStart(4, '0');
  return `${word}${digits}`;
}
