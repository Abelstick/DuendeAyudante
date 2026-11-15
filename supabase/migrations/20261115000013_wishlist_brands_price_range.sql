-- =====================================================================
-- Navidad en Familia — 0013: marcas y rango de precios en los regalos
-- · brands: lista de marcas que le gustan (vacía = cualquier marca).
-- · price_max: "hasta". El price_estimate existente pasa a ser el "desde"
--   (o el precio aproximado si solo se llena ese), así los regalos ya
--   guardados se siguen viendo igual.
-- =====================================================================

alter table public.wishlist_items
  add column price_max numeric(10, 2) check (price_max is null or price_max >= 0),
  add column brands text[] not null default '{}' check (cardinality(brands) <= 8);

alter table public.wishlist_items
  add constraint wishlist_items_price_range
  check (price_estimate is null or price_max is null or price_max >= price_estimate);

grant insert (price_max, brands) on public.wishlist_items to authenticated;
grant update (price_max, brands) on public.wishlist_items to authenticated;

-- Se reemplaza la RPC: los nuevos parámetros van al final con valor por
-- defecto, para que las llamadas anteriores sigan funcionando.
drop function public.save_wishlist_item(uuid, uuid, text, text, numeric, int, jsonb, uuid);

create or replace function public.save_wishlist_item(
  p_event_id        uuid,
  p_participant_id  uuid,
  p_title           text,
  p_description     text default null,
  p_price_estimate  numeric default null,
  p_priority        int default 2,
  p_links           jsonb default '[]'::jsonb,
  p_item_id         uuid default null,
  p_price_max       numeric default null,
  p_brands          text[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id     uuid;
  v_links  jsonb := coalesce(p_links, '[]'::jsonb);
  v_brands text[];
begin
  if jsonb_typeof(v_links) <> 'array' or jsonb_array_length(v_links) > 5 then
    raise exception 'TOO_MANY_LINKS' using errcode = '23514';
  end if;

  -- Marcas: sin espacios sobrantes, sin vacías ni repetidas (sin importar mayúsculas)
  select coalesce(array_agg(b order by ord), '{}')
    into v_brands
    from (
      select distinct on (lower(btrim(x))) btrim(x) as b, ord
        from unnest(coalesce(p_brands, '{}')) with ordinality as t(x, ord)
       where nullif(btrim(x), '') is not null
       order by lower(btrim(x)), ord
    ) s;

  if cardinality(v_brands) > 8 then
    raise exception 'TOO_MANY_BRANDS' using errcode = '23514';
  end if;
  if exists (select 1 from unnest(v_brands) b where char_length(b) > 40) then
    raise exception 'BRAND_TOO_LONG' using errcode = '23514';
  end if;
  if p_price_estimate is not null and p_price_max is not null and p_price_max < p_price_estimate then
    raise exception 'PRICE_RANGE_INVALID' using errcode = '23514';
  end if;

  if p_item_id is null then
    insert into public.wishlist_items (event_id, participant_id, title, description, price_estimate, price_max, brands, priority)
    values (p_event_id, p_participant_id, btrim(p_title), nullif(btrim(p_description), ''),
            p_price_estimate, p_price_max, v_brands, coalesce(p_priority, 2))
    returning id into v_id;
  else
    update public.wishlist_items
       set title = btrim(p_title),
           description = nullif(btrim(p_description), ''),
           price_estimate = p_price_estimate,
           price_max = p_price_max,
           brands = v_brands,
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

revoke all on function public.save_wishlist_item(uuid, uuid, text, text, numeric, int, jsonb, uuid, numeric, text[]) from public, anon;
grant execute on function public.save_wishlist_item(uuid, uuid, text, text, numeric, int, jsonb, uuid, numeric, text[]) to authenticated;
