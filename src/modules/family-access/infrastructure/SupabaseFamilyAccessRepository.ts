import type { SupabaseClient } from '@supabase/supabase-js';
import type { FamilyColor } from '@/modules/families/domain/Family';
import { AppError } from '@/shared/domain/errors';
import { fromFunctionError, fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { FamilyAccess, FamilyLinkInfo, FamilyLinkMember, IFamilyAccessRepository } from '../domain/FamilyAccess';

interface AccessRow {
  family_id: string;
  link_token: string;
  secret_word: string;
}

/**
 * Quien administra lee y cambia la palabra con su sesión (RLS + RPC).
 * Los familiares, que todavía no tienen sesión, pasan por la Edge Function pública family-access.
 */
export class SupabaseFamilyAccessRepository implements IFamilyAccessRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listForEvent(eventId: string): Promise<FamilyAccess[]> {
    const { data, error } = await this.supabase
      .from('family_access')
      .select('family_id, link_token, secret_word')
      .eq('event_id', eventId)
      .returns<AccessRow[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? []).map((r) => ({ familyId: r.family_id, linkToken: r.link_token, secretWord: r.secret_word }));
  }

  async setWord(familyId: string, word: string): Promise<FamilyAccess> {
    const { data, error } = await this.supabase
      .rpc('set_family_access_word', { p_family_id: familyId, p_word: word })
      .returns<{ link_token: string; secret_word: string }[]>();
    if (error) throw fromPostgrestError(error);
    const row = Array.isArray(data) ? data[0] : undefined;
    if (!row) throw new AppError('UNEXPECTED');
    return { familyId, linkToken: row.link_token, secretWord: row.secret_word };
  }

  private async call<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.functions.invoke<T>('family-access', { body });
    if (error || !data) throw await fromFunctionError(error);
    return data;
  }

  async getInfo(linkToken: string): Promise<FamilyLinkInfo> {
    const r = await this.call<{ eventName: string; familyName: string; familyColor: FamilyColor }>({ action: 'info', token: linkToken });
    return { eventName: r.eventName, familyName: r.familyName, familyColor: r.familyColor };
  }

  async listMembers(linkToken: string, word: string): Promise<FamilyLinkMember[]> {
    const r = await this.call<{ members: FamilyLinkMember[] }>({ action: 'members', token: linkToken, word });
    return r.members;
  }

  async enter(linkToken: string, word: string, participantId: string): Promise<string> {
    const r = await this.call<{ tokenHash: string }>({ action: 'enter', token: linkToken, word, participantId });
    return r.tokenHash;
  }
}
