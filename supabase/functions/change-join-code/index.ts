// Edge Function: el organizador o un administrador cambia el código de su Navidad.
// El correo interno de cada familiar incluye el código, así que primero se
// actualizan esos correos y luego el código. Si algo falla, se deshace.
// El código anterior queda guardado: los enlaces ya enviados siguen funcionando.
import { handler, HttpError, readJson, requireUuid } from '../_shared/http.ts';
import { adminClient, getCallerId, getRole, MEMBER_EMAIL_DOMAIN } from '../_shared/supabase.ts';

const JOIN_CODE_RE = /^[A-Z0-9]{4,20}$/;

function normalizeJoinCode(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

const memberEmail = (username: string, code: string) => `${username}@${code.toLowerCase()}.${MEMBER_EMAIL_DOMAIN}`;

Deno.serve(
  handler(async (req) => {
    const callerId = await getCallerId(req);
    const body = await readJson(req);
    const eventId = requireUuid(body.eventId, 'eventId');
    const newCode = normalizeJoinCode(typeof body.newCode === 'string' ? body.newCode : '');
    if (!JOIN_CODE_RE.test(newCode)) throw new HttpError(400, 'JOIN_CODE_INVALID');

    const admin = adminClient();
    const callerRole = await getRole(admin, eventId, callerId);
    if (callerRole !== 'owner' && callerRole !== 'admin') throw new HttpError(403, 'FORBIDDEN');

    const { data: event, error: evErr } = await admin.from('events').select('join_code').eq('id', eventId).single();
    if (evErr || !event) throw new HttpError(404, 'NOT_FOUND');
    const oldCode: string = event.join_code;
    if (oldCode === newCode) return { joinCode: newCode };

    // ¿Lo usa (o usó) otra Navidad?
    const [{ data: inEvents }, { data: inHistory }] = await Promise.all([
      admin.from('events').select('id').eq('join_code', newCode).neq('id', eventId).maybeSingle(),
      admin.from('event_code_history').select('event_id').eq('code', newCode).neq('event_id', eventId).maybeSingle(),
    ]);
    if (inEvents || inHistory) throw new HttpError(409, 'JOIN_CODE_TAKEN');

    // Cuentas creadas en esta Navidad
    const { data: members, error: mErr } = await admin.from('users').select('id, username').eq('home_event_id', eventId);
    if (mErr) throw mErr;

    const updated: { id: string; username: string }[] = [];
    const rollback = async () => {
      for (const m of updated) {
        await admin.auth.admin.updateUserById(m.id, { email: memberEmail(m.username, oldCode), email_confirm: true });
      }
    };

    for (const m of members ?? []) {
      const { error } = await admin.auth.admin.updateUserById(m.id, { email: memberEmail(m.username, newCode), email_confirm: true });
      if (error) {
        console.error(error);
        await rollback();
        throw new HttpError(500, 'JOIN_CODE_NOT_CHANGED');
      }
      updated.push(m);
    }

    const { error: applyErr } = await admin.rpc('apply_join_code_change', {
      p_event_id: eventId,
      p_new_code: newCode,
      p_actor: callerId,
    });
    if (applyErr) {
      await rollback();
      if (applyErr.message?.includes('JOIN_CODE_TAKEN')) throw new HttpError(409, 'JOIN_CODE_TAKEN');
      throw applyErr;
    }

    return { joinCode: newCode, updatedAccounts: updated.length };
  }),
);
