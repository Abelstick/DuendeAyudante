-- =====================================================================
-- Navidad en Familia — 0001: esquema base (cuentas, eventos, familias,
-- participantes, tutores, intercambio y listas de deseos)
-- =====================================================================

create schema if not exists app;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------

-- Normaliza nombres: NFC, espacios múltiples → uno, sin espacios en los
-- extremos, MAYÚSCULAS (conserva tildes y Ñ). Devuelve NULL si queda vacío.
-- upper() depende del locale del servidor (con "C" no convierte "é"), por eso
-- las letras acentuadas se convierten explícitamente con translate().
create or replace function app.normalize_name(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    translate(
      upper(btrim(regexp_replace(normalize(coalesce(raw, ''), NFC), '[\s ]+', ' ', 'g'))),
      'áéíóúüñàèìòùâêîôûäëïöçãõ',
      'ÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖÇÃÕ'
    ),
    ''
  )
$$;

-- Solo letras (cualquier alfabeto, con tildes), espacios, apóstrofo, punto y guion.
-- Se valida en el frontend con la misma regla; aquí es la red de seguridad.
create or replace function app.is_valid_person_name(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is not null
     and char_length(value) between 1 and 60
     and value !~ '[0-9_@#$%&*+=<>{}\[\]\\/|~^"!?¿¡;:,]'
$$;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.event_role as enum ('owner', 'admin', 'editor', 'participant');

-- ---------------------------------------------------------------------
-- users: perfil de cada cuenta de Supabase Auth
-- ---------------------------------------------------------------------
create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique
                check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  display_name  text not null default '',
  real_email    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger users_updated_at before update on public.users
  for each row execute function app.set_updated_at();

-- Crea el perfil al crear la cuenta en Auth.
-- * Cuentas creadas por un administrador (Edge Function create-member):
--   app_metadata.created_by = 'admin' y app_metadata.username (solo el
--   servidor puede escribir app_metadata).
-- * Organizadores que se registran con correo: username técnico "org-xxxxxxxx".
create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin_created boolean := coalesce(new.raw_app_meta_data ->> 'created_by', '') = 'admin';
begin
  insert into public.users (id, username, display_name, real_email)
  values (
    new.id,
    case when v_is_admin_created
         then new.raw_app_meta_data ->> 'username'
         else 'org-' || substr(md5(new.id::text), 1, 20) end,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    case when v_is_admin_created then null else new.email end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references public.users (id),
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  organizer_name  text not null check (char_length(btrim(organizer_name)) between 1 and 120),
  description     text check (description is null or char_length(description) <= 1000),
  celebration_at  timestamptz not null,
  timezone        text not null default 'America/Lima',
  currency        char(3) not null default 'PEN',
  status          text not null default 'active'
                  check (status in ('draft', 'active', 'finished', 'archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create trigger events_updated_at before update on public.events
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------
-- event_members: rol de cada cuenta en cada evento
-- ---------------------------------------------------------------------
create table public.event_members (
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  role        public.event_role not null,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

create unique index event_members_one_owner on public.event_members (event_id) where role = 'owner';
create index event_members_user on public.event_members (user_id);

-- ---------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------
create table public.families (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete cascade,
  name             text not null,
  color_key        text not null default 'green'
                   check (color_key in ('red', 'green', 'gold', 'blue', 'purple', 'orange', 'pink', 'teal')),
  dress_code_note  text check (dress_code_note is null or char_length(dress_code_note) <= 120),
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (event_id, id),
  unique (event_id, name)
);

create index families_event on public.families (event_id);

create or replace function app.families_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := app.normalize_name(new.name);
  if new.name is null or char_length(new.name) > 60 then
    raise exception 'FAMILY_NAME_INVALID' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger families_normalize before insert or update on public.families
  for each row execute function app.families_before_write();
create trigger families_updated_at before update on public.families
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------
-- participants: perfil de una persona dentro de un evento
-- ---------------------------------------------------------------------
create table public.participants (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.events (id) on delete cascade,
  family_id            uuid,
  user_id              uuid references public.users (id) on delete set null,
  first_name           text not null,
  paternal_surname     text not null,
  maternal_surname     text,
  full_name            text generated always as (
                         first_name || ' ' || paternal_surname || coalesce(' ' || maternal_surname, '')
                       ) stored,
  name_key             text not null,
  distinguishing_note  text,
  status               text not null default 'active' check (status in ('active', 'removed')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (event_id, id),
  foreign key (event_id, family_id) references public.families (event_id, id) on delete set null (family_id)
);

create unique index participants_unique_user on public.participants (event_id, user_id) where user_id is not null;
create unique index participants_unique_name on public.participants (event_id, name_key, coalesce(distinguishing_note, ''))
  where status = 'active';
create index participants_event on public.participants (event_id, status);
create index participants_user on public.participants (user_id);
create index participants_family on public.participants (family_id);

create or replace function app.participants_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.first_name          := app.normalize_name(new.first_name);
  new.paternal_surname    := app.normalize_name(new.paternal_surname);
  new.maternal_surname    := app.normalize_name(new.maternal_surname);
  new.distinguishing_note := app.normalize_name(new.distinguishing_note);

  if not app.is_valid_person_name(new.first_name) then
    raise exception 'FIRST_NAME_INVALID' using errcode = '23514';
  end if;
  if not app.is_valid_person_name(new.paternal_surname) then
    raise exception 'PATERNAL_SURNAME_INVALID' using errcode = '23514';
  end if;
  if new.maternal_surname is not null and not app.is_valid_person_name(new.maternal_surname) then
    raise exception 'MATERNAL_SURNAME_INVALID' using errcode = '23514';
  end if;
  if new.distinguishing_note is not null and char_length(new.distinguishing_note) > 40 then
    raise exception 'DISTINGUISHING_NOTE_INVALID' using errcode = '23514';
  end if;

  new.name_key := new.first_name || '|' || new.paternal_surname || '|' || coalesce(new.maternal_surname, '');
  return new;
end;
$$;

create trigger participants_normalize before insert or update on public.participants
  for each row execute function app.participants_before_write();
create trigger participants_updated_at before update on public.participants
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------
-- guardianships: un participante (tutor) administra a otro (persona a cargo)
-- ---------------------------------------------------------------------
create table public.guardianships (
  event_id                 uuid not null,
  guardian_participant_id  uuid not null,
  ward_participant_id      uuid not null,
  created_at               timestamptz not null default now(),
  primary key (guardian_participant_id, ward_participant_id),
  foreign key (event_id, guardian_participant_id) references public.participants (event_id, id) on delete cascade,
  foreign key (event_id, ward_participant_id) references public.participants (event_id, id) on delete cascade,
  check (guardian_participant_id <> ward_participant_id)
);

create index guardianships_ward on public.guardianships (ward_participant_id);
create index guardianships_event on public.guardianships (event_id);

-- ---------------------------------------------------------------------
-- gift_exchanges: configuración del intercambio (presupuesto S/ 65)
-- ---------------------------------------------------------------------
create table public.gift_exchanges (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events (id) on delete cascade,
  name                text not null default 'Intercambio de regalos'
                      check (char_length(btrim(name)) between 1 and 120),
  budget_max          numeric(10, 2) not null default 65.00 check (budget_max > 0),
  delivery_at         timestamptz,
  status              text not null default 'draft'
                      check (status in ('draft', 'assignments_ready', 'revealed', 'closed')),
  assignments_sealed  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index gift_exchanges_event on public.gift_exchanges (event_id);
create trigger gift_exchanges_updated_at before update on public.gift_exchanges
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------
-- wishlist_items + wishlist_item_links (sin fotos en la v1)
-- ---------------------------------------------------------------------
create table public.wishlist_items (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null,
  participant_id      uuid not null,
  title               text not null check (char_length(btrim(title)) between 1 and 120),
  description         text check (description is null or char_length(description) <= 1000),
  price_estimate      numeric(10, 2) check (price_estimate is null or price_estimate >= 0),
  priority            smallint not null default 2 check (priority between 1 and 3),
  sort_order          int not null default 0,
  created_by_user_id  uuid references public.users (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  foreign key (event_id, participant_id) references public.participants (event_id, id) on delete cascade
);

create index wishlist_items_event on public.wishlist_items (event_id);
create index wishlist_items_participant on public.wishlist_items (participant_id);
create trigger wishlist_items_updated_at before update on public.wishlist_items
  for each row execute function app.set_updated_at();

create table public.wishlist_item_links (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.wishlist_items (id) on delete cascade,
  url         text not null check (url ~* '^https?://[^\s]+$' and char_length(url) <= 2000),
  label       text check (label is null or char_length(label) <= 60),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index wishlist_item_links_item on public.wishlist_item_links (item_id);

create or replace function app.wishlist_links_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.wishlist_item_links where item_id = new.item_id) >= 5 then
    raise exception 'TOO_MANY_LINKS' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger wishlist_links_limit before insert on public.wishlist_item_links
  for each row execute function app.wishlist_links_limit();

-- ---------------------------------------------------------------------
-- audit_log: acciones sensibles
-- ---------------------------------------------------------------------
create table public.audit_log (
  id             bigint generated always as identity primary key,
  event_id       uuid references public.events (id) on delete cascade,
  actor_user_id  uuid,
  action         text not null,
  entity         text,
  entity_id      uuid,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index audit_log_event on public.audit_log (event_id, created_at desc);
