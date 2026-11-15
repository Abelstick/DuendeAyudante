-- =====================================================================
-- Navidad en Familia — 0011: acceso por enlace de familia
-- El organizador comparte UN enlace por familia (fijo: no se regenera) y
-- una palabra secreta. Con ambos, un familiar elige su nombre y entra, sin
-- recordar usuario ni contraseña.
--
-- Decisiones (confirmadas por el organizador):
--  · La palabra es por familia y la puede ver quien administra, para poder
--    volver a compartirla días después. Por eso se guarda legible, pero SOLO
--    organizador/administradores pueden leerla (RLS + grants por columna).
--  · Dentro de una familia cualquiera puede entrar como otro integrante:
--    se acepta, porque solo afecta regalos, tareas propias e ideas de juegos.
--  · Organizador, administradores y editores NO entran por el enlace: la
--    Edge Function family-access solo ofrece cuentas con rol "participant".
--  · La validación de enlace + palabra la hace la Edge Function (con la
--    clave de servicio). Los visitantes sin sesión no leen esta tabla.
-- =====================================================================

-- "  Panetón 25 " → "PANETON25": sin tildes, sin espacios, en mayúsculas.
-- Debe coincidir con normalizeSecretWord() del frontend y de la Edge Function.
create or replace function app.normalize_secret_word(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(upper(coalesce(raw, '')), 'ÁÉÍÓÚÜÀÈÌÒÙ', 'AEIOUUAEIOU'),
    '\s+', '', 'g'
  )
$$;

create table public.family_access (
  family_id        uuid primary key references public.families (id) on delete cascade,
  event_id         uuid not null references public.events (id) on delete cascade,
  -- Identificador del enlace (/f/<link_token>). Se crea una vez y no cambia.
  link_token       text not null unique check (link_token ~ '^[a-f0-9]{32}$'),
  secret_word      text not null check (secret_word ~ '^[A-Z0-9Ñ]{4,20}$'),
  -- Freno a quien prueba palabras al azar (lo administra la Edge Function).
  failed_attempts  int not null default 0,
  locked_until     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index family_access_event on public.family_access (event_id);

create trigger family_access_updated_at before update on public.family_access
  for each row execute function app.set_updated_at();

revoke all on public.family_access from anon, authenticated;
grant select (family_id, event_id, link_token, secret_word, created_at, updated_at) on public.family_access to authenticated;

alter table public.family_access enable row level security;

-- Solo organizador y administradores ven el enlace y la palabra.
create policy family_access_select on public.family_access
  for select to authenticated
  using (app.is_manager(event_id));

-- Crea el enlace de una familia (la primera vez) o cambia su palabra secreta.
-- El enlace nunca cambia: quienes ya lo tienen pueden seguir usándolo.
create or replace function public.set_family_access_word(p_family_id uuid, p_word text)
returns table (link_token text, secret_word text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_word     text := app.normalize_secret_word(p_word);
begin
  select f.event_id into v_event_id from public.families f where f.id = p_family_id;
  if v_event_id is null or not app.is_manager(v_event_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_word !~ '^[A-Z0-9Ñ]{4,20}$' then
    raise exception 'SECRET_WORD_INVALID' using errcode = '23514';
  end if;

  return query
    insert into public.family_access as fa (family_id, event_id, link_token, secret_word)
    values (p_family_id, v_event_id, replace(gen_random_uuid()::text, '-', ''), v_word)
    on conflict (family_id) do update
      set secret_word = excluded.secret_word, failed_attempts = 0, locked_until = null
    returning fa.link_token, fa.secret_word;
end;
$$;

revoke all on function public.set_family_access_word(uuid, text) from public, anon;
grant execute on function public.set_family_access_word(uuid, text) to authenticated;
