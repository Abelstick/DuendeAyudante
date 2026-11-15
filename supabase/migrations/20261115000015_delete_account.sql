-- =====================================================================
-- Navidad en Familia — 0015: cada persona puede borrar su cuenta
--
-- Decisiones (confirmadas por el organizador):
--  · Se borra la CUENTA (usuario, contraseña, sesión), no el perfil: la
--    persona sigue en la celebración como alguien sin usuario, con sus
--    regalos, fotos y tareas (participants.user_id queda en null). El
--    organizador puede quitarla después si quiere.
--  · El organizador (owner) primero pasa cada celebración a uno de sus
--    administradores. Si una celebración no tiene administradores, puede
--    elegir borrarla (con todo lo que tiene).
--  · Se confirma escribiendo BORRAR (lo valida la base, no solo la app).
--    La app además pide la contraseña al organizador antes de llamar.
--  · Todo pasa en una sola transacción: o se pasa todo y se borra la
--    cuenta, o no cambia nada.
-- =====================================================================

-- Celebraciones que organizo y a quién se las puedo pasar (sus administradores).
create or replace function public.my_owned_events()
returns table (event_id uuid, event_name text, successors jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id,
         e.name,
         coalesce((
           select jsonb_agg(jsonb_build_object('userId', m.user_id, 'name', coalesce(p.full_name, u.display_name, u.username)) order by p.full_name)
             from public.event_members m
             join public.users u on u.id = m.user_id
             left join public.participants p on p.event_id = e.id and p.user_id = m.user_id
            where m.event_id = e.id and m.role = 'admin'
         ), '[]'::jsonb)
    from public.events e
    join public.event_members me on me.event_id = e.id and me.user_id = auth.uid() and me.role = 'owner'
   where e.deleted_at is null
   order by e.celebration_at
$$;

revoke all on function public.my_owned_events() from public, anon;
grant execute on function public.my_owned_events() to authenticated;

-- Borra la cuenta de quien llama.
-- p_successors: { "<event_id>": "<user_id del administrador>" | "DELETE" } para cada celebración que organiza.
create or replace function public.delete_my_account(p_confirm text, p_successors jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_event  record;
  v_choice text;
  v_new    uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if upper(btrim(coalesce(p_confirm, ''))) <> 'BORRAR' then
    raise exception 'DELETE_CONFIRMATION_REQUIRED' using errcode = '23514';
  end if;
  if p_successors is null or jsonb_typeof(p_successors) <> 'object' then
    raise exception 'INVALID_DATA' using errcode = '23514';
  end if;

  for v_event in
    select e.id
      from public.events e
      join public.event_members m on m.event_id = e.id and m.user_id = v_uid and m.role = 'owner'
     where e.deleted_at is null
     for update of e
  loop
    v_choice := p_successors ->> v_event.id::text;
    if v_choice is null then
      raise exception 'OWNER_NEEDS_SUCCESSOR' using errcode = '23514';
    end if;

    if v_choice = 'DELETE' then
      delete from public.events where id = v_event.id; -- todo lo del evento se borra en cascada
      continue;
    end if;

    begin
      v_new := v_choice::uuid;
    exception when invalid_text_representation then
      raise exception 'SUCCESSOR_INVALID' using errcode = '23514';
    end;
    if not exists (
      select 1 from public.event_members where event_id = v_event.id and user_id = v_new and role = 'admin'
    ) then
      raise exception 'SUCCESSOR_INVALID' using errcode = '23514';
    end if;

    -- Primero deja de ser organizador (solo puede haber uno), luego asciende al elegido
    update public.event_members set role = 'admin' where event_id = v_event.id and user_id = v_uid;
    update public.event_members set role = 'owner' where event_id = v_event.id and user_id = v_new;
    update public.events set owner_user_id = v_new where id = v_event.id;

    insert into public.audit_log (event_id, actor_user_id, action, entity, entity_id, metadata)
    values (v_event.id, v_uid, 'event.ownership_transferred', 'user', v_new, '{}'::jsonb);
  end loop;

  -- Celebraciones ya borradas (borrado lógico) que todavía apuntan a esta cuenta
  delete from public.events where owner_user_id = v_uid and deleted_at is not null;

  -- Borra la cuenta. En cascada: public.users, event_members y sesiones.
  -- Los perfiles quedan sin usuario (participants.user_id → null).
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account(text, jsonb) from public, anon;
grant execute on function public.delete_my_account(text, jsonb) to authenticated;
