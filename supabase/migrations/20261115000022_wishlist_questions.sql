-- =====================================================================
-- Navidad en Familia — 0022: preguntas anónimas sobre un regalo
-- Quien mira la lista de otra persona puede preguntar algo sobre un
-- regalo ("¿qué talla?"). La pregunta es ANÓNIMA: así nadie descubre
-- quién es su amigo secreto.
--  * Todos los del evento ven las preguntas y sus respuestas.
--  * Responde quien puede cambiar el regalo (la persona, su tutor o
--    quien administra).
--  * Nadie puede leer la tabla directamente (ni el organizador): todo
--    pasa por las RPC de abajo, que nunca devuelven quién preguntó.
--    Solo quien preguntó sabe que la pregunta es suya (`is_mine`).
-- =====================================================================

create table public.wishlist_questions (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references public.events (id) on delete cascade,
  item_id               uuid not null references public.wishlist_items (id) on delete cascade,
  asker_participant_id  uuid not null,
  question              text not null check (char_length(btrim(question)) between 1 and 300),
  answer                text check (answer is null or char_length(btrim(answer)) between 1 and 500),
  answered_at           timestamptz,
  -- Cuándo vio la respuesta quien preguntó (para avisarle solo una vez)
  answer_seen_at        timestamptz,
  created_at            timestamptz not null default now(),
  foreign key (event_id, asker_participant_id) references public.participants (event_id, id) on delete cascade
);

create index wishlist_questions_event on public.wishlist_questions (event_id);
create index wishlist_questions_item on public.wishlist_questions (item_id);

-- Sin permisos directos y con RLS sin políticas: solo las RPC (SECURITY DEFINER) la tocan.
revoke all on public.wishlist_questions from anon, authenticated;
alter table public.wishlist_questions enable row level security;

-- ¿La pregunta la hizo quien llama?
create or replace function app.is_my_question(p_asker_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.participants p
     where p.id = p_asker_participant_id and p.user_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------

-- Preguntas y respuestas de todos los regalos del evento, sin quién preguntó.
create or replace function public.list_wishlist_questions(p_event_id uuid)
returns table (
  id             uuid,
  item_id        uuid,
  question       text,
  answer         text,
  created_at     timestamptz,
  answered_at    timestamptz,
  is_mine        boolean,
  answer_unseen  boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_member(p_event_id) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;

  return query
  select q.id,
         q.item_id,
         q.question,
         q.answer,
         q.created_at,
         q.answered_at,
         app.is_my_question(q.asker_participant_id),
         q.answer is not null and q.answer_seen_at is null and app.is_my_question(q.asker_participant_id)
  from public.wishlist_questions q
  where q.event_id = p_event_id
  order by q.created_at;
end;
$$;

-- Preguntar por un regalo de otra persona (no por los propios ni los de alguien a mi cargo).
create or replace function public.ask_wishlist_question(p_item_id uuid, p_question text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item  public.wishlist_items%rowtype;
  v_me    uuid;
  v_text  text := btrim(coalesce(p_question, ''));
  v_id    uuid;
begin
  select * into v_item from public.wishlist_items where id = p_item_id;
  if v_item.id is null or not app.is_member(v_item.event_id) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;
  if v_item.participant_id in (select app.acting_participant_ids()) then
    raise exception 'QUESTION_OWN_ITEM' using errcode = '23514';
  end if;

  select p.id into v_me
    from public.participants p
   where p.event_id = v_item.event_id and p.user_id = auth.uid() and p.status = 'active'
   limit 1;
  if v_me is null then
    raise exception 'QUESTION_NEEDS_PROFILE' using errcode = '23514';
  end if;

  if char_length(v_text) not between 1 and 300 then
    raise exception 'QUESTION_INVALID' using errcode = '23514';
  end if;
  -- Límite anti-abuso: 20 preguntas por regalo
  if (select count(*) from public.wishlist_questions q where q.item_id = p_item_id) >= 20 then
    raise exception 'TOO_MANY_QUESTIONS' using errcode = '23514';
  end if;

  insert into public.wishlist_questions (event_id, item_id, asker_participant_id, question)
  values (v_item.event_id, p_item_id, v_me, v_text)
  returning id into v_id;
  return v_id;
end;
$$;

-- Responder (o cambiar la respuesta): quien puede cambiar el regalo.
create or replace function public.answer_wishlist_question(p_question_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner  uuid;
  v_event  uuid;
  v_text   text := btrim(coalesce(p_answer, ''));
begin
  select i.participant_id, q.event_id into v_owner, v_event
    from public.wishlist_questions q
    join public.wishlist_items i on i.id = q.item_id
   where q.id = p_question_id;
  if v_owner is null or not app.can_act_for(v_owner, v_event) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if char_length(v_text) not between 1 and 500 then
    raise exception 'ANSWER_INVALID' using errcode = '23514';
  end if;

  update public.wishlist_questions
     set answer = v_text, answered_at = now(), answer_seen_at = null
   where id = p_question_id;
end;
$$;

-- Quitar una pregunta: quien puede cambiar el regalo, o quien la hizo mientras no tenga respuesta.
create or replace function public.delete_wishlist_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner     uuid;
  v_event     uuid;
  v_asker     uuid;
  v_answered  boolean;
begin
  select i.participant_id, q.event_id, q.asker_participant_id, q.answer is not null
    into v_owner, v_event, v_asker, v_answered
    from public.wishlist_questions q
    join public.wishlist_items i on i.id = q.item_id
   where q.id = p_question_id;
  if v_owner is null
     or not (app.can_act_for(v_owner, v_event) or (app.is_my_question(v_asker) and not v_answered)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  delete from public.wishlist_questions where id = p_question_id;
end;
$$;

-- Quien preguntó ya vio las respuestas de este regalo: deja de avisarle.
create or replace function public.mark_wishlist_answers_seen(p_item_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.wishlist_questions q
     set answer_seen_at = now()
   where q.item_id = p_item_id
     and q.answer is not null
     and q.answer_seen_at is null
     and app.is_my_question(q.asker_participant_id)
$$;

revoke all on function app.is_my_question(uuid) from public, anon;
grant execute on function app.is_my_question(uuid) to authenticated;

revoke all on function public.list_wishlist_questions(uuid) from public, anon;
revoke all on function public.ask_wishlist_question(uuid, text) from public, anon;
revoke all on function public.answer_wishlist_question(uuid, text) from public, anon;
revoke all on function public.delete_wishlist_question(uuid) from public, anon;
revoke all on function public.mark_wishlist_answers_seen(uuid) from public, anon;
grant execute on function public.list_wishlist_questions(uuid) to authenticated;
grant execute on function public.ask_wishlist_question(uuid, text) to authenticated;
grant execute on function public.answer_wishlist_question(uuid, text) to authenticated;
grant execute on function public.delete_wishlist_question(uuid) to authenticated;
grant execute on function public.mark_wishlist_answers_seen(uuid) to authenticated;
