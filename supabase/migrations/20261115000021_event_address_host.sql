-- =====================================================================
-- Navidad en Familia — 0021: de quién es la casa de la celebración
-- Nombre corto del anfitrión ("la abuela Rosa"); la app lo muestra como
-- «Casa de la abuela Rosa» junto a la dirección.
-- Al crear la Navidad del próximo año también se copia (se vuelve a
-- definir duplicate_event con ese único cambio).
-- =====================================================================

alter table public.events
  add column address_host text check (address_host is null or char_length(address_host) <= 80);

grant update (address_host) on public.events to authenticated;

create or replace function public.duplicate_event(
  p_source_event_id         uuid,
  p_name                    text,
  p_join_code               text,
  p_celebration_at          timestamptz,
  p_copy_members            boolean default true,
  p_copy_checklist          boolean default true,
  p_copy_responsibilities   boolean default false,
  p_copy_schedule           boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_src        public.events%rowtype;
  v_me         public.participants%rowtype;
  v_budget     numeric;
  v_new        uuid;
  v_new_me     uuid;
  v_shift      interval;
  v_day_shift  int;
  r            record;
  v_new_id     uuid;
begin
  select * into v_src from public.events where id = p_source_event_id and deleted_at is null;
  if v_src.id is null or app.my_role(p_source_event_id) is distinct from 'owner' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_me from public.participants
   where event_id = p_source_event_id and user_id = v_uid
   order by status = 'active' desc
   limit 1;
  select budget_max into v_budget from public.gift_exchanges where event_id = p_source_event_id order by created_at limit 1;

  -- Mismas validaciones que al crear (código libre, zona horaria, límite de 10)
  v_new := public.create_event(
    p_name,
    p_join_code,
    p_celebration_at,
    coalesce(v_me.first_name, 'ORGANIZADOR'),
    coalesce(v_me.paternal_surname, 'ORGANIZADOR'),
    v_me.maternal_surname,
    v_src.timezone,
    coalesce(v_budget, 65.00),
    v_src.description
  );

  update public.events set address = v_src.address, address_host = v_src.address_host, currency = v_src.currency where id = v_new;
  select id into v_new_me from public.participants where event_id = v_new and user_id = v_uid;

  v_shift := p_celebration_at - v_src.celebration_at;
  v_day_shift := (p_celebration_at at time zone v_src.timezone)::date - (v_src.celebration_at at time zone v_src.timezone)::date;

  -- Correspondencia entre registros viejos y nuevos
  create temp table if not exists pg_temp.dup_family_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  create temp table if not exists pg_temp.dup_participant_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  truncate pg_temp.dup_family_map, pg_temp.dup_participant_map;

  if v_me.id is not null and v_new_me is not null then
    insert into pg_temp.dup_participant_map values (v_me.id, v_new_me);
  end if;

  if p_copy_members then
    for r in select * from public.families where event_id = p_source_event_id order by sort_order, created_at loop
      insert into public.families (event_id, name, color_key, dress_code_note, sort_order)
      values (v_new, r.name, r.color_key, r.dress_code_note, r.sort_order)
      returning id into v_new_id;
      insert into pg_temp.dup_family_map values (r.id, v_new_id);
    end loop;

    -- La familia del organizador
    update public.participants
       set family_id = (select fm.new_id from pg_temp.dup_family_map fm where fm.old_id = v_me.family_id)
     where id = v_new_me;

    for r in
      select p.*
        from public.participants p
       where p.event_id = p_source_event_id
         and p.status = 'active'
         and p.id is distinct from v_me.id
         and (p.user_id is null or p.user_id <> v_uid)
       order by p.created_at
    loop
      insert into public.participants (event_id, family_id, user_id, first_name, paternal_surname, maternal_surname, distinguishing_note)
      values (
        v_new,
        (select fm.new_id from pg_temp.dup_family_map fm where fm.old_id = r.family_id),
        r.user_id,
        r.first_name,
        r.paternal_surname,
        r.maternal_surname,
        r.distinguishing_note
      )
      returning id into v_new_id;
      insert into pg_temp.dup_participant_map values (r.id, v_new_id);

      -- Mismo usuario y mismo rol (nunca un segundo organizador)
      if r.user_id is not null then
        insert into public.event_members (event_id, user_id, role)
        select v_new, m.user_id, case when m.role = 'owner' then 'admin'::public.event_role else m.role end
          from public.event_members m
         where m.event_id = p_source_event_id and m.user_id = r.user_id
        on conflict do nothing;
      end if;
    end loop;

    insert into public.guardianships (event_id, guardian_participant_id, ward_participant_id)
    select v_new, gm.new_id, wm.new_id
      from public.guardianships g
      join pg_temp.dup_participant_map gm on gm.old_id = g.guardian_participant_id
      join pg_temp.dup_participant_map wm on wm.old_id = g.ward_participant_id
     where g.event_id = p_source_event_id;
  end if;

  if p_copy_checklist then
    insert into public.checklist_items (event_id, title, description, scope, family_id, participant_id, sort_order)
    select v_new, i.title, i.description, i.scope, fm.new_id, pm.new_id, i.sort_order
      from public.checklist_items i
      left join pg_temp.dup_family_map fm on fm.old_id = i.family_id
      left join pg_temp.dup_participant_map pm on pm.old_id = i.participant_id
     where i.event_id = p_source_event_id
       and (i.scope = 'all'
            or (i.scope = 'family' and fm.new_id is not null)
            or (i.scope = 'participant' and pm.new_id is not null));
  end if;

  if p_copy_responsibilities then
    for r in select * from public.responsibilities where event_id = p_source_event_id order by sort_order, created_at loop
      insert into public.responsibilities (event_id, kind, category, title, description, due_date, status, notes, sort_order)
      values (v_new, r.kind, r.category, r.title, r.description, r.due_date + v_day_shift, 'pending', r.notes, r.sort_order)
      returning id into v_new_id;

      insert into public.responsibility_assignees (event_id, responsibility_id, participant_id, family_id)
      select v_new, v_new_id, pm.new_id, fm.new_id
        from public.responsibility_assignees a
        left join pg_temp.dup_participant_map pm on pm.old_id = a.participant_id
        left join pg_temp.dup_family_map fm on fm.old_id = a.family_id
       where a.responsibility_id = r.id
         and (pm.new_id is not null or fm.new_id is not null);
    end loop;
  end if;

  if p_copy_schedule then
    insert into public.schedule_items (event_id, title, description, starts_at, ends_at, responsible_participant_id, status)
    select v_new, s.title, s.description, s.starts_at + v_shift, s.ends_at + v_shift, pm.new_id, 'pending'
      from public.schedule_items s
      left join pg_temp.dup_participant_map pm on pm.old_id = s.responsible_participant_id
     where s.event_id = p_source_event_id
       and s.status <> 'cancelled';
  end if;

  insert into public.audit_log (event_id, actor_user_id, action, entity, entity_id, metadata)
  values (v_new, v_uid, 'event.duplicated', 'event', v_new, jsonb_build_object('source_event_id', p_source_event_id));

  return v_new;
end;
$$;

revoke all on function public.duplicate_event(uuid, text, text, timestamptz, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.duplicate_event(uuid, text, text, timestamptz, boolean, boolean, boolean, boolean) to authenticated;
