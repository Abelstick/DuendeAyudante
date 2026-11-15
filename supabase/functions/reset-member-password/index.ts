// Edge Function: el organizador o un administrador asigna una nueva contraseña
// a un integrante cuya cuenta fue creada en ese mismo evento.
import { handler, HttpError, readJson, requireUuid } from '../_shared/http.ts';
import { adminClient, audit, getCallerId, getRole } from '../_shared/supabase.ts';

Deno.serve(
  handler(async (req) => {
    const callerId = await getCallerId(req);
    const body = await readJson(req);
    const eventId = requireUuid(body.eventId, 'eventId');
    const participantId = requireUuid(body.participantId, 'participantId');
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (newPassword.length < 8 || newPassword.length > 72) throw new HttpError(400, 'PASSWORD_INVALID');

    const admin = adminClient();
    const callerRole = await getRole(admin, eventId, callerId);
    if (callerRole !== 'owner' && callerRole !== 'admin') throw new HttpError(403, 'FORBIDDEN');

    const { data: participant, error } = await admin
      .from('participants')
      .select('id, user_id')
      .eq('id', participantId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) throw error;
    if (!participant?.user_id) throw new HttpError(404, 'MEMBER_WITHOUT_ACCOUNT');
    if (participant.user_id === callerId) throw new HttpError(400, 'USE_PROFILE_TO_CHANGE_OWN_PASSWORD');

    const targetRole = await getRole(admin, eventId, participant.user_id);
    if (targetRole === 'owner') throw new HttpError(403, 'FORBIDDEN');
    if (targetRole === 'admin' && callerRole !== 'owner') throw new HttpError(403, 'FORBIDDEN');

    // Solo cuentas creadas por un administrador de ESTE evento (nunca cuentas con correo propio).
    const { data: target, error: tErr } = await admin.auth.admin.getUserById(participant.user_id);
    if (tErr || !target.user) throw new HttpError(404, 'MEMBER_WITHOUT_ACCOUNT');
    const meta = target.user.app_metadata ?? {};
    if (meta.created_by !== 'admin' || meta.created_in_event_id !== eventId) throw new HttpError(403, 'FORBIDDEN');

    const { error: uErr } = await admin.auth.admin.updateUserById(participant.user_id, { password: newPassword });
    if (uErr) {
      console.error(uErr);
      throw new HttpError(400, 'PASSWORD_INVALID');
    }

    await audit(admin, {
      eventId,
      actor: callerId,
      action: 'member.password_reset',
      entity: 'participant',
      entityId: participantId,
    });

    return { ok: true };
  }),
);
