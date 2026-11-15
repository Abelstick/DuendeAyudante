-- =====================================================================
-- Navidad en Familia — 0008: juegos y actividades
--  * Cualquiera agrega ideas (entran directo, sin aprobación).
--  * No puede haber dos juegos vigentes con el mismo nombre.
--  * Organizador/administradores/editores pueden unir juegos parecidos;
--    los votos pasan al juego resultante (una sola vez por persona).
--  * Votación: hasta N votos por participante, 1 por juego. Los tutores
--    votan por cada persona a su cargo.
-- =====================================================================

-- "Las Charadas  Navideñas!" → "LAS CHARADAS NAVIDENAS"
create or replace function app.normalize_game_name(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(upper(coalesce(raw, '')), 'ÁÉÍÓÚÜÑÀÈÌÒÙáéíóúüñ', 'AEIOUUNAEIOUAEIOUUN'),
    '[^A-Z0-9]+', ' ', 'g'
  ))
$$;

create table public.games (
  id                          uuid primary key default gen_random_uuid(),
  event_id                    uuid not null references public.events (id) on delete cascade,
  proposed_by_participant_id  uuid,
  responsible_participant_id  uuid,
  name                        text not null check (char_length(btrim(name)) between 1 and 100),
  name_key                    text not null,
  category                    text not null default 'family_bonding'
                              check (category in ('competition', 'family_bonding', 'board', 'movement', 'trivia_challenges', 'kids', 'adults')),
  description                 text check (description is null or char_length(description) <= 1000),
  duration_minutes            int check (duration_minutes is null or duration_minutes between 1 and 600),
  min_players                 int check (min_players is null or min_players between 1 and 500),
  max_players                 int check (max_players is null or max_players between 1 and 500),
  materials                   text check (materials is null or char_length(materials) <= 1000),
  instructions                text check (instructions is null or char_length(instructions) <= 3000),
  status                      text not null default 'active' check (status in ('active', 'merged', 'played')),
  merged_into_game_id         uuid references public.games (id) on delete set null,
  created_by_user_id          uuid references public.users (id) on delete set null default auth.uid(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (event_id, id),
  foreign key (event_id, proposed_by_participant_id) references public.participants (event_id, id) on delete set null (proposed_by_participant_id),
  foreign key (event_id, responsible_participant_id) references public.participants (event_id, id) on delete set null (responsible_participant_id),
  check (min_players is null or max_players is null or min_players <= max_players)
);

create unique index games_unique_name on public.games (event_id, name_key) where status in ('active', 'played');
create index games_event on public.games (event_id, status);

create or replace function app.games_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  new.name_key := app.normalize_game_name(new.name);
  if new.name_key = '' then
    raise exception 'GAME_NAME_INVALID' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger games_normalize before insert or update on public.games
  for each row execute function app.games_before_write();
create trigger games_updated_at before update on public.games
  for each row execute function app.set_updated_at();

-- Una votación por Navidad (v1)
create table public.game_polls (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null unique references public.events (id) on delete cascade,
  status     text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  max_votes  int not null default 3 check (max_votes between 1 and 10),
  opened_at  timestamptz,
  closed_at  timestamptz,
  created_at timestamptz not null default now()
);

create table public.game_votes (
  poll_id         uuid not null references public.game_polls (id) on delete cascade,
  game_id         uuid not null references public.games (id) on delete cascade,
  participant_id  uuid not null references public.participants (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (poll_id, game_id, participant_id)
);

create index game_votes_game on public.game_votes (game_id);
create index game_votes_participant on public.game_votes (poll_id, participant_id);

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke all on public.games, public.game_polls, public.game_votes from anon, authenticated;

grant select, delete on public.games to authenticated;
grant insert (event_id, proposed_by_participant_id, responsible_participant_id, name, category, description,
              duration_minutes, min_players, max_players, materials, instructions) on public.games to authenticated;
grant update (responsible_participant_id, name, category, description, duration_minutes, min_players, max_players,
              materials, instructions, status) on public.games to authenticated;
grant select on public.game_polls, public.game_votes to authenticated;

alter table public.games enable row level security;
alter table public.game_polls enable row level security;
alter table public.game_votes enable row level security;

create policy games_select on public.games
  for select to authenticated
  using (app.is_member(event_id));

-- Cualquiera del evento propone, a su nombre o al de alguien a su cargo
create policy games_insert on public.games
  for insert to authenticated
  with check (
    app.is_member(event_id)
    and (proposed_by_participant_id in (select app.acting_participant_ids()) or app.is_content_editor(event_id))
  );

-- Editan: quien la propuso (sin cambiar el estado) o organizador/administradores/editores
create policy games_update on public.games
  for update to authenticated
  using (app.is_content_editor(event_id) or proposed_by_participant_id in (select app.acting_participant_ids()))
  with check (
    app.is_content_editor(event_id)
    or (proposed_by_participant_id in (select app.acting_participant_ids()) and status = 'active')
  );

create policy games_delete on public.games
  for delete to authenticated
  using (app.is_content_editor(event_id) or proposed_by_participant_id in (select app.acting_participant_ids()));

create policy game_polls_select on public.game_polls
  for select to authenticated
  using (app.is_member(event_id));

create policy game_votes_select on public.game_votes
  for select to authenticated
  using (exists (select 1 from public.game_polls p where p.id = poll_id and app.is_member(p.event_id)));

-- ---------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------

-- Abrir / cerrar / reiniciar la votación (organizador, administradores, editores)
create or replace function public.set_game_poll(p_event_id uuid, p_status text, p_max_votes int default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_content_editor(p_event_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'open', 'closed') then
    raise exception 'STATUS_INVALID' using errcode = '22023';
  end if;
  if p_max_votes is not null and p_max_votes not between 1 and 10 then
    raise exception 'MAX_VOTES_INVALID' using errcode = '22023';
  end if;

  insert into public.game_polls (event_id, status, max_votes, opened_at, closed_at)
  values (p_event_id, p_status, coalesce(p_max_votes, 3),
          case when p_status = 'open' then now() end,
          case when p_status = 'closed' then now() end)
  on conflict (event_id) do update
    set status = excluded.status,
        max_votes = coalesce(p_max_votes, public.game_polls.max_votes),
        opened_at = case when excluded.status = 'open' then now() else public.game_polls.opened_at end,
        closed_at = case when excluded.status = 'closed' then now() else null end;
end;
$$;

create or replace function public.cast_game_vote(p_game_id uuid, p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event  uuid;
  v_status text;
  v_poll   public.game_polls;
  v_used   int;
begin
  select event_id, status into v_event, v_status from public.games where id = p_game_id;
  if v_event is null or not app.is_member(v_event) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_status <> 'active' then
    raise exception 'GAME_NOT_VOTABLE' using errcode = '22023';
  end if;
  if p_participant_id not in (select app.acting_participant_ids())
     or not exists (select 1 from public.participants where id = p_participant_id and event_id = v_event) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_poll from public.game_polls where event_id = v_event;
  if v_poll.id is null or v_poll.status <> 'open' then
    raise exception 'POLL_CLOSED' using errcode = '22023';
  end if;

  -- Serializa los votos de esta persona para respetar el límite
  perform 1 from public.participants where id = p_participant_id for update;

  if exists (select 1 from public.game_votes where poll_id = v_poll.id and game_id = p_game_id and participant_id = p_participant_id) then
    return;
  end if;

  select count(*) into v_used from public.game_votes where poll_id = v_poll.id and participant_id = p_participant_id;
  if v_used >= v_poll.max_votes then
    raise exception 'VOTE_LIMIT_REACHED' using errcode = '22023';
  end if;

  insert into public.game_votes (poll_id, game_id, participant_id) values (v_poll.id, p_game_id, p_participant_id);
end;
$$;

create or replace function public.remove_game_vote(p_game_id uuid, p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid;
  v_poll  public.game_polls;
begin
  select event_id into v_event from public.games where id = p_game_id;
  if v_event is null or not app.is_member(v_event) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_participant_id not in (select app.acting_participant_ids()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_poll from public.game_polls where event_id = v_event;
  if v_poll.id is null or v_poll.status <> 'open' then
    raise exception 'POLL_CLOSED' using errcode = '22023';
  end if;
  delete from public.game_votes where poll_id = v_poll.id and game_id = p_game_id and participant_id = p_participant_id;
end;
$$;

-- Unir juegos parecidos. p_target_id = juego que se conserva; si es NULL se
-- crea uno nuevo con los datos recibidos. Los votos pasan al resultado (sin duplicar).
create or replace function public.merge_games(
  p_event_id          uuid,
  p_game_ids          uuid[],
  p_target_id         uuid default null,
  p_name              text default null,
  p_category          text default null,
  p_description       text default null,
  p_duration_minutes  int default null,
  p_min_players       int default null,
  p_max_players       int default null,
  p_materials         text default null,
  p_instructions      text default null,
  p_responsible_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target  uuid := p_target_id;
  v_sources uuid[];
begin
  if not app.is_content_editor(p_event_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select array_agg(id) into v_sources
  from public.games
  where id = any(p_game_ids) and event_id = p_event_id and status = 'active';

  if coalesce(array_length(v_sources, 1), 0) < 2 or array_length(v_sources, 1) <> array_length(p_game_ids, 1) then
    raise exception 'MERGE_NEEDS_TWO_GAMES' using errcode = '22023';
  end if;
  if v_target is not null and not (v_target = any(v_sources)) then
    raise exception 'MERGE_TARGET_INVALID' using errcode = '22023';
  end if;

  -- Los que dejan de existir como juego propio
  update public.games set status = 'merged'
   where id = any(v_sources) and id is distinct from v_target;

  if v_target is null then
    insert into public.games (event_id, name, category, description, duration_minutes, min_players, max_players,
                              materials, instructions, responsible_participant_id)
    values (p_event_id, p_name, coalesce(p_category, 'family_bonding'), nullif(btrim(p_description), ''), p_duration_minutes,
            p_min_players, p_max_players, nullif(btrim(p_materials), ''), nullif(btrim(p_instructions), ''), p_responsible_id)
    returning id into v_target;
  elsif p_name is not null then
    update public.games
       set name = p_name,
           category = coalesce(p_category, category),
           description = nullif(btrim(p_description), ''),
           duration_minutes = p_duration_minutes,
           min_players = p_min_players,
           max_players = p_max_players,
           materials = nullif(btrim(p_materials), ''),
           instructions = nullif(btrim(p_instructions), ''),
           responsible_participant_id = p_responsible_id
     where id = v_target;
  end if;

  update public.games set merged_into_game_id = v_target
   where id = any(v_sources) and id <> v_target;

  -- Los votos pasan al juego resultante, una sola vez por persona
  insert into public.game_votes (poll_id, game_id, participant_id)
  select distinct v.poll_id, v_target, v.participant_id
  from public.game_votes v
  where v.game_id = any(v_sources) and v.game_id <> v_target
  on conflict do nothing;

  delete from public.game_votes where game_id = any(v_sources) and game_id <> v_target;

  insert into public.audit_log (event_id, actor_user_id, action, entity, entity_id, metadata)
  values (p_event_id, auth.uid(), 'games.merged', 'game', v_target, jsonb_build_object('sources', v_sources));

  return v_target;
end;
$$;

revoke all on function public.set_game_poll(uuid, text, int) from public, anon;
revoke all on function public.cast_game_vote(uuid, uuid) from public, anon;
revoke all on function public.remove_game_vote(uuid, uuid) from public, anon;
revoke all on function public.merge_games(uuid, uuid[], uuid, text, text, text, int, int, int, text, text, uuid) from public, anon;
grant execute on function public.set_game_poll(uuid, text, int) to authenticated;
grant execute on function public.cast_game_vote(uuid, uuid) to authenticated;
grant execute on function public.remove_game_vote(uuid, uuid) to authenticated;
grant execute on function public.merge_games(uuid, uuid[], uuid, text, text, text, int, int, int, text, text, uuid) to authenticated;
