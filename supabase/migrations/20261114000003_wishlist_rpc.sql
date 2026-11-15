-- =====================================================================
-- Navidad en Familia — 0003: guardar un regalo con sus enlaces en una
-- sola transacción. SECURITY INVOKER: se aplican las políticas RLS de
-- quien llama (no da permisos extra).
-- =====================================================================

create or replace function public.save_wishlist_item(
  p_event_id        uuid,
  p_participant_id  uuid,
  p_title           text,
  p_description     text default null,
  p_price_estimate  numeric default null,
  p_priority        int default 2,
  p_links           jsonb default '[]'::jsonb,
  p_item_id         uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id    uuid;
  v_links jsonb := coalesce(p_links, '[]'::jsonb);
begin
  if jsonb_typeof(v_links) <> 'array' or jsonb_array_length(v_links) > 5 then
    raise exception 'TOO_MANY_LINKS' using errcode = '23514';
  end if;

  if p_item_id is null then
    insert into public.wishlist_items (event_id, participant_id, title, description, price_estimate, priority)
    values (p_event_id, p_participant_id, btrim(p_title), nullif(btrim(p_description), ''), p_price_estimate, coalesce(p_priority, 2))
    returning id into v_id;
  else
    update public.wishlist_items
       set title = btrim(p_title),
           description = nullif(btrim(p_description), ''),
           price_estimate = p_price_estimate,
           priority = coalesce(p_priority, 2)
     where id = p_item_id
       and event_id = p_event_id
       and participant_id = p_participant_id
    returning id into v_id;

    if v_id is null then
      raise exception 'NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
    end if;

    delete from public.wishlist_item_links where item_id = v_id;
  end if;

  insert into public.wishlist_item_links (item_id, url, label, sort_order)
  select v_id, btrim(l ->> 'url'), nullif(btrim(l ->> 'label'), ''), (t.ord - 1)::int
  from jsonb_array_elements(v_links) with ordinality as t(l, ord)
  where nullif(btrim(l ->> 'url'), '') is not null;

  return v_id;
end;
$$;

revoke all on function public.save_wishlist_item(uuid, uuid, text, text, numeric, int, jsonb, uuid) from public, anon;
grant execute on function public.save_wishlist_item(uuid, uuid, text, text, numeric, int, jsonb, uuid) to authenticated;
