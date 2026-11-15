import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/shared/domain/errors';
import { fromFunctionError, fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { FamilyDrive, IFamilyDriveRepository } from '../domain/FamilyDrive';

interface DriveRow {
  family_id: string;
  google_email: string | null;
  needs_reconnect: boolean;
  connected_at: string;
}

/** El estado se lee con una RPC sin secretos; conectar y desconectar pasan por la Edge Function google-drive. */
export class SupabaseFamilyDriveRepository implements IFamilyDriveRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listForEvent(eventId: string): Promise<FamilyDrive[]> {
    const { data, error } = await this.supabase.rpc('list_family_drives', { p_event_id: eventId });
    if (error) throw fromPostgrestError(error);
    return ((data ?? []) as DriveRow[]).map((r) => ({
      familyId: r.family_id,
      googleEmail: r.google_email,
      needsReconnect: r.needs_reconnect,
      connectedAt: new Date(r.connected_at),
    }));
  }

  async getConnectUrl(familyId: string): Promise<string> {
    const { data, error } = await this.supabase.functions.invoke<{ url: string }>('google-drive', { body: { action: 'auth-url', familyId } });
    if (error) throw await fromFunctionError(error);
    if (!data?.url) throw new AppError('UNEXPECTED');
    return data.url;
  }

  async disconnect(familyId: string): Promise<void> {
    const { error } = await this.supabase.functions.invoke('google-drive', { body: { action: 'disconnect', familyId } });
    if (error) throw await fromFunctionError(error);
  }
}
