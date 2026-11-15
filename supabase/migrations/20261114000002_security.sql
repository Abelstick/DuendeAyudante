-- =====================================================================
-- Navidad en Familia — 0002: permisos (helpers, RLS, grants) y RPC
-- La matriz de permisos está en docs/fase-1/03-permisos-seguridad.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers usados por las políticas (no expuestos por la API: esquema app)
-- ---------------------------------------------------------------------
create or replace function app.my_role(p_event_id uuid)
returns public.event_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.event_members m
  join public.events e on e.id = m.event_id and e.deleted_at is null
  where m.event_id = p_event_id and m.user_id = auth.uid()
$$;

create or replace function app.is_member(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.my_role(p_event_id) is not null
$$;

-- Organizador o administrador
create or replace function app.is_manager(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.my_role(p_event_id) in ('owner', 'admin'), false)
$$;

-- Organizador, administrador o editor
create or replace function app.is_content_editor(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.my_role(p_event_id) in ('owner', 'admin', 'editor'), false)
$$;

-- Mi perfil (en cualquier evento) + las personas a mi cargo.
create or replace function app.acting_participant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id
    from public.participants p
    where p.user_id = auth.uid() and p.status = 'active'
  )
  select id from me
  union
  select g.ward_participant_id
  from public.guardianships g
  join me on me.id = g.guardian_participant_id
  join public.participants w on w.id = g.ward_participant_id and w.status = 'active'
$$;

