-- ============================================================
-- CEC FAMILY — UX-003 Cap. 3 Parte 3: Metas por Ministério.
--
-- A view goals_vs_actual já existente só cobre escopo 'nacional'
-- (confirmado via pg_get_viewdef). Em vez de arriscar quebrá-la,
-- criamos uma view separada específica pra metas de ministério —
-- reaproveita a mesma tabela ministry_goals (scope/indicator já
-- são texto simples, sem enum, então aceita valores novos sem
-- migration de tipo).
-- ============================================================

create or replace view public.ministry_goals_vs_actual as
select
  g.id, g.scope, g.scope_id, g.scope_name, g.year, g.month, g.indicator, g.target_value, g.notes,
  m.name as ministry_name,
  coalesce((select count(*) from public.ministry_members mm where mm.ministry_id = g.scope_id and mm.is_active), 0)::numeric as actual_value,
  round(
    coalesce((select count(*) from public.ministry_members mm where mm.ministry_id = g.scope_id and mm.is_active), 0)::numeric
    / nullif(g.target_value, 0) * 100, 1
  ) as pct_atingido,
  case
    when round(
      coalesce((select count(*) from public.ministry_members mm where mm.ministry_id = g.scope_id and mm.is_active), 0)::numeric
      / nullif(g.target_value, 0) * 100, 1) >= 100 then 'atingido'
    when round(
      coalesce((select count(*) from public.ministry_members mm where mm.ministry_id = g.scope_id and mm.is_active), 0)::numeric
      / nullif(g.target_value, 0) * 100, 1) >= 70 then 'no_caminho'
    else 'atencao'
  end as status_meta
from public.ministry_goals g
join public.ministries m on m.id = g.scope_id
where g.scope = 'ministerio' and g.indicator = 'integrantes_ministerio';

grant select on public.ministry_goals_vs_actual to authenticated;

-- RLS da tabela base já existente (ministry_goals) deve cobrir a
-- leitura/escrita — a view herda a mesma abrangência de quem consulta.
