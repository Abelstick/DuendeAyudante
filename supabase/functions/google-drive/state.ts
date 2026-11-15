// "state" del OAuth firmado con HMAC: Google lo devuelve tal cual y así sabemos,
// sin guardar nada, qué familia conectar, quién lo pidió y a dónde volver.
import { HttpError } from '../_shared/http.ts';
import { env } from './google.ts';

export interface OAuthState {
  /** null = Drive general de la celebración. */
  familyId: string | null;
  eventId: string;
  userId: string;
  /** Origen de la app a donde volver (ya validado contra APP_ORIGINS). */
  origin: string;
  /** Vence en (ms desde 1970). */
  exp: number;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromB64url(text: string): Uint8Array {
  const b64 = text.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

async function key(): Promise<CryptoKey> {
  const secret = env('GOOGLE_OAUTH_STATE_SECRET');
  if (secret.length < 32) {
    throw new HttpError(503, 'GOOGLE_NOT_CONFIGURED', {
      missing: [secret ? 'GOOGLE_OAUTH_STATE_SECRET (mínimo 32 caracteres)' : 'GOOGLE_OAUTH_STATE_SECRET'],
    });
  }
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signState(state: OAuthState): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(state)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

/** Devuelve el estado si la firma es válida y no venció; si no, null. */
export async function verifyState(raw: string): Promise<OAuthState | null> {
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(), fromB64url(sig), enc.encode(payload));
    if (!ok) return null;
    const state = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as OAuthState;
    return state.exp > Date.now() ? state : null;
  } catch {
    return null;
  }
}
