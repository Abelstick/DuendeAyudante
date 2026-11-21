-- =====================================================================
-- Navidad en Familia — 0024: anuncio fijado
--
-- Quien publica puede fijar UN anuncio por celebración (ej. «Fecha límite
-- para enviar los regalos»). La app lo muestra como banner destacado en
-- Inicio, justo debajo de la cuenta regresiva, y no se puede contraer.
-- Al fijar uno, el que estaba fijado antes se suelta solo.
-- =====================================================================

alter table public.announcements add column pinned boolean not null default false;

-- Como mucho un anuncio fijado por celebración
create unique index announcements_one_pinned on public.announcements (event_id) where pinned;

-- Al fijar un anuncio se suelta el que estaba fijado (corre con los permisos
-- de quien edita: si puede fijar este, puede editar los de su celebración)
create or replace function app.announcements_single_pin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pinned then
    update public.announcements
       set pinned = false
     where event_id = new.event_id
       and pinned
       and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger announcements_single_pin before insert or update of pinned on public.announcements
  for each row when (new.pinned) execute function app.announcements_single_pin();

grant insert (pinned) on public.announcements to authenticated;
grant update (pinned) on public.announcements to authenticated;
