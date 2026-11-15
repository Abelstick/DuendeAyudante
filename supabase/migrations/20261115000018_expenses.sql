-- =====================================================================
-- Navidad en Familia — 0018: cuentas claras (gastos y pagos)
--  * expenses: un gasto ("Pavo, S/ 180, lo pagó Juan") o un pago entre
--    dos personas para saldar cuentas ("Rosa le pagó S/ 20 a Juan").
--  * expense_shares: entre quiénes se divide el gasto (partes iguales).
--    En un pago hay una sola persona: quien lo recibe.
-- Todos los del evento ven las cuentas. Se escriben solo con las RPC
-- save_expense / delete_expense, que validan quién puede hacerlo:
--  · organizador, administradores y editores: cualquier gasto o pago;
--  · cada persona (o su tutor): lo que pagó ella, y los pagos que recibe.
-- Los saldos y "quién le paga a quién" se calculan en la app.
-- =====================================================================

create table public.expenses (
  id                      uuid primary key default gen_random_uuid(),
  event_id                uuid not null references public.events (id) on delete cascade,
  kind                    text not null default 'expense' check (kind in ('expense', 'payment')),
  description             text not null check (char_length(btrim(description)) between 1 and 120),
  amount                  numeric(10, 2) not null check (amount > 0 and amount < 100000000),
  paid_by_participant_id  uuid not null,
  responsibility_id       uuid,
  created_by_user_id      uuid references public.users (id) on delete set null default auth.uid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (event_id, id),
  foreign key (event_id, paid_by_participant_id) references public.participants (event_id, id) on delete cascade,
  foreign key (event_id, responsibility_id) references public.responsibilities (event_id, id) on delete set null (responsibility_id)
);

create index expenses_event on public.expenses (event_id, created_at);
create trigger expenses_updated_at before update on public.expenses
  for each row execute function app.set_updated_at();

create table public.expense_shares (
  event_id        uuid not null,
  expense_id      uuid not null,
  participant_id  uuid not null,
  primary key (expense_id, participant_id),
  foreign key (event_id, expense_id) references public.expenses (event_id, id) on delete cascade,
  foreign key (event_id, participant_id) references public.participants (event_id, id) on delete cascade
);

create index expense_shares_participant on public.expense_shares (participant_id);

-- ¿Puede el usuario actual escribir este gasto/pago? (con sus datos actuales)
create or replace function app.can_write_expense(
  p_event_id uuid,
  p_kind text,
  p_paid_by uuid,
  p_receiver uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_content_editor(p_event_id)
      or p_paid_by in (select app.acting_participant_ids())
      or (p_kind = 'payment' and p_receiver in (select app.acting_participant_ids()))
$$;

-- ---------------------------------------------------------------------
-- Permisos: solo lectura directa; se escribe con las RPC
-- ---------------------------------------------------------------------
revoke all on public.expenses, public.expense_shares from anon, authenticated;
grant select on public.expenses, public.expense_shares to authenticated;

alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;

create policy expenses_select on public.expenses
  for select to authenticated
  using (app.is_member(event_id));

create policy expense_shares_select on public.expense_shares
  for select to authenticated
  using (app.is_member(event_id));

-- ---------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------

-- Crea o edita un gasto/pago con sus participantes, todo o nada.
create or replace function public.save_expense(
  p_event_id           uuid,
  p_kind               text,
  p_description        text,
  p_amount             numeric,
  p_paid_by            uuid,
  p_participant_ids    uuid[],
  p_responsibility_id  uuid default null,
  p_id                 uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids       uuid[] := array(select distinct x from unnest(coalesce(p_participant_ids, '{}')) as x where x is not null);
  v_receiver  uuid;
  v_old       public.expenses%rowtype;
  v_id        uuid;
begin
  if not app.is_member(p_event_id) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;
  if p_kind not in ('expense', 'payment') then
    raise exception 'EXPENSE_KIND_INVALID' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount >= 100000000 or p_amount <> round(p_amount, 2) then
    raise exception 'AMOUNT_INVALID' using errcode = '23514';
  end if;
  if char_length(btrim(coalesce(p_description, ''))) not between 1 and 120 then
    raise exception 'EXPENSE_DESCRIPTION_INVALID' using errcode = '23514';
  end if;
  if cardinality(v_ids) = 0 then
    raise exception 'EXPENSE_SHARES_REQUIRED' using errcode = '23514';
  end if;
  if p_kind = 'payment' then
    if cardinality(v_ids) <> 1 or v_ids[1] = p_paid_by then
      raise exception 'PAYMENT_RECEIVER_INVALID' using errcode = '23514';
    end if;
    v_receiver := v_ids[1];
  end if;

  -- Quien paga y entre quiénes se divide: personas activas de esta Navidad
  if not exists (select 1 from public.participants where id = p_paid_by and event_id = p_event_id and status = 'active') then
    raise exception 'PARTICIPANT_NOT_FOUND' using errcode = '23514';
  end if;
  if (select count(*) from public.participants where id = any (v_ids) and event_id = p_event_id and status = 'active') <> cardinality(v_ids) then
    raise exception 'PARTICIPANT_NOT_FOUND' using errcode = '23514';
  end if;
  if p_responsibility_id is not null
     and not exists (select 1 from public.responsibilities where id = p_responsibility_id and event_id = p_event_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not app.can_write_expense(p_event_id, p_kind, p_paid_by, v_receiver) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_id is null then
    insert into public.expenses (event_id, kind, description, amount, paid_by_participant_id, responsibility_id)
    values (p_event_id, p_kind, btrim(p_description), p_amount, p_paid_by, p_responsibility_id)
    returning id into v_id;
  else
    select * into v_old from public.expenses where id = p_id and event_id = p_event_id;
    if v_old.id is null then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
    -- También debe poder escribir el registro tal como estaba
    if not app.can_write_expense(
      p_event_id, v_old.kind, v_old.paid_by_participant_id,
      (select s.participant_id from public.expense_shares s where s.expense_id = v_old.id and v_old.kind = 'payment' limit 1)
    ) then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;

    update public.expenses
       set kind = p_kind,
           description = btrim(p_description),
           amount = p_amount,
           paid_by_participant_id = p_paid_by,
           responsibility_id = p_responsibility_id
     where id = p_id
    returning id into v_id;

    delete from public.expense_shares where expense_id = v_id;
  end if;

  insert into public.expense_shares (event_id, expense_id, participant_id)
  select p_event_id, v_id, x from unnest(v_ids) as x;

  return v_id;
end;
$$;

create or replace function public.delete_expense(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.expenses%rowtype;
begin
  select * into v_old from public.expenses where id = p_id;
  if v_old.id is null or not app.is_member(v_old.event_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not app.can_write_expense(
    v_old.event_id, v_old.kind, v_old.paid_by_participant_id,
    (select s.participant_id from public.expense_shares s where s.expense_id = v_old.id and v_old.kind = 'payment' limit 1)
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  delete from public.expenses where id = p_id;
end;
$$;

revoke all on function public.save_expense(uuid, text, text, numeric, uuid, uuid[], uuid, uuid) from public, anon;
revoke all on function public.delete_expense(uuid) from public, anon;
grant execute on function public.save_expense(uuid, text, text, numeric, uuid, uuid[], uuid, uuid) to authenticated;
grant execute on function public.delete_expense(uuid) to authenticated;
grant execute on function app.can_write_expense(uuid, text, uuid, uuid) to authenticated;
