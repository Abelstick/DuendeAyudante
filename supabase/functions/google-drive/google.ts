// Llamadas a Google (OAuth y Drive) usadas por la Edge Function google-drive.
import { HttpError } from '../_shared/http.ts';

// Se leen en cada uso (no al cargar): si se cambian los secretos, la función los toma sin quedarse con los viejos.
// Tolera nombres guardados con espacios de más (p. ej. "GOOGLE_CLIENT_ID " al pegarlo en el panel)
// y prefiere el que tenga valor si hay uno vacío con el nombre exacto.
export function env(name: string): string {
  const exact = (Deno.env.get(name) ?? '').trim();
  if (exact) return exact;
  for (const [key, value] of Object.entries(Deno.env.toObject())) {
    if (key.trim() === name && value.trim()) return value.trim();
  }
  return '';
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

/** Google vuelve aquí después de que la persona acepta (la misma función, por GET). */
export const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-drive`;

// drive.file: solo los archivos que crea la app. openid + email: saber qué cuenta se conectó.
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'];

/** Nombres de los secretos que faltan (sin mostrar sus valores). */
export function missingSecrets(): string[] {
  const missing: string[] = [];
  if (!env('GOOGLE_CLIENT_ID')) missing.push('GOOGLE_CLIENT_ID');
  if (!env('GOOGLE_CLIENT_SECRET')) missing.push('GOOGLE_CLIENT_SECRET');
  const state = env('GOOGLE_OAUTH_STATE_SECRET');
  if (!state) missing.push('GOOGLE_OAUTH_STATE_SECRET');
  else if (state.length < 32) missing.push('GOOGLE_OAUTH_STATE_SECRET (mínimo 32 caracteres)');
  return missing;
}

export function assertConfigured() {
  const missing = missingSecrets();
  if (missing.length > 0) throw new HttpError(503, 'GOOGLE_NOT_CONFIGURED', { missing });
}

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline', // para recibir el refresh token
    prompt: 'consent select_account', // siempre entrega el refresh token y deja elegir la cuenta
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  scope?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // invalid_grant = la persona quitó el acceso o el token caducó
    if (data?.error === 'invalid_grant') throw new HttpError(409, 'DRIVE_NEEDS_RECONNECT');
    console.error('google token error', res.status, data);
    throw new HttpError(502, 'GOOGLE_ERROR');
  }
  return data as TokenResponse;
}

export function exchangeCode(code: string) {
  return tokenRequest({ code, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' });
}

export async function accessTokenFrom(refreshToken: string): Promise<string> {
  const r = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
  return r.access_token;
}

export async function revoke(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => undefined);
}

export async function userEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data?.email !== 'string') throw new HttpError(502, 'GOOGLE_ERROR');
  return data.email;
}

async function drive(accessToken: string, path: string, init: RequestInit = {}, base = 'https://www.googleapis.com/drive/v3'): Promise<Response> {
  return fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) } });
}

export async function createFolder(accessToken: string, name: string): Promise<string> {
  const res = await drive(accessToken, '/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data?.id !== 'string') {
    console.error('drive folder error', res.status, data);
    throw new HttpError(502, 'DRIVE_UPLOAD_FAILED');
  }
  return data.id;
}

/** Sube la foto a la carpeta y la deja visible para quien tenga el enlace. */
export async function uploadPhoto(accessToken: string, folderId: string, name: string, file: Blob): Promise<string> {
  const boundary = `duende${crypto.randomUUID().replaceAll('-', '')}`;
  const metadata = JSON.stringify({ name, parents: [folderId] });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${file.type || 'image/jpeg'}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);
  const res = await drive(
    accessToken,
    '/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
    'https://www.googleapis.com/upload/drive/v3',
  );
  const data = await res.json().catch(() => ({}));
  if (res.status === 404) throw new HttpError(409, 'DRIVE_NEEDS_RECONNECT'); // borraron la carpeta
  if (!res.ok || typeof data?.id !== 'string') {
    console.error('drive upload error', res.status, data);
    throw new HttpError(502, 'DRIVE_UPLOAD_FAILED');
  }

  const perm = await drive(accessToken, `/files/${data.id}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
  if (!perm.ok) {
    // Sin el permiso nadie más la vería: se borra y se avisa
    console.error('drive permission error', perm.status, await perm.text().catch(() => ''));
    await deleteFile(accessToken, data.id);
    throw new HttpError(502, 'DRIVE_UPLOAD_FAILED');
  }
  return data.id;
}

/** Borra un archivo. Si ya no existe, no es error. */
export async function deleteFile(accessToken: string, fileId: string): Promise<boolean> {
  const res = await drive(accessToken, `/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  return res.ok || res.status === 404;
}
