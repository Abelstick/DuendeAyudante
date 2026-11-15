-- =====================================================================
-- Navidad en Familia — 0006: checklist de preparación
--  * checklist_items: tareas que crea el organizador/administrador/editor,
--    para todos, para una familia o para una persona.
--  * checklist_progress: qué participante marcó qué tarea.
-- Las tareas automáticas (ej. "Agrega tus regalos") se calculan en la app
-- a partir de los datos reales y no se guardan aquí.
-- =====================================================================

create table public.checklist_items (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events (id) on delete cascade,
  title               text not null check (char_length(btrim(title)) between 1 and 120),
  description         text check (description is null or char_length(description) <= 500),
  scope               text not null default 'all' check (scope in ('all', 'family', 'participant')),
  family_id           uuid,
  participant_id      uuid,
  sort_order          int not null default 0,
  created_by_user_id  uuid references public.users (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  foreign key (event_id, family_id) references public.families (event_id, id) on delete cascade,
  foreign key (event_id, participant_id) references public.participants (event_id, id) on delete cascade,
  check (
    (scope = 'all' and family_id is null and participant_id is null)
    or (scope = 'family' and family_id is not null and participant_id is null)
    or (scope = 'participant' and participant_id is not null and family_id is null)
  )
);

create index checklist_items_event on public.checklist_items (event_id, sort_order);
create trigger checklist_items_updated_at before update on public.checklist_items
  for each row execute function app.set_updated_at();

create table public.checklist_progress (
  item_id         uuid not null references public.checklist_items (id) on delete cascade,
  participant_id  uuid not null references public.participants (id) on delete cascade,
  completed_at    timestamptz not null default now(),
  primary key (item_id, participant_id)
);

create index checklist_progress_participant on public.checklist_progress (participant_id);

-- ¿La tarea le corresponde a este participante? (mismo evento + alcance)
create or replace function app.checklist_applies(p_item_id uuid, p_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.checklist_items i
    join public.participants p on p.id = p_participant_id and p.event_id = i.event_id
    where i.id = p_item_id
      and (
        i.scope = 'all'
        or (i.scope = 'family' and i.family_id = p.family_id)
        or (i.scope = 'participant' and i.participant_id = p.id)
      )
  )
$$;

grant execute on function app.checklist_applies(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke all on public.checklist_items, public.checklist_progress from anon, authenticated;

grant select, delete on public.checklist_items to authenticated;
grant insert (event_id, title, description, scope, family_id, participant_id, sort_order) on public.checklist_items to authenticated;
grant update (title, description, scope, family_id, participant_id, sort_order) on public.checklist_items to authenticated;

grant select, delete on public.checklist_progress to authenticated;
grant insert (item_id, participant_id) on public.checklist_progress to authenticated;

alter table public.checklist_items enable row level security;
alter table public.checklist_progress enable row level security;

-- Todos los del evento ven las tareas; las gestionan organizador, administradores y editores
create policy checklist_items_select on public.checklist_items
  for select to authenticated
  using (app.is_member(event_id));

create policy checklist_items_insert on public.checklist_items
  for insert to authenticated
  with check (app.is_content_editor(event_id));

create policy checklist_items_update on public.checklist_items
  for update to authenticated
  using (app.is_content_editor(event_id))
  with check (app.is_content_editor(event_id));

create policy checklist_items_delete on public.checklist_items
  for delete to authenticated
  using (app.is_content_editor(event_id));

-- Progreso: lo ven los del evento (para el resumen del organizador);
-- cada quien marca lo suyo y lo de las personas a su cargo, solo si la tarea le corresponde.
create policy checklist_progress_select on public.checklist_progress
  for select to authenticated
  using (exists (
    select 1 from public.checklist_items i where i.id = item_id and app.is_member(i.event_id)
  ));

create policy checklist_progress_insert on public.checklist_progress
  for insert to authenticated
  with check (
    participant_id in (select app.acting_participant_ids())
    and app.checklist_applies(item_id, participant_id)
  );

create policy checklist_progress_delete on public.checklist_progress
  for delete to authenticated
  using (participant_id in (select app.acting_participant_ids()));
