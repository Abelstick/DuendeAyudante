-- =====================================================================
-- Navidad en Familia — 0005:
--  * El organizador puede cambiar el código de su Navidad. Los códigos
--    anteriores se guardan para que los enlaces ya enviados por WhatsApp
--    sigan funcionando (resolve_join_code los traduce al código actual).
--  * Nuevo color de familia: blanco.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Historial de códigos (sin acceso directo desde el navegador)
-- ---------------------------------------------------------------------
create table public.event_code_history (
  code        text primary key check (code ~ '^[A-Z0-9]{4,20}$'),
  event_id    uuid not null references public.events (id) on delete cascade,
  changed_at  timestamptz not null default now()
);

create index event_code_history_event on public.event_code_history (event_id);
alter table public.event_code_history enable row level security;
revoke all on public.event_code_history from anon, authenticated;

-- ¿Algún evento usa o usó este código?
create or replace function app.join_code_in_use(p_code text, p_except_event uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.events where join_code = p_code and id is distinct from p_except_event)
      or exists (select 1 from public.event_code_history where code = p_code and event_id is distinct from p_except_event)
$$;

-- Código escrito por la persona (actual o antiguo) → código actual. NULL si no existe.
-- Se usa antes de iniciar sesión, por eso también lo puede llamar `anon`.
-- Revela solo si un código existe (no es secreto: siempre hace falta la contraseña).
create or replace function public.resolve_join_code(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with c as (select app.normalize_join_code(p_code) as code)
  select coalesce(
    (select e.join_code from public.events e, c where e.join_code = c.code and e.deleted_at is null),
    (select e.join_code from public.event_code_history h join public.events e on e.id = h.event_id, c
      where h.code = c.code and e.deleted_at is null)
  )
$$;

revoke all on function public.resolve_join_code(text) from public;
grant execute on function public.resolve_join_code(text) to anon, authenticated;

create or replace function public.is_join_code_available(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not app.join_code_in_use(app.normalize_join_code(p_code))
$$;

-- create_event: además de los códigos actuales, no reutilizar códigos antiguos de otra Navidad
create or replace function public.create_event(
  p_name               text,
  p_join_code          text,
  p_celebration_at     timestamptz,
  p_first_name         text,
  p_paternal_surname   text,
  p_maternal_surname   text default null,
  p_timezone           text default 'America/Lima',
  p_budget             numeric default 65.00,
  p_description        text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_event_id   uuid;
  v_full_name  text;
  v_code       text := app.normalize_join_code(p_join_code);
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  if v_code !~ '^[A-Z0-9]{4,20}$' then
    raise exception 'JOIN_CODE_INVALID' using errcode = '23514';
  end if;

  if app.join_code_in_use(v_code) then
    raise exception 'JOIN_CODE_TAKEN' using errcode = '23505';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'TIMEZONE_INVALID' using errcode = '22023';
  end if;

  if (select count(*) from public.events where owner_user_id = v_uid and deleted_at is null) >= 10 then
    raise exception 'EVENT_LIMIT_REACHED' using errcode = '54000';
  end if;

  v_full_name := concat_ws(' ',
    app.normalize_name(p_first_name),
    app.normalize_name(p_paternal_surname),
    app.normalize_name(p_maternal_surname));

  begin
    insert into public.events (owner_user_id, name, join_code, organizer_name, description, celebration_at, timezone)
    values (v_uid, btrim(p_name), v_code, coalesce(nullif(v_full_name, ''), 'ORGANIZADOR'),
            nullif(btrim(p_description), ''), p_celebration_at, p_timezone)
    returning id into v_event_id;
  exception when unique_violation then
    raise exception 'JOIN_CODE_TAKEN' using errcode = '23505';
  end;

  insert into public.event_members (event_id, user_id, role)
  values (v_event_id, v_uid, 'owner');

  insert into public.participants (event_id, user_id, first_name, paternal_surname, maternal_surname)
  values (v_event_id, v_uid, p_first_name, p_paternal_surname, p_maternal_surname);

  insert into public.gift_exchanges (event_id, budget_max)
  values (v_event_id, coalesce(p_budget, 65.00));

  insert into public.audit_log (event_id, actor_user_id, action, entity, entity_id)
  values (v_event_id, v_uid, 'event.created', 'event', v_event_id);

  return v_event_id;
end;
$$;

-- Cambio de código: lo ejecuta la Edge Function change-join-code (service role)
-- DESPUÉS de actualizar los correos internos de los familiares.
create or replace function app.apply_join_code_change(p_event_id uuid, p_new_code text, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  select join_code into v_old from public.events where id = p_event_id for update;
  if v_old is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_old = p_new_code then
    return;
  end if;
  if app.join_code_in_use(p_new_code, p_event_id) then
    raise exception 'JOIN_CODE_TAKEN' using errcode = '23505';
  end if;

  -- Si vuelve a un código que ya tuvo, deja de ser "antiguo"
  delete from public.event_code_history where code = p_new_code and event_id = p_event_id;
  insert into public.event_code_history (code, event_id) values (v_old, p_event_id)
    on conflict (code) do nothing;
  update public.events set join_code = p_new_code where id = p_event_id;

  insert into public.audit_log (event_id, actor_user_id, action, entity, entity_id, metadata)
  values (p_event_id, p_actor, 'event.join_code_changed', 'event', p_event_id,
          jsonb_build_object('from', v_old, 'to', p_new_code));
end;
$$;

-- Solo el servidor (service role) puede aplicar el cambio
revoke all on function app.apply_join_code_change(uuid, text, uuid) from public, anon, authenticated;
grant execute on function app.apply_join_code_change(uuid, text, uuid) to service_role;

-- Accesible para la Edge Function vía RPC: envoltorio en public, solo service_role
create or replace function public.apply_join_code_change(p_event_id uuid, p_new_code text, p_actor uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select app.apply_join_code_change(p_event_id, p_new_code, p_actor)
$$;

revoke all on function public.apply_join_code_change(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.apply_join_code_change(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------
-- Color blanco para las familias
-- ---------------------------------------------------------------------
alter table public.families drop constraint if exists families_color_key_check;
alter table public.families
  add constraint families_color_key_check
  check (color_key in ('red', 'green', 'gold', 'blue', 'purple', 'orange', 'pink', 'teal', 'white'));
