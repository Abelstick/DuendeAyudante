// Edge Function: Google Drive para las fotos de los regalos.
// Puede haber un Drive general de la celebración y/o uno por familia.
// Al subir, se usa el de la familia de la persona si funciona; si no, el general.
//
//  POST (con sesión, JSON):
//    { action: 'auth-url',   familyId } | { action: 'auth-url',   eventId } → organizador/admin: enlace para conectar
//    { action: 'disconnect', familyId } | { action: 'disconnect', eventId } → organizador/admin: desconecta
//    { action: 'delete-photo', photoId } → quien puede cambiar el regalo
//  POST (con sesión, multipart): itemId + file → sube una foto
//  GET  ?code&state → Google vuelve aquí; guarda la conexión y regresa a la app
//
// verify_jwt = false porque Google llama por GET sin sesión; los POST verifican la sesión aquí.
import { handler, HttpError, isAllowedOrigin, readJson, requireUuid } from '../_shared/http.ts';
import { adminClient, audit, getCallerId, getRole, userClient } from '../_shared/supabase.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import * as google from './google.ts';
import { signState, verifyState } from './state.ts';

const MAX_PHOTOS = 6;
const MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const STATE_TTL_MS = 15 * 60 * 1000;
const FALLBACK_APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '');

/** Dónde se guardan las fotos: el Drive de una familia o el general de la celebración. */
type Target = { kind: 'family'; familyId: string; eventId: string } | { kind: 'event'; eventId: string };

interface DriveRow {
  target: Target;
  refreshToken: string;
  folderId: string;
  needsReconnect: boolean;
}

const tableOf = (t: Target) => (t.kind === 'family' ? 'family_drives' : 'event_drives');
const keyOf = (t: Target): [string, string] => (t.kind === 'family' ? ['family_id', t.familyId] : ['event_id', t.eventId]);

/** Verifica que quien llama administre la celebración y arma el destino. */
async function requireManagerTarget(admin: SupabaseClient, callerId: string, body: { familyId?: unknown; eventId?: unknown }) {
  let target: Target;
  let label: string;
  let eventName: string;
  if (body.familyId !== undefined) {
    const familyId = requireUuid(body.familyId, 'familyId');
    const { data: family, error } = await admin.from('families').select('id, name, event_id, events!inner(name)').eq('id', familyId).maybeSingle();
    if (error) throw error;
    if (!family) throw new HttpError(404, 'NOT_FOUND');
    target = { kind: 'family', familyId, eventId: family.event_id };
    eventName = (family.events as unknown as { name: string }).name;
    label = `Familia ${family.name}`;
  } else {
    const eventId = requireUuid(body.eventId, 'eventId');
    const { data: event, error } = await admin.from('events').select('id, name').eq('id', eventId).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    if (!event) throw new HttpError(404, 'NOT_FOUND');
    target = { kind: 'event', eventId };
    eventName = event.name;
    label = 'Todas las familias';
  }
  const role = await getRole(admin, target.eventId, callerId);
  if (role !== 'owner' && role !== 'admin') throw new HttpError(403, 'FORBIDDEN');
  return { target, folderName: `Duende Ayudante · ${eventName} · ${label}` };
}

async function getDrive(admin: SupabaseClient, target: Target): Promise<DriveRow | null> {
  const [col, key] = keyOf(target);
  const { data, error } = await admin.from(tableOf(target)).select('refresh_token, folder_id, needs_reconnect').eq(col, key).maybeSingle();
  if (error) throw error;
  return data ? { target, refreshToken: data.refresh_token, folderId: data.folder_id, needsReconnect: data.needs_reconnect } : null;
}

/** Token de acceso; si Google lo rechaza, marca ese Drive para volver a conectar. */
async function accessToken(admin: SupabaseClient, drive: DriveRow): Promise<string> {
  if (drive.needsReconnect) throw new HttpError(409, 'DRIVE_NEEDS_RECONNECT');
  try {
    return await google.accessTokenFrom(drive.refreshToken);
  } catch (err) {
    if (err instanceof HttpError && err.code === 'DRIVE_NEEDS_RECONNECT') {
      const [col, key] = keyOf(drive.target);
      await admin.from(tableOf(drive.target)).update({ needs_reconnect: true }).eq(col, key);
    }
    throw err;
  }
}

/** Borra de Drive los archivos pendientes de ese Drive (lo mejor posible: si falla, se reintenta otra vez). */
async function emptyTrash(admin: SupabaseClient, target: Target, token: string) {
  let q = admin.from('drive_file_trash').select('id, drive_file_id').limit(20);
  q = target.kind === 'family' ? q.eq('family_id', target.familyId) : q.eq('event_id', target.eventId).is('family_id', null);
  const { data } = await q;
  for (const row of data ?? []) {
    if (await google.deleteFile(token, row.drive_file_id).catch(() => false)) {
      await admin.from('drive_file_trash').delete().eq('id', row.id);
    }
  }
}

