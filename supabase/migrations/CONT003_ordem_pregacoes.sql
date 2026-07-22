-- ============================================================
-- CEC FAMILY — Pregações: adiciona sort_order (reordenação manual,
-- mesmo padrão de Notícias e Banners).
-- ============================================================

alter table public.sermons add column if not exists sort_order int not null default 0;

update public.sermons set sort_order = sub.rn
from (
  select id, row_number() over (order by published_at desc nulls last) as rn
  from public.sermons
) sub
where public.sermons.id = sub.id and public.sermons.sort_order = 0;
