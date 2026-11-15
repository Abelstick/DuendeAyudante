// Edge Function: Google Drive de cada familia para las fotos de los regalos.
//
//  POST (con sesión, JSON):
//    { action: 'auth-url',   familyId }  → organizador/admin: enlace para conectar la cuenta de Google
//    { action: 'disconnect', familyId }  → organizador/admin: desconecta (las fotos quedan en ese Drive)
//    { action: 'delete-photo', photoId } → quien puede cambiar el regalo
//  POST (con sesión, multipart): itemId + file → sube una foto al Drive de la familia de esa persona
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

interface DriveRow {
  family_id: string;
  event_id: string;
  refresh_token: string;
  folder_id: string;
  needs_reconnect: boolean;
}

async function requireManagerOfFamily(admin: SupabaseClient, callerId: string, familyId: string) {
  const { data: family, error } = await admin.from('families').select('id, name, event_id, events!inner(name)').eq('id', familyId).maybeSingle();
  if (error) throw error;
  if (!family) throw new HttpError(404, 'NOT_FOUND');
  const role = await getRole(admin, family.event_id, callerId);
  if (role !== 'owner' && role !== 'admin') throw new HttpError(403, 'FORBIDDEN');
  const eventName = (family.events as unknown as { name: string }).name;
  return { familyName: family.name as string, eventId: family.event_id as string, eventName, role };
}

async function getDrive(admin: SupabaseClient, familyId: string | null): Promise<DriveRow | null> {
  if (!familyId) return null;
  const { data, error } = await admin
    .from('family_drives')
    .select('family_id, event_id, refresh_token, folder_id, needs_reconnect')
    .eq('family_id', familyId)
    .maybeSingle();
  if (error) throw error;
  return data as DriveRow | null;
}

/** Token de acceso; si Google lo rechaza, marca la familia para volver a conectar. */
async function accessToken(admin: SupabaseClient, drive: DriveRow): Promise<string> {
  if (drive.needs_reconnect) throw new HttpError(409, 'DRIVE_NEEDS_RECONNECT');
  try {
    return await google.accessTokenFrom(drive.refresh_token);
  } catch (err) {
    if (err instanceof HttpError && err.code === 'DRIVE_NEEDS_RECONNECT') {
      await admin.from('family_drives').update({ needs_reconnect: true }).eq('family_id', drive.family_id);
    }
    throw err;
  }
}

/** Borra de Drive los archivos pendientes de esa familia (lo mejor posible: si falla, se reintenta otra vez). */
async function emptyTrash(admin: SupabaseClient, familyId: string, token: string) {
  const { data } = await admin.from('drive_file_trash').select('id, drive_file_id').eq('family_id', familyId).limit(20);
  for (const row of data ?? []) {
    if (await google.deleteFile(token, row.drive_file_id).catch(() => false)) {
      await admin.from('drive_file_trash').delete().eq('id', row.id);
    }
  }
}

async function requireCanEditItem(req: Request, itemId: string) {
  const { data, error } = await userClient(req).rpc('can_edit_wishlist_item', { p_item_id: itemId });
  if (error) throw error;
  if (data !== true) throw new HttpError(403, 'FORBIDDEN');
}

// ---------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------

async function startConnect(req: Request, callerId: string, familyId: string) {
  google.assertConfigured();
  const admin = adminClient();
  const { eventId } = await requireManagerOfFamily(admin, callerId, familyId);
  const origin = req.headers.get('Origin') ?? '';
  const appOrigin = isAllowedOrigin(origin) ? origin : FALLBACK_APP_URL;
  if (!appOrigin) throw new HttpError(400, 'ORIGIN_NOT_ALLOWED');
  const state = await signState({ familyId, eventId, userId: callerId, origin: appOrigin, exp: Date.now() + STATE_TTL_MS });
  return { url: google.authUrl(state) };
}

