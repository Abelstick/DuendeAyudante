// Edge Function: crea un integrante del evento y, opcionalmente, su cuenta
// (usuario + contraseña). Solo organizador o administradores.
import { handler, HttpError, optionalString, readJson, requireUuid, UUID_RE } from '../_shared/http.ts';
import { adminClient, audit, getCallerId, getRole, MEMBER_EMAIL_DOMAIN, USERNAME_RE } from '../_shared/supabase.ts';

const ROLES = ['participant', 'editor', 'admin'] as const;
type MemberRole = (typeof ROLES)[number];

Deno.serve(
  handler(async (req) => {
    const callerId = await getCallerId(req);
    const body = await readJson(req);

    const eventId = requireUuid(body.eventId, 'eventId');
    const firstName = optionalString(body.firstName, 'firstName', 120);
    const paternalSurname = optionalString(body.paternalSurname, 'paternalSurname', 120);
    if (!firstName) throw new HttpError(400, 'FIRST_NAME_INVALID');
    if (!paternalSurname) throw new HttpError(400, 'PATERNAL_SURNAME_INVALID');
    const maternalSurname = optionalString(body.maternalSurname, 'maternalSurname', 120);
    const distinguishingNote = optionalString(body.distinguishingNote, 'distinguishingNote', 80);
    const familyId = body.familyId ? requireUuid(body.familyId, 'familyId') : null;
    const role = (body.role ?? 'participant') as MemberRole;
    if (!ROLES.includes(role)) throw new HttpError(400, 'INVALID_FIELD', { field: 'role' });

    const guardianIds = Array.isArray(body.guardianParticipantIds) ? body.guardianParticipantIds : [];
    if (guardianIds.length > 5 || !guardianIds.every((g) => typeof g === 'string' && UUID_RE.test(g))) {
      throw new HttpError(400, 'INVALID_FIELD', { field: 'guardianParticipantIds' });
    }

    const account = body.account as { username?: unknown; password?: unknown; autoSuffix?: unknown } | null | undefined;
    let username: string | null = null;
    let password: string | null = null;
    if (account) {
      username = typeof account.username === 'string' ? account.username.trim().toLowerCase() : '';
      password = typeof account.password === 'string' ? account.password : '';
      if (!USERNAME_RE.test(username)) throw new HttpError(400, 'USERNAME_INVALID');
      if (password.length < 8 || password.length > 72) throw new HttpError(400, 'PASSWORD_INVALID');
    } else if (role !== 'participant') {
      throw new HttpError(400, 'ACCOUNT_REQUIRED_FOR_ROLE');
    }

    const admin = adminClient();
    const callerRole = await getRole(admin, eventId, callerId);
    if (callerRole !== 'owner' && callerRole !== 'admin') throw new HttpError(403, 'FORBIDDEN');
    if (role === 'admin' && callerRole !== 'owner') throw new HttpError(403, 'ONLY_OWNER_CAN_CREATE_ADMINS');

    // 1) Perfil del participante (el trigger normaliza y valida nombres y duplicados)
    const { data: participant, error: pErr } = await admin
      .from('participants')
      .insert({
        event_id: eventId,
        family_id: familyId,
        first_name: firstName,
        paternal_surname: paternalSurname,
        maternal_surname: maternalSurname,
        distinguishing_note: distinguishingNote,
      })
      .select('id, full_name')
      .single();

    if (pErr) {
      if (pErr.code === '23505') throw new HttpError(409, 'DUPLICATE_NAME');
      if (pErr.code === '23514') throw new HttpError(400, pErr.message.match(/[A-Z_]+_INVALID/)?.[0] ?? 'NAME_INVALID');
      if (pErr.code === '23503') throw new HttpError(400, 'FAMILY_NOT_FOUND');
      throw pErr;
    }

    const rollback = async (userId?: string) => {
      await admin.from('participants').delete().eq('id', participant.id);
      if (userId) await admin.auth.admin.deleteUser(userId);
    };

    // 2) Cuenta (opcional). El usuario es único dentro de esta Navidad.
    let createdUserId: string | undefined;
    if (username && password) {
      const { data: ev, error: evErr } = await admin.from('events').select('join_code').eq('id', eventId).single();
      if (evErr || !ev) {
        await rollback();
        throw new HttpError(404, 'NOT_FOUND');
      }

      if (account?.autoSuffix === true) {
        username = await findFreeUsername(admin, eventId, username);
      } else if (await usernameTaken(admin, eventId, username)) {
        await rollback();
        throw new HttpError(409, 'USERNAME_TAKEN', { suggestion: await findFreeUsername(admin, eventId, username) });
      }

      const { data: created, error: uErr } = await admin.auth.admin.createUser({
        email: memberEmail(username, ev.join_code),
        password,
        email_confirm: true,
        app_metadata: { created_by: 'admin', username, created_in_event_id: eventId },
        user_metadata: { display_name: participant.full_name },
      });
      if (uErr || !created.user) {
        await rollback();
        console.error(uErr);
        const weak = uErr?.message?.toLowerCase().includes('password');
        throw new HttpError(400, weak ? 'PASSWORD_INVALID' : 'ACCOUNT_NOT_CREATED');
      }
      createdUserId = created.user.id;

      const { error: linkErr } = await admin.from('participants').update({ user_id: createdUserId }).eq('id', participant.id);
      const { error: memberErr } = linkErr
        ? { error: linkErr }
        : await admin.from('event_members').insert({ event_id: eventId, user_id: createdUserId, role });
      if (linkErr || memberErr) {
        await rollback(createdUserId);
        throw linkErr ?? memberErr;
      }
    }

    // 3) Tutores
    if (guardianIds.length > 0) {
      const { error: gErr } = await admin.from('guardianships').insert(
        guardianIds.map((g) => ({ event_id: eventId, guardian_participant_id: g, ward_participant_id: participant.id })),
      );
      if (gErr) {
        await rollback(createdUserId);
        throw new HttpError(400, 'GUARDIAN_NOT_FOUND');
      }
    }

    await audit(admin, {
      eventId,
      actor: callerId,
      action: 'member.created',
      entity: 'participant',
      entityId: participant.id,
      metadata: { role, hasAccount: Boolean(createdUserId), username },
    });

    return { participantId: participant.id, fullName: participant.full_name, username };
  }),
);

/** "rosa" + "GARCIA25" → "rosa@garcia25.usuarios.navidad.invalid" (nunca recibe correo). */
function memberEmail(username: string, joinCode: string): string {
  return `${username}@${joinCode.toLowerCase()}.${MEMBER_EMAIL_DOMAIN}`;
}

async function usernameTaken(admin: ReturnType<typeof adminClient>, eventId: string, username: string): Promise<boolean> {
  const { data, error } = await admin
    .from('users')
    .select('id')
    .eq('home_event_id', eventId)
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function findFreeUsername(admin: ReturnType<typeof adminClient>, eventId: string, base: string): Promise<string> {
  const root = base.slice(0, 27);
  for (let i = 1; i < 100; i++) {
    const candidate = i === 1 ? base : `${root}${i}`;
    if (!(await usernameTaken(admin, eventId, candidate))) return candidate;
  }
  throw new HttpError(409, 'USERNAME_TAKEN');
}
