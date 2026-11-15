-- =====================================================================
-- Navidad en Familia — 0019: mensajes navideños con sorpresa
-- Cualquiera le deja un mensaje a otro familiar. Quien lo recibe sabe
-- que tiene mensajes esperando, pero solo puede leerlos desde la
-- medianoche del día de la celebración (ej. el 25 a las 00:00 si la
-- celebración es el 24). Puede ser anónimo.
--  * Quien escribe (o su tutor) ve, cambia y borra lo suyo.
--  * Quien recibe lo lee con la RPC list_received_messages.
--  * Nadie más lo ve: ni el organizador ni los administradores.
-- =====================================================================

-- Medianoche siguiente al día de la celebración, en la zona del evento.
create or replace function app.event_unlock_at(p_event_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select (((e.celebration_at at time zone e.timezone)::date + 1)::timestamp) at time zone e.timezone
  from public.events e
  where e.id = p_event_id
$$;

create table public.holiday_messages (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.events (id) on delete cascade,
  from_participant_id  uuid not null,
  to_participant_id    uuid not null,
  body                 text not null check (char_length(btrim(body)) between 1 and 1000),
  anonymous            boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (event_id, from_participant_id) references public.participants (event_id, id) on delete cascade,
  foreign key (event_id, to_participant_id) references public.participants (event_id, id) on delete cascade,
  check (from_participant_id <> to_participant_id)
);

create index holiday_messages_to on public.holiday_messages (event_id, to_participant_id);
create index holiday_messages_from on public.holiday_messages (from_participant_id);
create trigger holiday_messages_updated_at before update on public.holiday_messages
  for each row execute function app.set_updated_at();

-- Límite anti-abuso: 30 mensajes por persona
create or replace function app.holiday_messages_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.holiday_messages where from_participant_id = new.from_participant_id) >= 30 then
    raise exception 'TOO_MANY_MESSAGES' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger holiday_messages_limit before insert on public.holiday_messages
  for each row execute function app.holiday_messages_limit();

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke all on public.holiday_messages from anon, authenticated;
grant select, delete on public.holiday_messages to authenticated;
grant insert (event_id, from_participant_id, to_participant_id, body, anonymous) on public.holiday_messages to authenticated;
grant update (to_participant_id, body, anonymous) on public.holiday_messages to authenticated;

alter table public.holiday_messages enable row level security;

-- Solo quien lo escribió (o su tutor). Quien lo recibe usa la RPC.
create policy holiday_messages_select on public.holiday_messages
  for select to authenticated
  using (app.is_member(event_id) and from_participant_id in (select app.acting_participant_ids()));

create policy holiday_messages_insert on public.holiday_messages
  for insert to authenticated
  with check (app.is_member(event_id) and from_participant_id in (select app.acting_participant_ids()));

create policy holiday_messages_update on public.holiday_messages
  for update to authenticated
  using (from_participant_id in (select app.acting_participant_ids()))
  with check (from_participant_id in (select app.acting_participant_ids()));

create policy holiday_messages_delete on public.holiday_messages
  for delete to authenticated
  using (from_participant_id in (select app.acting_participant_ids()));

-- ---------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------

-- Mensajes para mí (y para las personas a mi cargo). Antes de la hora de
-- apertura solo se sabe que existen: el texto y la firma llegan vacíos.
create or replace function public.list_received_messages(p_event_id uuid)
returns table (
  id                 uuid,
  to_participant_id  uuid,
  from_name          text,
  body               text,
  created_at         timestamptz,
  unlock_at          timestamptz,
  unlocked           boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_unlock timestamptz := app.event_unlock_at(p_event_id);
  v_open   boolean := now() >= v_unlock;
begin
  if not app.is_member(p_event_id) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;

  return query
  select m.id,
         m.to_participant_id,
         case when v_open and not m.anonymous then f.full_name end,
         case when v_open then m.body end,
         m.created_at,
         v_unlock,
         v_open
  from public.holiday_messages m
  join public.participants f on f.id = m.from_participant_id
  where m.event_id = p_event_id
    and m.to_participant_id in (select app.acting_participant_ids())
  order by m.created_at;
end;
$$;

revoke all on function public.list_received_messages(uuid) from public, anon;
grant execute on function public.list_received_messages(uuid) to authenticated;
grant execute on function app.event_unlock_at(uuid) to authenticated;