async function disconnect(callerId: string, familyId: string) {
  const admin = adminClient();
  const { eventId } = await requireManagerOfFamily(admin, callerId, familyId);
  const drive = await getDrive(admin, familyId);
  if (drive) {
    await google.revoke(drive.refresh_token);
    await admin.from('family_drives').delete().eq('family_id', familyId);
    // Los archivos por borrar ya no se pueden alcanzar sin la conexión
    await admin.from('drive_file_trash').delete().eq('family_id', familyId);
    await audit(admin, { eventId, actor: callerId, action: 'family_drive.disconnected', entity: 'family', entityId: familyId });
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

  const drive = await getDrive(admin, person?.family_id ?? null);
  if (!drive) throw new HttpError(409, 'DRIVE_NOT_CONNECTED');

  const { data: existing } = await admin.from('wishlist_photos').select('sort_order').eq('item_id', itemId).order('sort_order', { ascending: false });
  if ((existing?.length ?? 0) >= MAX_PHOTOS) throw new HttpError(400, 'TOO_MANY_PHOTOS');
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const token = await accessToken(admin, drive);
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const safeTitle = String(item.title).replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 60).trim() || 'regalo';
  const fileId = await google.uploadPhoto(token, drive.folder_id, `${safeTitle} ${nextOrder + 1}.${ext}`, file);

  const { data: photo, error: insErr } = await admin
    .from('wishlist_photos')
    .insert({ item_id: itemId, event_id: item.event_id, family_id: drive.family_id, drive_file_id: fileId, sort_order: nextOrder, created_by: callerId })
    .select('id')
    .single();
  if (insErr) {
    await google.deleteFile(token, fileId); // no dejar archivos sueltos
    if (insErr.message?.includes('TOO_MANY_PHOTOS')) throw new HttpError(400, 'TOO_MANY_PHOTOS');
    throw insErr;
  }

  await emptyTrash(admin, drive.family_id, token);
  return { id: photo.id, driveFileId: fileId };
}

async function deletePhoto(req: Request, photoId: string) {
  const admin = adminClient();
  const { data: photo, error } = await admin.from('wishlist_photos').select('id, item_id, family_id').eq('id', photoId).maybeSingle();
  if (error) throw error;
  if (!photo) return { ok: true }; // ya no existe
  await requireCanEditItem(req, photo.item_id);

  // El trigger lo pasa a la papelera; luego se borra de Drive si la conexión sigue viva
  const { error: delErr } = await admin.from('wishlist_photos').delete().eq('id', photoId);
  if (delErr) throw delErr;
  const drive = await getDrive(admin, photo.family_id);
  if (drive && !drive.needs_reconnect) {
    try {
      await emptyTrash(admin, drive.family_id, await accessToken(admin, drive));
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
    const { familyName, eventName } = await requireManagerOfFamily(admin, state.userId, state.familyId);

    const tokens = await google.exchangeCode(code);
    if (!tokens.refresh_token) return back('error');
    if (!tokens.scope?.includes('https://www.googleapis.com/auth/drive.file')) {
      await google.revoke(tokens.refresh_token);
      return back('sin-permiso'); // desmarcó el permiso de Drive
    }
    const email = await google.userEmail(tokens.access_token);
    const folderId = await google.createFolder(tokens.access_token, `Duende Ayudante · ${eventName} · Familia ${familyName}`);

    const previous = await getDrive(admin, state.familyId);
    const { error } = await admin.from('family_drives').upsert({
      family_id: state.familyId,
      event_id: state.eventId,
      google_email: email,
      refresh_token: tokens.refresh_token,
      folder_id: folderId,
      needs_reconnect: false,
      connected_by: state.userId,
    });
    if (error) throw error;
    if (previous && previous.refresh_token !== tokens.refresh_token) {
      await google.revoke(previous.refresh_token);
      await admin.from('drive_file_trash').delete().eq('family_id', state.familyId);
    }

    await audit(admin, {
      eventId: state.eventId,
      actor: state.userId,
      action: 'family_drive.connected',
      entity: 'family',
      entityId: state.familyId,
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
      return startConnect(req, callerId, requireUuid(body.familyId, 'familyId'));
    case 'disconnect':
      return disconnect(callerId, requireUuid(body.familyId, 'familyId'));
    case 'delete-photo':
      return deletePhoto(req, requireUuid(body.photoId, 'photoId'));
    default:
      throw new HttpError(400, 'INVALID_ACTION');
  }
});

Deno.serve((req) => (req.method === 'GET' ? oauthCallback(req) : api(req)));
