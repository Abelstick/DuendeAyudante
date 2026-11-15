import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './http.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Dominio ficticio de los correos internos. `.invalid` (RFC 2606) nunca recibe correo. */
export const MEMBER_EMAIL_DOMAIN = Deno.env.get('MEMBER_EMAIL_DOMAIN') ?? 'usuarios.navidad.invalid';

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,29}$/;

/** Cliente con service role: salta RLS. Úsese solo después de verificar permisos. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Devuelve el id del usuario que llama (verificando su JWT). */
export async function getCallerId(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new HttpError(401, 'NOT_AUTHENTICATED');
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'NOT_AUTHENTICATED');
  return data.user.id;
}

export type EventRole = 'owner' | 'admin' | 'editor' | 'participant';

export async function getRole(admin: SupabaseClient, eventId: string, userId: string): Promise<EventRole | null> {
  const { data, error } = await admin
    .from('event_members')
    .select('role, events!inner(deleted_at)')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .is('events.deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as EventRole | undefined) ?? null;
}

export async function audit(
  admin: SupabaseClient,
  entry: { eventId: string; actor: string; action: string; entity: string; entityId: string; metadata?: Record<string, unknown> },
) {
  await admin.from('audit_log').insert({
    event_id: entry.eventId,
    actor_user_id: entry.actor,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId,
    metadata: entry.metadata ?? {},
  });
}
