-- =====================================================================
-- Navidad en Familia — 0004: código de cada Navidad + usuarios únicos
-- por Navidad (no en toda la plataforma).
--
-- Para entrar, un familiar usa: código de la Navidad + usuario + contraseña.
-- Así dos Navidades distintas pueden tener cada una su "rosa".
-- =====================================================================

-- "Navidad García" → "NAVIDADGARCIA": mayúsculas, sin tildes, solo letras y números.
create or replace function app.normalize_join_code(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(upper(coalesce(raw, '')), 'ÁÉÍÓÚÜÑÀÈÌÒÙáéíóúüñ', 'AEIOUUNAEIOUAEIOUUN'),
    '[^A-Z0-9]', '', 'g'
  )
$$;

grant execute on function app.normalize_join_code(text) to authenticated;

-- ---------------------------------------------------------------------
-- events.join_code
-- ---------------------------------------------------------------------
alter table public.events add column join_code text;

update public.events
   set join_code = upper(substr(md5(id::text), 1, 8))
 where join_code is null;

alter table public.events alter column join_code set not null;
alter table public.events
  add constraint events_join_code_format check (join_code ~ '^[A-Z0-9]{4,20}$');
create unique index events_join_code_key on public.events (join_code);

-- ---------------------------------------------------------------------
-- users: el usuario es único dentro de su Navidad
-- ---------------------------------------------------------------------
alter table public.users
  add column home_event_id uuid references public.events (id) on delete set null;

alter table public.users drop constraint if exists users_username_key;
alter table public.users drop constraint if exists users_username_check;
alter table public.users
  add constraint users_username_format check (username ~ '^[a-z0-9][a-z0-9._-]{1,29}$');

create unique index users_username_per_event on public.users (home_event_id, username)
  where home_event_id is not null;
create unique index users_username_organizers on public.users (username)
  where home_event_id is null;

-- El perfil de la cuenta guarda en qué Navidad fue creada (lo escribe la
-- Edge Function en app_metadata, que solo el servidor puede modificar).
create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin_created boolean := coalesce(new.raw_app_meta_data ->> 'created_by', '') = 'admin';
begin
  insert into public.users (id, username, display_name, real_email, home_event_id)
  values (
    new.id,
    case when v_is_admin_created
         then new.raw_app_meta_data ->> 'username'
         else 'org-' || substr(md5(new.id::text), 1, 20) end,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    case when v_is_admin_created then null else new.email end,
    case when v_is_admin_created then (new.raw_app_meta_data ->> 'created_in_event_id')::uuid else null end
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- create_event ahora recibe el código elegido por el organizador
-- ---------------------------------------------------------------------
drop function if exists public.create_event(text, timestamptz, text, text, text, text, numeric, text);

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

  if exists (select 1 from public.events where join_code = v_code) then
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

-- ¿Está libre este código? (para avisar antes de crear la Navidad)
create or replace function public.is_join_code_available(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.events where join_code = app.normalize_join_code(p_code))
$$;

revoke all on function public.create_event(text, text, timestamptz, text, text, text, text, numeric, text) from public, anon;
revoke all on function public.is_join_code_available(text) from public, anon;
grant execute on function public.create_event(text, text, timestamptz, text, text, text, text, numeric, text) to authenticated;
grant execute on function public.is_join_code_available(text) to authenticated;
