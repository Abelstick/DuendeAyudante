import type { SupabaseClient } from '@supabase/supabase-js';
import { mapParticipantRow, type ParticipantRow } from '@/modules/members/infrastructure/mappers';
import { AppError } from '@/shared/domain/errors';
import { fromFunctionError, fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import type { ChristmasEvent, EventContext, EventRole, MyEventSummary } from '../domain/Event';
import type { CreateEventData, IEventRepository } from '../domain/IEventRepository';

interface EventRow {
  id: string;
  name: string;
  join_code: string;
  organizer_name: string;
  description: string | null;
  celebration_at: string;
  timezone: string;
  currency: string;
  gift_exchanges: { id: string; budget_max: number | string }[] | null;
}

const EVENT_COLUMNS = 'id, name, join_code, organizer_name, description, celebration_at, timezone, currency, gift_exchanges(id, budget_max)';

function mapEvent(row: EventRow): ChristmasEvent {
  const exchange = row.gift_exchanges?.[0];
  return {
    id: row.id,
    name: row.name,
    joinCode: row.join_code,
    organizerName: row.organizer_name,
    description: row.description,
    celebrationAt: new Date(row.celebration_at),
    timezone: row.timezone,
    currency: row.currency.trim(),
    giftExchange: exchange ? { id: exchange.id, budgetMax: Number(exchange.budget_max) } : null,
  };
}

export class SupabaseEventRepository implements IEventRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listMine(): Promise<MyEventSummary[]> {
    const { data: session } = await this.supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) throw new AppError('NOT_AUTHENTICATED');

    const { data, error } = await this.supabase
      .from('event_members')
      .select(`role, events!inner(${EVENT_COLUMNS})`)
      .eq('user_id', userId)
      .returns<{ role: EventRole; events: EventRow }[]>();
    if (error) throw fromPostgrestError(error);
    return (data ?? [])
      .map((r) => ({ role: r.role, event: mapEvent(r.events) }))
      .sort((a, b) => a.event.celebrationAt.getTime() - b.event.celebrationAt.getTime());
  }

  async findById(id: string): Promise<ChristmasEvent | null> {
    const { data, error } = await this.supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle<EventRow>();
    if (error) throw fromPostgrestError(error);
    return data ? mapEvent(data) : null;
  }

  async create(data: CreateEventData): Promise<string> {
    const { data: id, error } = await this.supabase.rpc('create_event', {
      p_name: data.name,
      p_join_code: data.joinCode,
      p_celebration_at: data.celebrationAt.toISOString(),
      p_first_name: data.firstName,
      p_paternal_surname: data.paternalSurname,
      p_maternal_surname: data.maternalSurname,
      p_timezone: data.timezone,
      p_budget: data.budget,
      p_description: data.description,
    });
    if (error) throw fromPostgrestError(error);
    return id as string;
  }

  async isJoinCodeAvailable(code: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('is_join_code_available', { p_code: code });
    if (error) throw fromPostgrestError(error);
    return data === true;
  }

  async changeJoinCode(eventId: string, newCode: string): Promise<string> {
    const { data, error } = await this.supabase.functions.invoke<{ joinCode: string }>('change-join-code', {
      body: { eventId, newCode },
    });
    if (error || !data) throw await fromFunctionError(error);
    return data.joinCode;
  }

  async updateBudget(eventId: string, amount: number): Promise<void> {
    const { data, error } = await this.supabase
      .from('gift_exchanges')
      .update({ budget_max: amount })
      .eq('event_id', eventId)
      .select('id');
    if (error) throw fromPostgrestError(error);
    // RLS filtra en silencio: sin filas significa que no tiene permiso
    if (!data || data.length === 0) throw new AppError('FORBIDDEN');
  }

  async updateDescription(eventId: string, description: string | null): Promise<void> {
    const { data, error } = await this.supabase.from('events').update({ description }).eq('id', eventId).select('id');
    if (error) throw fromPostgrestError(error);
    if (!data || data.length === 0) throw new AppError('FORBIDDEN');
  }

  async getMyContext(eventId: string): Promise<EventContext> {
    const { data, error } = await this.supabase.rpc('get_my_event_context', { p_event_id: eventId });
    if (error) throw fromPostgrestError(error);
    const ctx = data as { role: EventRole; participant: ParticipantRow | null; wards: ParticipantRow[] };
    return {
      role: ctx.role,
      me: ctx.participant ? mapParticipantRow(ctx.participant) : null,
      wards: ctx.wards.map(mapParticipantRow),
    };
  }
}
