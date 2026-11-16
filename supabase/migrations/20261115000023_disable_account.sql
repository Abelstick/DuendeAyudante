-- =====================================================================
-- Navidad en Familia — 0023: inhabilitar mi cuenta (en vez de borrarla)
--
-- Reemplaza en la app a «Borrar mi cuenta» (0015): ahora es un borrado
-- lógico que se puede deshacer.
--  · La persona inhabilita su cuenta desde su perfil (escribe INHABILITAR).
--    Deja de poder entrar y de ver cualquier dato, pero no se borra nada:
--    su usuario, su perfil, sus regalos y sus tareas siguen ahí.
--  · Quien organiza o administra una celebración donde está esa persona
--    puede reactivarla desde Organizar.
--  · Para que siempre quede alguien que pueda reactivar: quien organiza o
--    administra solo puede inhabilitarse si en cada una de sus
--    celebraciones queda otra persona activa que administre.
--  · delete_my_account (0015) sigue existiendo, pero la app ya no la usa.
-- =====================================================================

alter table public.users add column disabled_at timestamptz;

-- Una cuenta inhabilitada no tiene rol en ningún evento: como casi todas las
-- políticas pasan por aquí (is_member, is_manager, is_content_editor), deja de
-- ver y de cambiar datos aunque conserve una sesión abierta en otro dispositivo.
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
  join public.users u on u.id = m.user_id and u.disabled_at is null
  where m.event_id = p_event_id and m.user_id = auth.uid()
$$;

-- Lo mismo para "mi perfil y las personas a mi cargo".
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
    join public.users u on u.id = p.user_id and u.disabled_at is null
    where p.user_id = auth.uid() and p.status = 'active'
  )
  select id from me
  union
  select g.ward_participant_id
  from public.guardianships g
  join me on me.id = g.guardian_participant_id
  join public.participants w on w.id = g.ward_participant_id and w.status = 'active'
$$;

-- ¿Mi cuenta está inhabilitada? (la app lo revisa al entrar y cierra la sesión)
create or replace function public.my_account_disabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.disabled_at is not null from public.users u where u.id = auth.uid()), false)
$$;

-- Inhabilita la cuenta de quien llama.
create or replace function public.disable_my_account(p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if upper(btrim(coalesce(p_confirm, ''))) <> 'INHABILITAR' then
    raise exception 'DISABLE_CONFIRMATION_REQUIRED' using errcode = '23514';
  end if;

  -- En cada celebración que administro debe quedar otra persona activa que administre
  if exists (
    select 1
      from public.event_members me
      join public.events e on e.id = me.event_id and e.deleted_at is null
     where me.user_id = v_uid
       and me.role in ('owner', 'admin')
       and not exists (
         select 1
           from public.event_members o
           join public.users u on u.id = o.user_id and u.disabled_at is null
          where o.event_id = me.event_id and o.user_id <> v_uid and o.role in ('owner', 'admin')
       )
  ) then
    raise exception 'LAST_MANAGER' using errcode = '23514';
  end if;

  update public.users set disabled_at = now() where id = v_uid;

  insert into public.audit_log (event_id, actor_user_id, action, entity, entity_id, metadata)
  select m.event_id, v_uid, 'account.disabled', 'user', v_uid, '{}'::jsonb
    from public.event_members m
   where m.user_id = v_uid;
end;
$$;

-- Integrantes de la celebración con la cuenta inhabilitada (solo quien administra).
create or replace function public.list_disabled_members(p_event_id uuid)
returns setof uuid
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
  select p.id
    from public.participants p
    join public.users u on u.id = p.user_id
   where p.event_id = p_event_id and u.disabled_at is not null;
end;
$$;

-- Reactiva la cuenta de un integrante de la celebración (solo quien administra).
create or replace function public.reactivate_member_account(p_event_id uuid, p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not app.is_manager(p_event_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select p.user_id into v_user
    from public.participants p
   where p.id = p_participant_id and p.event_id = p_event_id;
  if v_user is null then
    raise exception 'NOT_FOUND' using errcode = '23514';
  end if;

  update public.users set disabled_at = null where id = v_user;

  insert into public.audit_log (event_id, actor_user_id, action, entity, entity_id, metadata)
  values (p_event_id, auth.uid(), 'account.reactivated', 'user', v_user, '{}'::jsonb);
end;
$$;

revoke all on function public.my_account_disabled() from public, anon;
revoke all on function public.disable_my_account(text) from public, anon;
revoke all on function public.list_disabled_members(uuid) from public, anon;
revoke all on function public.reactivate_member_account(uuid, uuid) from public, anon;
grant execute on function public.my_account_disabled() to authenticated;
grant execute on function public.disable_my_account(text) to authenticated;
grant execute on function public.list_disabled_members(uuid) to authenticated;
grant execute on function public.reactivate_member_account(uuid, uuid) to authenticated;
