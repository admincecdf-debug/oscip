-- ============================================================
-- CEC FAMILY — Especificação de Melhorias §6: Gestão de Conteúdos.
-- Adiciona campo "Posição" (sort_order) às notícias, pra permitir
-- reordenação manual (o mesmo padrão que os Banners já usam).
-- ============================================================

alter table public.news add column if not exists sort_order int not null default 0;

-- Preenche a ordem inicial pelas mais recentes primeiro, pra quem já tem notícias cadastradas
update public.news set sort_order = sub.rn
from (
  select id, row_number() over (order by published_at desc nulls last, created_at desc) as rn
  from public.news
) sub
where public.news.id = sub.id and public.news.sort_order = 0;
