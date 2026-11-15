-- =====================================================================
-- Navidad en Familia — 0007: responsabilidades y aportes
--  * Las crean organizador, administradores y editores.
--  * Responsables: una o varias personas y/o familias completas.
--  * Todos los del evento las ven. Cada responsable (o su tutor) solo puede
--    cambiar el ESTADO, mediante la RPC set_responsibility_status.
-- =====================================================================

create table public.responsibilities (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references public.events (id) on delete cascade,
  kind                  text not null default 'contribution' check (kind in ('contribution', 'task')),
  category              text not null default 'other'
                        check (category in ('decoration', 'food', 'salads', 'desserts', 'drinks', 'tableware', 'music', 'other')),
  title                 text not null check (char_length(btrim(title)) between 1 and 120),
  description           text check (description is null or char_length(description) <= 1000),
  due_date              date,
  status                text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  notes                 text check (notes is null or char_length(notes) <= 1000),
  sort_order            int not null default 0,
  completed_at          timestamptz,
  completed_by_user_id  uuid references public.users (id) on delete set null,
  created_by_user_id    uuid references public.users (id) on delete set null default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (event_id, id)
);

create index responsibilities_event on public.responsibilities (event_id, status);
create trigger responsibilities_updated_at before update on public.responsibilities
  for each row execute function app.set_updated_at();

-- Registra quién y cuándo la completó
create or replace function app.responsibilities_track_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
    new.completed_by_user_id := auth.uid();
  elsif new.status <> 'done' then
    new.completed_at := null;
    new.completed_by_user_id := null;
  end if;
  return new;
end;
$$;

create trigger responsibilities_completion before insert or update on public.responsibilities
  for each row execute function app.responsibilities_track_completion();

create table public.responsibility_assignees (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null,
  responsibility_id  uuid not null,
  participant_id     uuid,
  family_id          uuid,
  foreign key (event_id, responsibility_id) references public.responsibilities (event_id, id) on delete cascade,
  foreign key (event_id, participant_id) references public.participants (event_id, id) on delete cascade,
  foreign key (event_id, family_id) references public.families (event_id, id) on delete cascade,
  check ((participant_id is null) <> (family_id is null))
);

create unique index responsibility_assignees_person on public.responsibility_assignees (responsibility_id, participant_id)
  where participant_id is not null;
create unique index responsibility_assignees_family on public.responsibility_assignees (responsibility_id, family_id)
  where family_id is not null;
create index responsibility_assignees_resp on public.responsibility_assignees (responsibility_id);

-- ¿El usuario actual (o alguien a su cargo) es responsable? Directo o por su familia.
create or replace function app.is_responsible(p_responsibility_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.responsibility_assignees a
    where a.responsibility_id = p_responsibility_id
      and (
        a.participant_id in (select app.acting_participant_ids())
        or a.family_id in (
          select p.family_id from public.participants p
          where p.id in (select app.acting_participant_ids()) and p.family_id is not null
        )
      )
  )
$$;

grant execute on function app.is_responsible(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke all on public.responsibilities, public.responsibility_assignees from anon, authenticated;

grant select, delete on public.responsibilities to authenticated;
grant insert (event_id, kind, category, title, description, due_date, status, notes, sort_order) on public.responsibilities to authenticated;
grant update (kind, category, title, description, due_date, status, notes, sort_order) on public.responsibilities to authenticated;

grant select, delete on public.responsibility_assignees to authenticated;
grant insert (event_id, responsibility_id, participant_id, family_id) on public.responsibility_assignees to authenticated;

alter table public.responsibilities enable row level security;
alter table public.responsibility_assignees enable row level security;

create policy responsibilities_select on public.responsibilities
  for select to authenticated
  using (app.is_member(event_id));

create policy responsibilities_insert on public.responsibilities
  for insert to authenticated
  with check (app.is_content_editor(event_id));

create policy responsibilities_update on public.responsibilities
  for update to authenticated
  using (app.is_content_editor(event_id))
  with check (app.is_content_editor(event_id));

create policy responsibilities_delete on public.responsibilities
  for delete to authenticated
  using (app.is_content_editor(event_id));

create policy responsibility_assignees_select on public.responsibility_assignees
  for select to authenticated
  using (app.is_member(event_id));

create policy responsibility_assignees_insert on public.responsibility_assignees
  for insert to authenticated
  with check (app.is_content_editor(event_id));

create policy responsibility_assignees_delete on public.responsibility_assignees
  for delete to authenticated
  using (app.is_content_editor(event_id));

-- ---------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------

-- Crear/editar con sus responsables en una sola transacción.
-- SECURITY INVOKER: las políticas exigen ser organizador, administrador o editor.
create or replace function public.save_responsibility(
  p_event_id         uuid,
  p_kind             text,
  p_category         text,
  p_title            text,
  p_description      text default null,
  p_due_date         date default null,
  p_status           text default 'pending',
  p_notes            text default null,
  p_participant_ids  uuid[] default '{}',
  p_family_ids       uuid[] default '{}',
  p_id               uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into public.responsibilities (event_id, kind, category, title, description, due_date, status, notes)
    values (p_event_id, p_kind, p_category, btrim(p_title), nullif(btrim(p_description), ''), p_due_date,
            coalesce(p_status, 'pending'), nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    update public.responsibilities
       set kind = p_kind,
           category = p_category,
           title = btrim(p_title),
           description = nullif(btrim(p_description), ''),
           due_date = p_due_date,
           status = coalesce(p_status, 'pending'),
           notes = nullif(btrim(p_notes), '')
     where id = p_id and event_id = p_event_id
    returning id into v_id;

    if v_id is null then
      raise exception 'NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
    end if;

    delete from public.responsibility_assignees where responsibility_id = v_id;
  end if;

  insert into public.responsibility_assignees (event_id, responsibility_id, participant_id)
  select p_event_id, v_id, pid from unnest(coalesce(p_participant_ids, '{}')) as pid group by pid;

  insert into public.responsibility_assignees (event_id, responsibility_id, family_id)
  select p_event_id, v_id, fid from unnest(coalesce(p_family_ids, '{}')) as fid group by fid;

  return v_id;
end;
$$;

-- Cambiar SOLO el estado: responsables (o sus tutores), organizador, administradores y editores.
create or replace function public.set_responsibility_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid;
begin
  select event_id into v_event from public.responsibilities where id = p_id;
  if v_event is null or not app.is_member(v_event) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_status not in ('pending', 'in_progress', 'done') then
    raise exception 'STATUS_INVALID' using errcode = '22023';
  end if;
  if not (app.is_content_editor(v_event) or app.is_responsible(p_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.responsibilities set status = p_status where id = p_id;
end;
$$;

revoke all on function public.save_responsibility(uuid, text, text, text, text, date, text, text, uuid[], uuid[], uuid) from public, anon;
revoke all on function public.set_responsibility_status(uuid, text) from public, anon;
grant execute on function public.save_responsibility(uuid, text, text, text, text, date, text, text, uuid[], uuid[], uuid) to authenticated;
grant execute on function public.set_responsibility_status(uuid, text) to authenticated;
