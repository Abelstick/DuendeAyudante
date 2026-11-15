// Edge Function PÚBLICA (sin sesión): acceso con el enlace de una familia.
//
//   { action: "info",    token }                       → nombre de la Navidad y de la familia
//   { action: "members", token, word }                 → quiénes pueden entrar con el enlace
//   { action: "enter",   token, word, participantId }  → inicia la sesión de esa persona
//
// Seguridad:
//  · El enlace es un identificador de 32 caracteres al azar; sin él no se obtiene nada.
//  · La lista de nombres solo se entrega con la palabra secreta correcta.
//  · Solo se ofrecen cuentas con rol "participant": organizador, administradores y
//    editores siguen entrando con su usuario y contraseña.
//  · Tras varios intentos fallidos seguidos, el enlace se bloquea unos minutos.
import { handler, HttpError, readJson, requireUuid } from '../_shared/http.ts';
import { adminClient, audit } from '../_shared/supabase.ts';

const TOKEN_RE = /^[a-f0-9]{32}$/;
const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

/** Igual que app.normalize_secret_word en la base: "  Panetón 25 " → "PANETON25". */
function normalizeSecretWord(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .toUpperCase()
    .replace(/Ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\u0001/g, 'Ñ')
    .replace(/\s+/g, '');
}

type Admin = ReturnType<typeof adminClient>;

interface AccessRow {
  family_id: string;
  event_id: string;
  secret_word: string;
  failed_attempts: number;
  locked_until: string | null;
}

async function findAccess(admin: Admin, token: unknown): Promise<AccessRow> {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) throw new HttpError(404, 'FAMILY_LINK_NOT_FOUND');
  const { data, error } = await admin
    .from('family_access')
    .select('family_id, event_id, secret_word, failed_attempts, locked_until, events!inner(deleted_at)')
    .eq('link_token', token)
    .is('events.deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'FAMILY_LINK_NOT_FOUND');
  return data as unknown as AccessRow;
}

/** Comprueba la palabra; cuenta los fallos y bloquea el enlace si son demasiados. */
async function checkWord(admin: Admin, access: AccessRow, word: unknown): Promise<void> {
  if (access.locked_until && new Date(access.locked_until).getTime() > Date.now()) {
    throw new HttpError(429, 'FAMILY_LINK_LOCKED');
  }
  if (normalizeSecretWord(word) === access.secret_word) {
    if (access.failed_attempts > 0) {
      await admin.from('family_access').update({ failed_attempts: 0, locked_until: null }).eq('family_id', access.family_id);
    }
    return;
  }
  const failed = access.failed_attempts + 1;
  const lock = failed >= MAX_FAILED_ATTEMPTS;
  await admin
    .from('family_access')
    .update({
      failed_attempts: lock ? 0 : failed,
      locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
    })
    .eq('family_id', access.family_id);
  throw new HttpError(lock ? 429 : 403, lock ? 'FAMILY_LINK_LOCKED' : 'SECRET_WORD_WRONG');
}

interface EligibleMember {
  participantId: string;
  userId: string;
  name: string;
}

/** Integrantes activos de la familia, con cuenta propia y rol de participante. */
async function eligibleMembers(admin: Admin, access: AccessRow): Promise<EligibleMember[]> {
  const { data: people, error } = await admin
    .from('participants')
    .select('id, user_id, full_name, distinguishing_note')
    .eq('event_id', access.event_id)
    .eq('family_id', access.family_id)
    .eq('status', 'active')
    .not('user_id', 'is', null)
    .order('full_name');
  if (error) throw error;
  if (!people || people.length === 0) return [];

  const { data: roles, error: rErr } = await admin
    .from('event_members')
    .select('user_id, role')
    .eq('event_id', access.event_id)
    .in(
      'user_id',
      people.map((p) => p.user_id),
    );
  if (rErr) throw rErr;
  const participantUsers = new Set((roles ?? []).filter((r) => r.role === 'participant').map((r) => r.user_id));

  return people
    .filter((p) => participantUsers.has(p.user_id))
    .map((p) => ({
      participantId: p.id,
      userId: p.user_id,
      name: p.distinguishing_note ? `${p.full_name} (${p.distinguishing_note})` : p.full_name,
    }));
}

Deno.serve(
  handler(async (req) => {
    const body = await readJson(req);
    const admin = adminClient();
    const access = await findAccess(admin, body.token);

    if (body.action === 'info') {
      const [{ data: family }, { data: event }] = await Promise.all([
        admin.from('families').select('name, color_key').eq('id', access.family_id).single(),
        admin.from('events').select('name').eq('id', access.event_id).single(),
      ]);
      if (!family || !event) throw new HttpError(404, 'FAMILY_LINK_NOT_FOUND');
      return { eventName: event.name, familyName: family.name, familyColor: family.color_key };
    }

    if (body.action === 'members') {
      await checkWord(admin, access, body.word);
      const members = await eligibleMembers(admin, access);
      return { members: members.map(({ participantId, name }) => ({ participantId, name })) };
    }

    if (body.action === 'enter') {
      await checkWord(admin, access, body.word);
      const participantId = requireUuid(body.participantId, 'participantId');
      const member = (await eligibleMembers(admin, access)).find((m) => m.participantId === participantId);
      if (!member) throw new HttpError(403, 'MEMBER_NOT_ELIGIBLE');

      const { data: user, error: uErr } = await admin.auth.admin.getUserById(member.userId);
      if (uErr || !user.user?.email) throw new HttpError(403, 'MEMBER_NOT_ELIGIBLE');

      // Enlace de un solo uso (no se envía ningún correo): el navegador lo canjea por una sesión.
      const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.user.email });
      if (lErr || !link.properties?.hashed_token) {
        console.error(lErr);
        throw new HttpError(500, 'INTERNAL_ERROR');
      }

      await audit(admin, {
        eventId: access.event_id,
        actor: member.userId,
        action: 'member.family_link_login',
        entity: 'participant',
        entityId: member.participantId,
        metadata: { familyId: access.family_id },
      });

      return { tokenHash: link.properties.hashed_token };
    }

    throw new HttpError(400, 'INVALID_FIELD', { field: 'action' });
  }),
);
