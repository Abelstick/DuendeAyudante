-- =====================================================================
-- Navidad en Familia — 0017: dirección de la celebración
-- Texto libre (calle, número, distrito, referencia). La app arma los
-- enlaces a Google Maps y Waze a partir de este texto.
-- =====================================================================

alter table public.events
  add column address text check (address is null or char_length(address) <= 300);

grant update (address) on public.events to authenticated;