async function clearTrash(admin: SupabaseClient, target: Target) {
  const q = admin.from('drive_file_trash').delete();
  await (target.kind === 'family' ? q.eq('family_id', target.familyId) : q.eq('event_id', target.eventId).is('family_id', null));
}

async function requireCanEditItem(req: Request, itemId: string) {
  const { data, error } = await userClient(req).rpc('can_edit_wishlist_item', { p_item_id: itemId });
  if (error) throw error;
  if (data !== true) throw new HttpError(403, 'FORBIDDEN');
}

/**
 * Elige el Drive para una foto: el de la familia si funciona; si no, el general.
 * Si ninguno sirve, explica por qué (sin conectar o hay que volver a conectar).
 */
async function pickDriveFor(admin: SupabaseClient, eventId: string, familyId: string | null): Promise<DriveRow> {
  const familyDrive = familyId ? await getDrive(admin, { kind: 'family', familyId, eventId }) : null;
  if (familyDrive && !familyDrive.needsReconnect) return familyDrive;
  const eventDrive = await getDrive(admin, { kind: 'event', eventId });
  if (eventDrive && !eventDrive.needsReconnect) return eventDrive;
  if (familyDrive || eventDrive) throw new HttpError(409, 'DRIVE_NEEDS_RECONNECT');
  throw new HttpError(409, 'DRIVE_NOT_CONNECTED');
}

// ---------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------

async function startConnect(req: Request, callerId: string, body: Record<string, unknown>) {
  google.assertConfigured();
  const admin = adminClient();
  const { target } = await requireManagerTarget(admin, callerId, body);
  const origin = req.headers.get('Origin') ?? '';
  const appOrigin = isAllowedOrigin(origin) ? origin : FALLBACK_APP_URL;
  if (!appOrigin) throw new HttpError(400, 'ORIGIN_NOT_ALLOWED');
  const state = await signState({
    familyId: target.kind === 'family' ? target.familyId : null,
    eventId: target.eventId,
    userId: callerId,
    origin: appOrigin,
    exp: Date.now() + STATE_TTL_MS,
  });
  return { url: google.authUrl(state) };
}

async function disconnect(callerId: string, body: Record<string, unknown>) {
  const admin = adminClient();
  const { target } = await requireManagerTarget(admin, callerId, body);
  const drive = await getDrive(admin, target);
  if (drive) {
    await google.revoke(drive.refreshToken);
    const [col, key] = keyOf(target);
    await admin.from(tableOf(target)).delete().eq(col, key);
    await clearTrash(admin, target); // sin la conexión ya no se pueden alcanzar
    await audit(admin, {
      eventId: target.eventId,
      actor: callerId,
      action: target.kind === 'family' ? 'family_drive.disconnected' : 'event_drive.disconnected',
      entity: target.kind,
      entityId: key,
    });
  }
  return { ok: true };
}

async function uploadPhoto(req: Request, callerId: string) {
  const form = await req.formData().catch(() => null);
  if (!form) throw new HttpError(400, 'INVALID_BODY');
  const itemId = requireUuid(form.get('itemId'), 'itemId');
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'INVALID_FIELD', { field: 'file' });
  if (!IMAGE_TYPES.has(file.type)) throw new HttpError(400, 'PHOTO_TYPE_INVALID');
  if (file.size === 0 || file.size > MAX_BYTES) throw new HttpError(400, 'PHOTO_TOO_LARGE');

  await requireCanEditItem(req, itemId);
  const admin = adminClient();

  const { data: item, error } = await admin.from('wishlist_items').select('id, event_id, participant_id, title').eq('id', itemId).maybeSingle();
  if (error) throw error;
  if (!item) throw new HttpError(404, 'NOT_FOUND');
  const { data: person } = await admin.from('participants').select('family_id').eq('id', item.participant_id).maybeSingle();

  const drive = await pickDriveFor(admin, item.event_id, person?.family_id ?? null);

  const { data: existing } = await admin.from('wishlist_photos').select('sort_order').eq('item_id', itemId).order('sort_order', { ascending: false });
  if ((existing?.length ?? 0) >= MAX_PHOTOS) throw new HttpError(400, 'TOO_MANY_PHOTOS');
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const token = await accessToken(admin, drive);
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const safeTitle = String(item.title).replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 60).trim() || 'regalo';
  const fileId = await google.uploadPhoto(token, drive.folderId, `${safeTitle} ${nextOrder + 1}.${ext}`, file);

  const { data: photo, error: insErr } = await admin
    .from('wishlist_photos')
    .insert({
      item_id: itemId,
      event_id: item.event_id,
      family_id: drive.target.kind === 'family' ? drive.target.familyId : null,
      in_event_drive: drive.target.kind === 'event',
      drive_file_id: fileId,
      sort_order: nextOrder,
      created_by: callerId,
    })
    .select('id')
    .single();
  if (insErr) {
    await google.deleteFile(token, fileId); // no dejar archivos sueltos
    if (insErr.message?.includes('TOO_MANY_PHOTOS')) throw new HttpError(400, 'TOO_MANY_PHOTOS');
    throw insErr;
  }

  await emptyTrash(admin, drive.target, token);
  return { id: photo.id, driveFileId: fileId };
}