create or replace function app.can_act_for(p_participant_id uuid, p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_participant_id in (select app.acting_participant_ids())
      or app.is_manager(p_event_id)
$$;

-- ---------------------------------------------------------------------
-- Grants: mínimo privilegio. anon no accede a nada.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema app from public, anon;
grant usage on schema app to authenticated;
grant execute on all functions in schema app to authenticated;

grant select on public.users to authenticated;

grant select on public.events to authenticated;
grant update (name, organizer_name, description, celebration_at, timezone, status) on public.events to authenticated;

grant select on public.event_members to authenticated;

grant select, delete on public.families to authenticated;
grant insert (event_id, name, color_key, dress_code_note, sort_order) on public.families to authenticated;
grant update (name, color_key, dress_code_note, sort_order) on public.families to authenticated;

-- user_id NO se puede escribir desde el navegador: solo la Edge Function create-member.
grant select, delete on public.participants to authenticated;
grant insert (event_id, family_id, first_name, paternal_surname, maternal_surname, distinguishing_note)
  on public.participants to authenticated;
grant update (family_id, first_name, paternal_surname, maternal_surname, distinguishing_note, status)
  on public.participants to authenticated;

grant select, insert, delete on public.guardianships to authenticated;

grant select on public.gift_exchanges to authenticated;
grant update (name, budget_max, delivery_at) on public.gift_exchanges to authenticated;

grant select, delete on public.wishlist_items to authenticated;
grant insert (event_id, participant_id, title, description, price_estimate, priority, sort_order)
  on public.wishlist_items to authenticated;
grant update (title, description, price_estimate, priority, sort_order) on public.wishlist_items to authenticated;

grant select, delete on public.wishlist_item_links to authenticated;
grant insert (item_id, url, label, sort_order) on public.wishlist_item_links to authenticated;

grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------
-- RLS: activada en TODAS las tablas
-- ---------------------------------------------------------------------
alter table public.users               enable row level security;
alter table public.events              enable row level security;
alter table public.event_members       enable row level security;
alter table public.families            enable row level security;
alter table public.participants        enable row level security;
alter table public.guardianships       enable row level security;
alter table public.gift_exchanges      enable row level security;
alter table public.wishlist_items      enable row level security;
alter table public.wishlist_item_links enable row level security;
alter table public.audit_log           enable row level security;

-- users: cada quien ve solo su propio perfil (los organizadores ven
-- usuarios de su evento mediante la RPC list_event_members).
create policy users_select_own on public.users
  for select to authenticated
  using (id = auth.uid());

-- events
create policy events_select_members on public.events
  for select to authenticated
  using (deleted_at is null and app.is_member(id));

create policy events_update_managers on public.events
  for update to authenticated
  using (app.is_manager(id))
  with check (app.is_manager(id));

-- event_members: mi propia membresía, o todas si gestiono el evento
create policy members_select on public.event_members
  for select to authenticated
  using (user_id = auth.uid() or app.is_manager(event_id));

-- families: todos los miembros ven; solo organizador/administradores gestionan
create policy families_select on public.families
  for select to authenticated
  using (app.is_member(event_id));

create policy families_insert on public.families
  for insert to authenticated
  with check (app.is_manager(event_id));

create policy families_update on public.families
  for update to authenticated
  using (app.is_manager(event_id))
  with check (app.is_manager(event_id));

create policy families_delete on public.families
  for delete to authenticated
  using (app.is_manager(event_id));

-- participants
create policy participants_select on public.participants
  for select to authenticated
  using (app.is_member(event_id) and (status = 'active' or app.is_manager(event_id)));

create policy participants_insert on public.participants
  for insert to authenticated
  with check (app.is_manager(event_id));

create policy participants_update on public.participants
  for update to authenticated
  using (app.is_manager(event_id))
  with check (app.is_manager(event_id));

create policy participants_delete on public.participants
  for delete to authenticated
  using (app.is_manager(event_id));

-- guardianships
create policy guardianships_select on public.guardianships
  for select to authenticated
  using (app.is_member(event_id));

create policy guardianships_insert on public.guardianships
  for insert to authenticated
  with check (app.is_manager(event_id));

create policy guardianships_delete on public.guardianships
  for delete to authenticated
  using (app.is_manager(event_id));

-- gift_exchanges
create policy gift_exchanges_select on public.gift_exchanges
  for select to authenticated
  using (app.is_member(event_id));

create policy gift_exchanges_update on public.gift_exchanges
  for update to authenticated
  using (app.is_manager(event_id))
  with check (app.is_manager(event_id));

-- wishlist_items: todos los miembros ven todas las listas;
-- escribe la persona, su tutor o un organizador/administrador.
create policy wishlist_items_select on public.wishlist_items
  for select to authenticated
  using (app.is_member(event_id));

create policy wishlist_items_insert on public.wishlist_items
  for insert to authenticated
  with check (app.can_act_for(participant_id, event_id));

create policy wishlist_items_update on public.wishlist_items
  for update to authenticated
  using (app.can_act_for(participant_id, event_id))
  with check (app.can_act_for(participant_id, event_id));

create policy wishlist_items_delete on public.wishlist_items
  for delete to authenticated
  using (app.can_act_for(participant_id, event_id));

-- wishlist_item_links: heredan los permisos del regalo
create policy wishlist_links_select on public.wishlist_item_links
  for select to authenticated
  using (exists (
    select 1 from public.wishlist_items i
    where i.id = item_id and app.is_member(i.event_id)
  ));

create policy wishlist_links_insert on public.wishlist_item_links
  for insert to authenticated
  with check (exists (
    select 1 from public.wishlist_items i
    where i.id = item_id and app.can_act_for(i.participant_id, i.event_id)
  ));

create policy wishlist_links_delete on public.wishlist_item_links
  for delete to authenticated
  using (exists (
    select 1 from public.wishlist_items i
    where i.id = item_id and app.can_act_for(i.participant_id, i.event_id)
  ));

-- audit_log: solo lectura para organizador/administradores
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (app.is_manager(event_id));

-- ---------------------------------------------------------------------
-- RPC (expuestas en public, solo para usuarios autenticados)
-- ---------------------------------------------------------------------

-- Crea el evento + organizador (owner) + su perfil de participante + intercambio.
create or replace function public.create_event(
  p_name               text,
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
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'TIMEZONE_INVALID' using errcode = '22023';
  end if;

  -- Límite anti-abuso: 10 eventos activos por organizador.
  if (select count(*) from public.events where owner_user_id = v_uid and deleted_at is null) >= 10 then
    raise exception 'EVENT_LIMIT_REACHED' using errcode = '54000';
  end if;

  v_full_name := concat_ws(' ',
    app.normalize_name(p_first_name),
    app.normalize_name(p_paternal_surname),
    app.normalize_name(p_maternal_surname));

  insert into public.events (owner_user_id, name, organizer_name, description, celebration_at, timezone)
  values (v_uid, btrim(p_name), coalesce(nullif(v_full_name, ''), 'ORGANIZADOR'), nullif(btrim(p_description), ''), p_celebration_at, p_timezone)
  returning id into v_event_id;

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

-- Contexto del usuario actual en un evento: rol, su perfil y personas a cargo.
create or replace function public.get_my_event_context(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.event_role := app.my_role(p_event_id);
begin
  if v_role is null then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'role', v_role,
    'participant', (
      select to_jsonb(p) - 'name_key'
      from public.participants p
      where p.event_id = p_event_id and p.user_id = auth.uid() and p.status = 'active'
    ),
    'wards', coalesce((
      select jsonb_agg(to_jsonb(w) - 'name_key' order by w.full_name)
      from public.participants me
      join public.guardianships g on g.guardian_participant_id = me.id
      join public.participants w on w.id = g.ward_participant_id and w.status = 'active'
      where me.event_id = p_event_id and me.user_id = auth.uid()
    ), '[]'::jsonb)
  );
end;
$$;

-- Lista de integrantes con su usuario y rol (solo organizador/administradores).
create or replace function public.list_event_members(p_event_id uuid)
returns table (
  participant_id       uuid,
  first_name           text,
  paternal_surname     text,
  maternal_surname     text,
  full_name            text,
  distinguishing_note  text,
  family_id            uuid,
  status               text,
  user_id              uuid,
  username             text,
  role                 public.event_role,
  guardian_ids         uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_manager(p_event_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select p.id, p.first_name, p.paternal_surname, p.maternal_surname, p.full_name,
         p.distinguishing_note, p.family_id, p.status, p.user_id, u.username, m.role,
         coalesce(array(
           select g.guardian_participant_id from public.guardianships g where g.ward_participant_id = p.id
         ), '{}')
  from public.participants p
  left join public.users u on u.id = p.user_id
  left join public.event_members m on m.event_id = p.event_id and m.user_id = p.user_id
  where p.event_id = p_event_id
  order by p.full_name;
end;
$$;

revoke all on function public.create_event(text, timestamptz, text, text, text, text, numeric, text) from public, anon;
revoke all on function public.get_my_event_context(uuid) from public, anon;
revoke all on function public.list_event_members(uuid) from public, anon;
grant execute on function public.create_event(text, timestamptz, text, text, text, text, numeric, text) to authenticated;
grant execute on function public.get_my_event_context(uuid) to authenticated;
grant execute on function public.list_event_members(uuid) to authenticated;
