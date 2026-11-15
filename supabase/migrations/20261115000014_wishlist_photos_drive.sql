-- =====================================================================
-- Navidad en Familia — 0014: fotos de los regalos en Google Drive
--
-- Decisiones (confirmadas por el organizador):
--  · Un Google Drive POR FAMILIA. Lo conecta el organizador o un
--    administrador desde Organizar. Las fotos de cada persona se guardan
--    en el Drive de su familia (en una carpeta que crea la app).
--  · La app pide solo el permiso drive.file: puede ver y borrar los
--    archivos que ELLA creó, nunca el resto del Drive.
--  · El refresh token de Google es un secreto: ningún rol del navegador
--    puede leer family_drives (ni el organizador). Solo la Edge Function
--    google-drive (service role) lo usa.
--  · Las fotos se comparten como "cualquiera con el enlace puede ver",
--    para que la app las muestre sin pasar por el servidor. Los ids de
--    Drive no se pueden adivinar y solo los ven los miembros del evento.
--  · Subir y borrar fotos pasa por la Edge Function (también toca Drive).
--    Al borrar una foto (o su regalo) el archivo queda en drive_file_trash
--    y la función lo borra de Drive en la siguiente llamada de esa familia.
--    Si se desconecta el Drive o se borra la familia, los archivos quedan
--    en ese Drive (son de su dueño) y las fotos ya subidas se siguen viendo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Conexión de Google Drive de cada familia (secreta)
-- ---------------------------------------------------------------------
create table public.family_drives (
  family_id        uuid primary key references public.families (id) on delete cascade,
  event_id         uuid not null references public.events (id) on delete cascade,
  google_email     text not null,
  refresh_token    text not null,
  folder_id        text not null,
  -- Google rechazó el token (la persona quitó el acceso): hay que volver a conectar
  needs_reconnect  boolean not null default false,
  connected_by     uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index family_drives_event on public.family_drives (event_id);

create trigger family_drives_updated_at before update on public.family_drives
  for each row execute function app.set_updated_at();

revoke all on public.family_drives from anon, authenticated;
alter table public.family_drives enable row level security;
-- Sin políticas: solo service_role (que salta RLS) la lee y escribe.

-- Estado de los Drive del evento, sin secretos. Cualquier miembro sabe si
-- su familia puede subir fotos; el correo de la cuenta solo lo ve quien administra.
create or replace function public.list_family_drives(p_event_id uuid)
returns table (family_id uuid, google_email text, needs_reconnect boolean, connected_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.family_id,
         case when app.is_manager(p_event_id) then d.google_email end,
         d.needs_reconnect,
         d.created_at
    from public.family_drives d
   where d.event_id = p_event_id
     and app.is_member(p_event_id)
$$;

revoke all on function public.list_family_drives(uuid) from public, anon;
grant execute on function public.list_family_drives(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Fotos de cada regalo
-- ---------------------------------------------------------------------
create table public.wishlist_photos (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.wishlist_items (id) on delete cascade,
  event_id       uuid not null references public.events (id) on delete cascade,
  -- En qué Drive está el archivo (la persona puede cambiar de familia después)
  family_id      uuid references public.families (id) on delete set null,
  drive_file_id  text not null check (drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  sort_order     int not null default 0,
  created_by     uuid,
  created_at     timestamptz not null default now()
);

create index wishlist_photos_item on public.wishlist_photos (item_id, sort_order);
create index wishlist_photos_event on public.wishlist_photos (event_id);

create or replace function app.wishlist_photos_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.wishlist_photos where item_id = new.item_id) >= 6 then
    raise exception 'TOO_MANY_PHOTOS' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger wishlist_photos_limit before insert on public.wishlist_photos
  for each row execute function app.wishlist_photos_limit();

revoke all on public.wishlist_photos from anon, authenticated;
grant select on public.wishlist_photos to authenticated;
alter table public.wishlist_photos enable row level security;

-- Todos los miembros ven las fotos (igual que los regalos). Escribir: solo la Edge Function.
create policy wishlist_photos_select on public.wishlist_photos
  for select to authenticated
  using (app.is_member(event_id));

-- ---------------------------------------------------------------------
-- Archivos de Drive por borrar
-- ---------------------------------------------------------------------
create table public.drive_file_trash (
  id             bigint generated always as identity primary key,
  family_id      uuid not null,
  drive_file_id  text not null,
  created_at     timestamptz not null default now()
);

create index drive_file_trash_family on public.drive_file_trash (family_id);

revoke all on public.drive_file_trash from anon, authenticated;
alter table public.drive_file_trash enable row level security;

create or replace function app.wishlist_photos_to_trash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.family_id is not null then
    insert into public.drive_file_trash (family_id, drive_file_id) values (old.family_id, old.drive_file_id);
  end if;
  return old;
end;
$$;

create trigger wishlist_photos_to_trash after delete on public.wishlist_photos
  for each row execute function app.wishlist_photos_to_trash();

-- ¿Quien llama puede cambiar este regalo? (la persona, su tutor o quien administra).
-- SECURITY INVOKER: la Edge Function la llama con la sesión del usuario.
create or replace function public.can_edit_wishlist_item(p_item_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select app.can_act_for(i.participant_id, i.event_id)
      from public.wishlist_items i
     where i.id = p_item_id
  ), false)
$$;

revoke all on function public.can_edit_wishlist_item(uuid) from public, anon;
grant execute on function public.can_edit_wishlist_item(uuid) to authenticated;

grant usage on schema app to service_role;
grant execute on all functions in schema app to service_role;