async function deletePhoto(req: Request, photoId: string) {
  const admin = adminClient();
  const { data: photo, error } = await admin
    .from('wishlist_photos')
    .select('id, item_id, event_id, family_id, in_event_drive')
    .eq('id', photoId)
    .maybeSingle();
  if (error) throw error;
  if (!photo) return { ok: true }; // ya no existe
  await requireCanEditItem(req, photo.item_id);

  // El trigger lo pasa a la papelera; luego se borra de Drive si la conexión sigue viva
  const { error: delErr } = await admin.from('wishlist_photos').delete().eq('id', photoId);
  if (delErr) throw delErr;
  const target: Target | null = photo.in_event_drive
    ? { kind: 'event', eventId: photo.event_id }
    : photo.family_id
      ? { kind: 'family', familyId: photo.family_id, eventId: photo.event_id }
      : null;
  const drive = target ? await getDrive(admin, target) : null;
  if (drive && !drive.needsReconnect) {
    try {
      await emptyTrash(admin, drive.target, await accessToken(admin, drive));
    } catch (err) {
      console.error('trash cleanup failed', err); // la foto ya se quitó de la app; Drive se limpia después
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------
// Vuelta desde Google (GET)
// ---------------------------------------------------------------------

async function oauthCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const state = await verifyState(url.searchParams.get('state') ?? '');
  if (!state) return new Response('El enlace venció. Vuelve a la aplicación e inténtalo otra vez.', { status: 400 });

  const back = (result: string) =>
    Response.redirect(`${state.origin}/e/${state.eventId}/organizar?drive=${encodeURIComponent(result)}#fotos`, 302);

  if (url.searchParams.get('error')) return back('cancelado');
  const code = url.searchParams.get('code');
  if (!code) return back('error');

  try {
    const admin = adminClient();
    // Se vuelve a comprobar: pudo dejar de ser administrador en estos minutos
    const { target, folderName } = await requireManagerTarget(
      admin,
      state.userId,
      state.familyId ? { familyId: state.familyId } : { eventId: state.eventId },
    );

    const tokens = await google.exchangeCode(code);
    if (!tokens.refresh_token) return back('error');
    if (!tokens.scope?.includes('https://www.googleapis.com/auth/drive.file')) {
      await google.revoke(tokens.refresh_token);
      return back('sin-permiso'); // desmarcó el permiso de Drive
    }
    const email = await google.userEmail(tokens.access_token);
    const folderId = await google.createFolder(tokens.access_token, folderName);

    const previous = await getDrive(admin, target);
    const [col, key] = keyOf(target);
    const row = {
      [col]: key,
      ...(target.kind === 'family' ? { event_id: target.eventId } : {}),
      google_email: email,
      refresh_token: tokens.refresh_token,
      folder_id: folderId,
      needs_reconnect: false,
      connected_by: state.userId,
    };
    const { error } = await admin.from(tableOf(target)).upsert(row);
    if (error) throw error;
    if (previous && previous.refreshToken !== tokens.refresh_token) {
      await google.revoke(previous.refreshToken);
      await clearTrash(admin, target);
    }

    await audit(admin, {
      eventId: target.eventId,
      actor: state.userId,
      action: target.kind === 'family' ? 'family_drive.connected' : 'event_drive.connected',
      entity: target.kind,
      entityId: key,
      metadata: { email },
    });
    return back('conectado');
  } catch (err) {
    console.error('oauth callback failed', err);
    return back('error');
  }
}

const api = handler(async (req) => {
  const callerId = await getCallerId(req);
  if ((req.headers.get('Content-Type') ?? '').startsWith('multipart/form-data')) return uploadPhoto(req, callerId);

  const body = await readJson(req);
  switch (body.action) {
    case 'auth-url':
      return startConnect(req, callerId, body);
    case 'disconnect':
      return disconnect(callerId, body);
    case 'delete-photo':
      return deletePhoto(req, requireUuid(body.photoId, 'photoId'));
    default:
      throw new HttpError(400, 'INVALID_ACTION');
  }
});

Deno.serve((req) => (req.method === 'GET' ? oauthCallback(req) : api(req)));
