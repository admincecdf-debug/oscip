-- ============================================================
-- CEC FAMILY — Caderno 13: Visualizações grandes
-- 1) Genealogia ministerial (LG mãe → LGs filhos)
-- 2) Dashboard Organizacional (KPIs consolidados)
-- 3) Mapa de Expansão (dados geo agregados)
-- Idempotente.
-- ============================================================

-- ============================================================
-- 1) GENEALOGIA MINISTERIAL
-- ============================================================
-- View: árvore de multiplicação de LGs
-- Cada LG tem: id, name, mother_cell_id, leader, multiplication_date, generation
create or replace view public.lg_genealogy as
with recursive tree as (
  -- Raízes: LGs sem mãe (geração 0)
  select
    lg.id,
    lg.name,
    lg.mother_cell_id,
    lg.church_id,
    lg.leader_id,
    lg.status_lg::text as status_lg,
    lg.founded_at,
    0 as generation,
    array[lg.id] as ancestry
  from public.life_groups lg
  where lg.mother_cell_id is null and lg.is_active

  union all

  -- Recursão: filhos seguem a mãe
  select
    child.id,
    child.name,
    child.mother_cell_id,
    child.church_id,
    child.leader_id,
    child.status_lg::text,
    child.founded_at,
    t.generation + 1,
    t.ancestry || child.id
  from public.life_groups child
  inner join tree t on child.mother_cell_id = t.id
  where child.is_active
)
select
  t.id, t.name, t.mother_cell_id, t.church_id, t.leader_id, t.status_lg,
  t.founded_at, t.generation, t.ancestry,
  (select count(*)::int from public.members m where m.life_group_id = t.id and m.status = 'ativo') as members_count,
  (select count(*)::int from public.life_groups lgc where lgc.mother_cell_id = t.id and lgc.is_active) as direct_children_count
from tree t;

comment on view public.lg_genealogy is 'Árvore de multiplicação dos Life Groups (geração 0 = raiz)';

-- ============================================================
-- 2) DASHBOARD ORGANIZACIONAL — KPIs CONSOLIDADOS
-- ============================================================
create or replace view public.org_dashboard_kpis as
select
  -- Comunidades
  (select count(*)::int from public.churches where is_active) as total_churches,
  (select count(*)::int from public.churches where type = 'sede' and is_active) as total_sedes,
  (select count(*)::int from public.churches where type = 'nucleo' and is_active) as total_nucleos,
  (select count(*)::int from public.churches where type = 'igreja_local' and is_active) as total_locais,

  -- Estados alcançados
  (select count(distinct state)::int from public.churches where state is not null and is_active) as estados_alcancados,
  (select count(distinct city)::int from public.churches where city is not null and is_active) as cidades_alcancadas,

  -- Estrutura celular
  (select count(*)::int from public.districts where is_active) as total_distritos,
  (select count(*)::int from public.areas where is_active) as total_areas,
  (select count(*)::int from public.sectors where is_active) as total_setores,
  (select count(*)::int from public.life_groups where is_active) as total_lgs,
  (select count(*)::int from public.life_groups where status_lg = 'em_multiplicacao' and is_active) as lgs_em_multiplicacao,
  (select count(*)::int from public.life_groups where status_lg = 'multiplicado' and is_active) as lgs_multiplicados,

  -- Membros
  (select count(*)::int from public.members where status = 'ativo') as total_membros_ativos,
  (select count(*)::int from public.members where status = 'ativo' and journey_stage = 'novo_convertido') as novos_convertidos,
  (select count(*)::int from public.members where created_at >= now() - interval '30 days') as novos_membros_30d,
  (select count(*)::int from public.members where created_at >= now() - interval '12 months') as novos_membros_12m,

  -- Atividade
  (select count(*)::int from public.meeting_reports where meeting_date >= current_date - 7) as relatorios_ultima_semana,
  (select count(*)::int from public.meeting_reports where meeting_date >= current_date - 30) as relatorios_ultimo_mes,

  -- Ministérios
  (select count(*)::int from public.ministries where is_active) as total_ministerios,

  -- Multiplicações no ano
  (select count(*)::int from public.life_groups
   where mother_cell_id is not null
     and founded_at is not null
     and founded_at >= date_trunc('year', current_date)) as multiplicacoes_ano,

  -- Multiplicações nos últimos 12 meses
  (select count(*)::int from public.life_groups
   where mother_cell_id is not null
     and founded_at is not null
     and founded_at >= current_date - interval '12 months') as multiplicacoes_12m;

comment on view public.org_dashboard_kpis is 'KPIs consolidados para dashboard executivo';

-- Crescimento mensal (últimos 12 meses)
create or replace view public.org_growth_monthly as
select
  to_char(d.month, 'YYYY-MM') as month_label,
  d.month::date as month_date,
  coalesce(m.new_members, 0) as new_members,
  coalesce(l.new_lgs, 0) as new_lgs
from (
  select generate_series(
    date_trunc('month', current_date) - interval '11 months',
    date_trunc('month', current_date),
    interval '1 month'
  )::date as month
) d
left join (
  select date_trunc('month', created_at)::date as m, count(*)::int as new_members
  from public.members
  where created_at >= current_date - interval '12 months'
  group by 1
) m on m.m = d.month
left join (
  select date_trunc('month', founded_at)::date as m, count(*)::int as new_lgs
  from public.life_groups
  where founded_at is not null and founded_at >= current_date - interval '12 months'
  group by 1
) l on l.m = d.month
order by d.month;

comment on view public.org_growth_monthly is 'Crescimento mensal — últimos 12 meses (novos membros + novos LGs)';

-- ============================================================
-- 3) MAPA DE EXPANSÃO — DADOS AGREGADOS POR LOCAL
-- ============================================================
-- Por cidade: quantas comunidades, LGs, membros — ponto no mapa
create or replace view public.expansion_map_cities as
select
  c.state,
  c.city,
  count(distinct c.id)::int as churches_count,
  count(distinct lg.id)::int as lgs_count,
  count(distinct case when m.status = 'ativo' then m.id end)::int as members_count,
  array_agg(distinct c.name) as church_names,
  array_agg(distinct c.type) as church_types
from public.churches c
left join public.life_groups lg on lg.church_id = c.id and lg.is_active
left join public.members m on m.church_id = c.id
where c.is_active and c.city is not null and c.state is not null
group by c.state, c.city;

comment on view public.expansion_map_cities is 'Cidades alcançadas — agregação para o mapa de expansão';

-- Por estado: totais regionais
create or replace view public.expansion_map_states as
select
  c.state,
  count(distinct c.id)::int as churches_count,
  count(distinct c.city)::int as cities_count,
  count(distinct lg.id)::int as lgs_count,
  count(distinct case when m.status = 'ativo' then m.id end)::int as members_count
from public.churches c
left join public.life_groups lg on lg.church_id = c.id and lg.is_active
left join public.members m on m.church_id = c.id
where c.is_active and c.state is not null
group by c.state;

comment on view public.expansion_map_states is 'Totais por estado para o mapa de expansão';
