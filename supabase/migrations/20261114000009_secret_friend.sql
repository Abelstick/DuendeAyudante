-- =====================================================================
-- Navidad en Familia — 0009: amigo secreto (opcional y privado)
-- El sorteo se hizo fuera de la aplicación. Cada persona PUEDE anotar a
-- quién le regala; solo ella (o su tutor) lo ve. Ni el organizador ni los
-- administradores tienen acceso.
-- A propósito NO hay restricción de "un receptor por evento": avisar que
-- alguien ya fue elegido revelaría información del sorteo.
-- =====================================================================

create table public.secret_friend_notes (
  event_id                 uuid not null,
  giver_participant_id     uuid primary key,
  receiver_participant_id  uuid not null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  foreign key (event_id, giver_participant_id) references public.participants (event_id, id) on delete cascade,
  foreign key (event_id, receiver_participant_id) references public.participants (event_id, id) on delete cascade,
  check (giver_participant_id <> receiver_participant_id)
);

create trigger secret_friend_notes_updated_at before update on public.secret_friend_notes
  for each row execute function app.set_updated_at();

revoke all on public.secret_friend_notes from anon, authenticated;
grant select, delete on public.secret_friend_notes to authenticated;
grant insert (event_id, giver_participant_id, receiver_participant_id) on public.secret_friend_notes to authenticated;
grant update (receiver_participant_id) on public.secret_friend_notes to authenticated;

alter table public.secret_friend_notes enable row level security;

-- Solo la propia persona o su tutor. Sin excepción para organizador/administradores.
create policy secret_friend_select on public.secret_friend_notes
  for select to authenticated
  using (giver_participant_id in (select app.acting_participant_ids()));

create policy secret_friend_insert on public.secret_friend_notes
  for insert to authenticated
  with check (giver_participant_id in (select app.acting_participant_ids()));

create policy secret_friend_update on public.secret_friend_notes
  for update to authenticated
  using (giver_participant_id in (select app.acting_participant_ids()))
  with check (giver_participant_id in (select app.acting_participant_ids()));

create policy secret_friend_delete on public.secret_friend_notes
  for delete to authenticated
  using (giver_participant_id in (select app.acting_participant_ids()));
