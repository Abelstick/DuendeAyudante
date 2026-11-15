import type { SupabaseClient } from '@supabase/supabase-js';
import { fromFunctionError } from '@/shared/infrastructure/supabase/errors';
import type { CreatedMember, IMemberAccountService, NewMemberData } from '../domain/IMemberAccountService';

/** Crea y gestiona cuentas mediante Edge Functions (únicas con la clave de servicio). */
export class EdgeFunctionMemberAccountService implements IMemberAccountService {
  constructor(private readonly supabase: SupabaseClient) {}

  async createMember(data: NewMemberData): Promise<CreatedMember> {
    const { data: result, error } = await this.supabase.functions.invoke<CreatedMember>('create-member', { body: data });
    if (error || !result) throw await fromFunctionError(error);
    return result;
  }

  async resetPassword(eventId: string, participantId: string, newPassword: string): Promise<void> {
    const { error } = await this.supabase.functions.invoke('reset-member-password', {
      body: { eventId, participantId, newPassword },
    });
    if (error) throw await fromFunctionError(error);
  }
}
