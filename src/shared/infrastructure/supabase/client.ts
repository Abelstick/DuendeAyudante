/**
 * ÚNICO lugar donde se crea el cliente de Supabase. Solo debe importarse
 * desde carpetas `infrastructure/` (nunca desde componentes o hooks).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/shared/config/env';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
