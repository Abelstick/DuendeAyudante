-- =====================================================================
-- Navidad en Familia — 0010: cronograma y anuncios
-- Todos los del evento los ven; los gestionan organizador, administradores
-- y editores.
-- =====================================================================

create table public.schedule_items (
  id                          uuid primary key default gen_random_uuid(),
  event_id                    uuid not null references public.events (id) on delete cascade,
  title                       text not null check (char_length(btrim(title)) between 1 and 120),
  description                 text check (description is null or char_length(description) <= 1000),
  starts_at                   timestamptz not null,
  ends_at                     timestamptz,
  responsible_participant_id  uuid,
  status                      text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  created_by_user_id          uuid references public.users (id) on delete set null default auth.uid(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  foreign key (event_id, responsible_participant_id) references public.participants (event_id, id) on delete set null (responsible_participant_id),
  check (ends_at is null or ends_at >= starts_at)
);

create index schedule_items_event on public.schedule_items (event_id, starts_at);
create trigger schedule_items_updated_at before update on public.schedule_items
  for each row execute function app.set_updated_at();

create table public.announcements (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events (id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 1 and 120),
  body            text not null check (char_length(btrim(body)) between 1 and 2000),
  priority        text not null default 'normal' check (priority in ('normal', 'important')),
  author_user_id  uuid references public.users (id) on delete set null default auth.uid(),
  author_name     text not null default '',
  published_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index announcements_event on public.announcements (event_id, published_at desc);
create trigger announcements_updated_at before update on public.announcements
  for each row execute function app.set_updated_at();

-- Firma del anuncio: nombre del autor en el evento (o el organizador)
create or replace function app.announcements_set_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_user_id := auth.uid();
  new.author_name := coalesce(
    (select p.full_name from public.participants p where p.event_id = new.event_id and p.user_id = auth.uid() limit 1),
    (select e.organizer_name from public.events e where e.id = new.event_id),
    ''
  );
  return new;
end;
$$;

create trigger announcements_author before insert on public.announcements
  for each row execute function app.announcements_set_author();

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke all on public.schedule_items, public.announcements from anon, authenticated;

grant select, delete on public.schedule_items to authenticated;
grant insert (event_id, title, description, starts_at, ends_at, responsible_participant_id, status) on public.schedule_items to authenticated;
grant update (title, description, starts_at, ends_at, responsible_participant_id, status) on public.schedule_items to authenticated;

grant select, delete on public.announcements to authenticated;
grant insert (event_id, title, body, priority) on public.announcements to authenticated;
grant update (title, body, priority) on public.announcements to authenticated;

alter table public.schedule_items enable row level security;
alter table public.announcements enable row level security;

create policy schedule_select on public.schedule_items for select to authenticated using (app.is_member(event_id));
create policy schedule_insert on public.schedule_items for insert to authenticated with check (app.is_content_editor(event_id));
create policy schedule_update on public.schedule_items for update to authenticated
  using (app.is_content_editor(event_id)) with check (app.is_content_editor(event_id));
create policy schedule_delete on public.schedule_items for delete to authenticated using (app.is_content_editor(event_id));

create policy announcements_select on public.announcements for select to authenticated using (app.is_member(event_id));
create policy announcements_insert on public.announcements for insert to authenticated with check (app.is_content_editor(event_id));
create policy announcements_update on public.announcements for update to authenticated
  using (app.is_content_editor(event_id)) with check (app.is_content_editor(event_id));
create policy announcements_delete on public.announcements for delete to authenticated using (app.is_content_editor(event_id));
