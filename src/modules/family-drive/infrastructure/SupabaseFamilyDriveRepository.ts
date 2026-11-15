import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/shared/domain/errors';
import { fromFunctionError, fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { DriveConnection, DriveTarget, FamilyDrive, IFamilyDriveRepository } from '../domain/FamilyDrive';

interface ConnectionRow {
  google_email: string | null;
  needs_reconnect: boolean;
  connected_at: string;
}

const toConnection = (r: ConnectionRow): DriveConnection => ({
  googleEmail: r.google_email,
  needsReconnect: r.needs_reconnect,
  connectedAt: new Date(r.connected_at),
});

/** El estado se lee con RPC sin secretos; conectar y desconectar pasan por la Edge Function google-drive. */
export class SupabaseFamilyDriveRepository implements IFamilyDriveRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listForEvent(eventId: string): Promise<FamilyDrive[]> {
    const { data, error } = await this.supabase.rpc('list_family_drives', { p_event_id: eventId });
    if (error) throw fromPostgrestError(error);
    return ((data ?? []) as (ConnectionRow & { family_id: string })[]).map((r) => ({ familyId: r.family_id, ...toConnection(r) }));
  }

  async getEventDrive(eventId: string): Promise<DriveConnection | null> {
    const { data, error } = await this.supabase.rpc('get_event_drive', { p_event_id: eventId });
    if (error) throw fromPostgrestError(error);
    const row = ((data ?? []) as ConnectionRow[])[0];
    return row ? toConnection(row) : null;
  }

  async getConnectUrl(target: DriveTarget): Promise<string> {
    const { data, error } = await this.supabase.functions.invoke<{ url: string }>('google-drive', { body: { action: 'auth-url', ...target } });
    if (error) throw await fromFunctionError(error);
    if (!data?.url) throw new AppError('UNEXPECTED');
    return data.url;
  }

  async disconnect(target: DriveTarget): Promise<void> {
    const { error } = await this.supabase.functions.invoke('google-drive', { body: { action: 'disconnect', ...target } });
    if (error) throw await fromFunctionError(error);
  }
}
