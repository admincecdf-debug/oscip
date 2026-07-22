-- ============================================================
-- CEC FAMILY — UX-003 Cap. 3 Parte 3: Inteligência Ministerial.
--
-- Compara o crescimento de membros de cada Setor nos últimos 6
-- meses contra os 6 meses anteriores, e contra a média geral da
-- Comunidade — destacando os que mais se distanciaram da média
-- (pra cima ou pra baixo). O texto em si é montado no frontend a
-- partir desses números (mantém a função só com dados, sem
-- string pronta em português — mais fácil de manter/testar).
-- ============================================================

create or replace function public.intelligence_growth_by_sector()
returns table (
  sector_id uuid, sector_name text,
  members_last_6m int, members_prior_6m int,
  growth_pct numeric
)
language sql stable security definer set search_path = public as $$
  with base as (
    select
      ca.sector_id, ca.sector_name,
      count(*) filter (where m.joined_at >= now() - interval '6 months') as last_6m,
      count(*) filter (where m.joined_at >= now() - interval '12 months' and m.joined_at < now() - interval '6 months') as prior_6m
    from public.members m
    join public.church_ancestry ca on ca.church_id = m.church_id
    where m.church_id in (select public.accessible_church_ids())
      and ca.sector_id is not null
    group by ca.sector_id, ca.sector_name
  )
  select
    sector_id, sector_name, last_6m, prior_6m,
    case when prior_6m = 0 then null
         else round(((last_6m - prior_6m)::numeric / prior_6m) * 100, 1)
    end as growth_pct
  from base
  where prior_6m >= 3  -- ignora amostras pequenas demais (viram % absurdo e sem significado)
  order by growth_pct desc nulls last;
$$;
grant execute on function public.intelligence_growth_by_sector() to authenticated;

-- ============================================================
-- Mesmo cálculo, mas pro total da Comunidade (a "média geral"
-- contra a qual cada setor é comparado)
-- ============================================================
create or replace function public.intelligence_growth_overall()
returns table (members_last_6m int, members_prior_6m int, growth_pct numeric)
language sql stable security definer set search_path = public as $$
  with base as (
    select
      count(*) filter (where m.joined_at >= now() - interval '6 months') as last_6m,
      count(*) filter (where m.joined_at >= now() - interval '12 months' and m.joined_at < now() - interval '6 months') as prior_6m
    from public.members m
    where m.church_id in (select public.accessible_church_ids())
  )
  select last_6m, prior_6m,
    case when prior_6m = 0 then null else round(((last_6m - prior_6m)::numeric / prior_6m) * 100, 1) end
  from base;
$$;
grant execute on function public.intelligence_growth_overall() to authenticated;
