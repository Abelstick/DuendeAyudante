-- =====================================================================
-- Navidad en Familia — 0016: un Google Drive para TODA la celebración
--
-- Además del Drive por familia (0014), el organizador puede conectar una
-- sola cuenta para todas las familias. Al subir una foto se usa:
--   1. el Drive de la familia de la persona, si tiene uno que funciona;
--   2. si no, el Drive general de la celebración.
-- Así, con solo el Drive general, todos (incluso quien no tiene familia)
-- pueden subir fotos; y una familia puede tener su propia cuenta.
-- Igual que family_drives: el token es secreto (sin acceso del navegador).
-- =====================================================================

create table public.event_drives (
  event_id         uuid primary key references public.events (id) on delete cascade,
  google_email     text not null,
  refresh_token    text not null,
  folder_id        text not null,
  needs_reconnect  boolean not null default false,
  connected_by     uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger event_drives_updated_at before update on public.event_drives
  for each row execute function app.set_updated_at();

revoke all on public.event_drives from anon, authenticated;
alter table public.event_drives enable row level security;
-- Sin políticas: solo service_role.

-- Estado del Drive general, sin secretos (el correo solo lo ve quien administra).
create or replace function public.get_event_drive(p_event_id uuid)
returns table (google_email text, needs_reconnect boolean, connected_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select case when app.is_manager(p_event_id) then d.google_email end,
         d.needs_reconnect,
         d.created_at
    from public.event_drives d
   where d.event_id = p_event_id
     and app.is_member(p_event_id)
$$;

revoke all on function public.get_event_drive(uuid) from public, anon;
grant execute on function public.get_event_drive(uuid) to authenticated;

-- En qué Drive quedó cada foto: el de su familia o el general
alter table public.wishlist_photos add column in_event_drive boolean not null default false;

-- La papelera ahora puede apuntar al Drive general (family_id null + event_id)
alter table public.drive_file_trash
  alter column family_id drop not null,
  add column event_id uuid,
  add constraint drive_file_trash_target check (family_id is not null or event_id is not null);

create index drive_file_trash_event on public.drive_file_trash (event_id) where family_id is null;

create or replace function app.wishlist_photos_to_trash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.in_event_drive then
    insert into public.drive_file_trash (event_id, drive_file_id) values (old.event_id, old.drive_file_id);
  elsif old.family_id is not null then
    insert into public.drive_file_trash (family_id, drive_file_id) values (old.family_id, old.drive_file_id);
  end if;
  return old;
end;
$$;

grant execute on all functions in schema app to service_role;
