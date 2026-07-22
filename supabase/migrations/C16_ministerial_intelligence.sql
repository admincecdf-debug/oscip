-- ============================================================
-- CEC FAMILY — Caderno 16: Inteligência Ministerial
-- Score Ministerial, Rankings, Funil de Retenção,
-- Índice de Confiabilidade, Consolidação Hierárquica
-- Idempotente. Depende de: IA1_indicators, M_weekly_report_full_11B
-- ============================================================

-- ============================================================
-- 1) SCORE MINISTERIAL POR LG (0–100)
-- Dimensões e pesos:
--   Consistência de Reporte   20 pts  → semanas reportadas / semanas esperadas (90d)
--   Frequência Média          20 pts  → média de presentes relativa ao maior LG
--   Retenção / Consolidação   15 pts  → integrados + novos membros
--   Discipulado Ativo         15 pts  → disc_ativos / membros
--   Evangelismo               15 pts  → visitantes + decisões (90d)
--   Multiplicação             15 pts  → status_lg + filhos diretos
-- ============================================================
create or replace view public.lg_score_ministerial as
with

-- Base: LGs ativos
lgs as (
  select
    lg.id,
    lg.name,
    lg.church_id,
    lg.leader_id,
    lg.status_lg::text as status_lg,
    lg.founded_at,
    lg.mother_cell_id,
    coalesce(
      (select count(*)::int from public.life_groups c where c.mother_cell_id = lg.id and c.is_active),
      0
    ) as direct_children
  from public.life_groups lg
  where lg.is_active
),

-- Membros ativos por LG
membros as (
  select life_group_id, count(*)::int as total
  from public.members
  where status = 'ativo' and life_group_id is not null
  group by life_group_id
),

-- Relatórios dos últimos 90 dias
relatorios_90d as (
  select
    life_group_id,
    count(*)                              as total_relatorios,
    coalesce(avg(attendance_count), 0)    as media_presentes,
    coalesce(sum(visitors_count), 0)      as total_visitantes,
    coalesce(sum(decisions_count), 0)     as total_decisoes,
    coalesce(sum(disc_ativos), 0)         as total_disc_ativos,
    coalesce(sum(cons_integrados), 0)     as total_integrados,
    coalesce(sum(cons_novos_membros), 0)  as total_novos_membros,
    max(meeting_date)                     as ultimo_relatorio
  from public.meeting_reports
  where meeting_date >= current_date - 90
  group by life_group_id
),

-- Máximo de presentes para normalização
max_freq as (
  select greatest(1, max(media_presentes)) as val from relatorios_90d
),

-- Score calculado
scored as (
  select
    l.id,
    l.name,
    l.church_id,
    l.leader_id,
    l.status_lg,
    l.founded_at,
    l.mother_cell_id,
    l.direct_children,
    coalesce(m.total, 0) as members_count,
    r.total_relatorios,
    r.media_presentes,
    r.total_visitantes,
    r.total_decisoes,
    r.total_disc_ativos,
    r.total_integrados,
    r.total_novos_membros,
    r.ultimo_relatorio,

    -- D1: Consistência de reporte (0-20): semanas em 90d ≈ 13
    least(20, round(coalesce(r.total_relatorios, 0)::numeric / 13 * 20))::int
      as pts_reporte,

    -- D2: Frequência média normalizada (0-20)
    least(20, round(coalesce(r.media_presentes, 0) / (select val from max_freq) * 20))::int
      as pts_frequencia,

    -- D3: Retenção/Consolidação (0-15): >0 integrados ou novos
    least(15,
      coalesce(r.total_integrados, 0) * 3 +
      coalesce(r.total_novos_membros, 0) * 3
    )::int as pts_retencao,

    -- D4: Discipulado (0-15): disc_ativos / membros
    case
      when coalesce(m.total, 0) = 0 then 0
      else least(15, round(coalesce(r.total_disc_ativos, 0)::numeric / m.total * 15))::int
    end as pts_discipulado,

    -- D5: Evangelismo (0-15): visitantes + decisões normalizados
    least(15, coalesce(r.total_visitantes, 0) + coalesce(r.total_decisoes, 0) * 2)::int
      as pts_evangelismo,

    -- D6: Multiplicação (0-15)
    (case
      when l.status_lg = 'multiplicado'       then 15
      when l.status_lg = 'em_multiplicacao'   then 10
      when l.direct_children > 0              then 8
      when l.status_lg = 'em_formacao'        then 3
      else 0
    end)::int as pts_multiplicacao

  from lgs l
  left join membros     m on m.life_group_id = l.id
  left join relatorios_90d r on r.life_group_id = l.id
)

select
  s.*,
  (s.pts_reporte + s.pts_frequencia + s.pts_retencao +
   s.pts_discipulado + s.pts_evangelismo + s.pts_multiplicacao) as score_total,
  case
    when (s.pts_reporte + s.pts_frequencia + s.pts_retencao +
          s.pts_discipulado + s.pts_evangelismo + s.pts_multiplicacao) >= 75 then 'saudavel'
    when (s.pts_reporte + s.pts_frequencia + s.pts_retencao +
          s.pts_discipulado + s.pts_evangelismo + s.pts_multiplicacao) >= 45 then 'atencao'
    else 'critico'
  end as health_band
from scored s;

comment on view public.lg_score_ministerial is
  'Score Ministerial 0-100 por LG: reporte + frequência + retenção + discipulado + evangelismo + multiplicação';

-- ============================================================
-- 2) RANKINGS — LGs por dimensão e geral
-- ============================================================
create or replace view public.lg_rankings as
select
  s.id,
  s.name,
  s.church_id,
  c.name as church_name,
  s.status_lg,
  s.members_count,
  s.score_total,
  s.health_band,
  s.pts_reporte,
  s.pts_frequencia,
  s.pts_retencao,
  s.pts_discipulado,
  s.pts_evangelismo,
  s.pts_multiplicacao,
  s.total_relatorios,
  s.media_presentes,
  s.total_visitantes,
  s.total_decisoes,
  s.ultimo_relatorio,
  s.direct_children,
  -- Posição geral
  rank() over (order by s.score_total desc nulls last)::int           as rank_geral,
  rank() over (order by s.pts_frequencia desc nulls last)::int        as rank_frequencia,
  rank() over (order by s.pts_evangelismo desc nulls last)::int       as rank_evangelismo,
  rank() over (order by s.pts_multiplicacao desc nulls last)::int     as rank_multiplicacao,
  rank() over (order by s.pts_discipulado desc nulls last)::int       as rank_discipulado,
  rank() over (order by s.total_visitantes desc nulls last)::int      as rank_visitantes,
  rank() over (order by s.members_count desc nulls last)::int         as rank_membros
from public.lg_score_ministerial s
left join public.churches c on c.id = s.church_id;

comment on view public.lg_rankings is 'Rankings de LGs por múltiplas dimensões ministeriais';

-- ============================================================
-- 3) FUNIL DE RETENÇÃO — contagem real por estágio
-- ============================================================
create or replace view public.retention_funnel as
select
  -- Estágios em ordem de jornada
  count(*) filter (where m.journey_stage in ('visitante'))::int                    as visitantes,
  count(*) filter (where m.journey_stage in ('novo_convertido','consolidacao'))::int as consolidacao,
  count(*) filter (where m.journey_stage in ('discipulado'))::int                   as discipulado,
  count(*) filter (where m.journey_stage in ('batismo'))::int                       as batismo,
  count(*) filter (where m.journey_stage in ('membro_ativo'))::int                  as membros_ativos,
  count(*) filter (where m.journey_stage in ('servo','lider_formacao'))::int        as servos_e_formacao,
  count(*) filter (where m.journey_stage in ('lider','supervisor','missionario'))::int as lideres,
  count(*)::int                                                                       as total
from public.members m
where m.status = 'ativo';

comment on view public.retention_funnel is 'Funil de retenção: Visitante → Líder com contagens reais';

-- Funil por igreja (para drill-down)
create or replace view public.retention_funnel_by_church as
select
  m.church_id,
  c.name as church_name,
  count(*) filter (where m.journey_stage = 'visitante')::int                         as visitantes,
  count(*) filter (where m.journey_stage in ('novo_convertido','consolidacao'))::int  as consolidacao,
  count(*) filter (where m.journey_stage = 'discipulado')::int                        as discipulado,
  count(*) filter (where m.journey_stage = 'batismo')::int                            as batismo,
  count(*) filter (where m.journey_stage = 'membro_ativo')::int                       as membros_ativos,
  count(*) filter (where m.journey_stage in ('servo','lider_formacao'))::int          as servos_e_formacao,
  count(*) filter (where m.journey_stage in ('lider','supervisor','missionario'))::int as lideres,
  count(*)::int                                                                         as total
from public.members m
left join public.churches c on c.id = m.church_id
where m.status = 'ativo' and m.church_id is not null
group by m.church_id, c.name;

comment on view public.retention_funnel_by_church is 'Funil de retenção por igreja';

-- ============================================================
-- 4) ÍNDICE DE CONFIABILIDADE DOS DADOS
-- Detecta: LGs sem relatório, gaps, dados suspeitos
-- ============================================================
create or replace view public.lg_reliability_index as
with

-- Relatórios últimos 90 dias
r90 as (
  select
    life_group_id,
    count(*)                                    as relatorios_90d,
    max(meeting_date)                           as ultimo_relatorio,
    min(meeting_date)                           as primeiro_relatorio_90d,
    -- Detectar valores suspeitos (visitantes > 3x membros do LG)
    count(*) filter (where visitors_count > 50) as relatorios_suspeitos_visitantes,
    count(*) filter (where attendance_count = 0 and visitors_count > 0) as relatorios_sem_presentes_com_visitantes
  from public.meeting_reports
  where meeting_date >= current_date - 90
  group by life_group_id
),

membros as (
  select life_group_id, count(*)::int as total
  from public.members where status = 'ativo' and life_group_id is not null
  group by life_group_id
)

select
  lg.id,
  lg.name,
  lg.church_id,
  c.name as church_name,
  coalesce(m.total, 0)            as members_count,
  coalesce(r.relatorios_90d, 0)   as relatorios_90d,
  r.ultimo_relatorio,

  -- Dias desde o último relatório
  case
    when r.ultimo_relatorio is null then 999
    else (current_date - r.ultimo_relatorio)::int
  end as dias_sem_relatorio,

  -- Taxa de reporte esperada: 1/semana → 13 em 90d
  round(coalesce(r.relatorios_90d, 0)::numeric / 13 * 100, 1) as taxa_reporte_pct,

  -- Flags de problema
  (r.ultimo_relatorio is null or r.ultimo_relatorio < current_date - 14)  as flag_sem_relatorio_recente,
  (coalesce(r.relatorios_90d, 0) < 4)                                     as flag_reporte_irregular,
  (coalesce(r.relatorios_suspeitos_visitantes, 0) > 0)                    as flag_dados_suspeitos,
  (coalesce(m.total, 0) = 0)                                              as flag_sem_membros,

  -- Quantidade de flags
  (
    (case when r.ultimo_relatorio is null or r.ultimo_relatorio < current_date - 14 then 1 else 0 end) +
    (case when coalesce(r.relatorios_90d, 0) < 4 then 1 else 0 end) +
    (case when coalesce(r.relatorios_suspeitos_visitantes, 0) > 0 then 1 else 0 end) +
    (case when coalesce(m.total, 0) = 0 then 1 else 0 end)
  )::int as total_flags,

  -- Classificação de confiabilidade
  case
    when (
      (case when r.ultimo_relatorio is null or r.ultimo_relatorio < current_date - 14 then 1 else 0 end) +
      (case when coalesce(r.relatorios_90d, 0) < 4 then 1 else 0 end) +
      (case when coalesce(r.relatorios_suspeitos_visitantes, 0) > 0 then 1 else 0 end) +
      (case when coalesce(m.total, 0) = 0 then 1 else 0 end)
    ) = 0 then 'confiavel'
    when (
      (case when r.ultimo_relatorio is null or r.ultimo_relatorio < current_date - 14 then 1 else 0 end) +
      (case when coalesce(r.relatorios_90d, 0) < 4 then 1 else 0 end) +
      (case when coalesce(r.relatorios_suspeitos_visitantes, 0) > 0 then 1 else 0 end) +
      (case when coalesce(m.total, 0) = 0 then 1 else 0 end)
    ) = 1 then 'atencao'
    else 'critico'
  end as reliability_band

from public.life_groups lg
left join r90     r on r.life_group_id = lg.id
left join membros m on m.life_group_id = lg.id
left join public.churches c on c.id = lg.church_id
where lg.is_active;

comment on view public.lg_reliability_index is
  'Índice de confiabilidade dos dados por LG: detecta gaps de reporte, irregularidades e suspeitas';

-- ============================================================
-- 5) RESUMO NACIONAL DE CONFIABILIDADE
-- ============================================================
create or replace view public.reliability_summary as
select
  count(*)::int                                                        as total_lgs,
  count(*) filter (where reliability_band = 'confiavel')::int         as lgs_confiaveis,
  count(*) filter (where reliability_band = 'atencao')::int           as lgs_atencao,
  count(*) filter (where reliability_band = 'critico')::int           as lgs_criticos,
  count(*) filter (where flag_sem_relatorio_recente)::int             as lgs_sem_relatorio_recente,
  count(*) filter (where flag_reporte_irregular)::int                 as lgs_reporte_irregular,
  count(*) filter (where flag_dados_suspeitos)::int                   as lgs_dados_suspeitos,
  count(*) filter (where flag_sem_membros)::int                       as lgs_sem_membros,
  round(avg(taxa_reporte_pct), 1)                                     as taxa_reporte_media_pct,
  round(
    count(*) filter (where reliability_band = 'confiavel')::numeric /
    nullif(count(*), 0) * 100, 1
  )                                                                    as pct_confiaveis
from public.lg_reliability_index;

comment on view public.reliability_summary is 'Resumo nacional do índice de confiabilidade dos dados';

-- ============================================================
-- 6) CONSOLIDAÇÃO HIERÁRQUICA MENSAL (Setor → Nacional)
-- ============================================================
create or replace view public.monthly_consolidation as
select
  date_trunc('month', mr.meeting_date)::date     as mes,
  to_char(mr.meeting_date, 'YYYY-MM')            as mes_label,
  lg.church_id,
  c.name                                          as church_name,
  c.type                                          as church_type,
  c.parent_id                                     as church_parent_id,
  lg.sector_id,
  se.name                                         as sector_name,
  se.area_id,
  ar.name                                         as area_name,
  ar.district_id,
  di.name                                         as district_name,

  -- Contagens
  count(distinct mr.life_group_id)::int           as lgs_reportaram,
  count(mr.id)::int                               as total_relatorios,
  coalesce(sum(mr.attendance_count), 0)::int      as total_presentes,
  coalesce(sum(mr.frequentadores_count), 0)::int  as total_frequentadores,
  coalesce(sum(mr.visitors_count), 0)::int        as total_visitantes,
  coalesce(sum(mr.decisions_count), 0)::int       as total_decisoes,
  coalesce(sum(mr.disc_ativos), 0)::int           as total_disc_ativos,
  coalesce(sum(mr.disc_novos), 0)::int            as total_disc_novos,
  coalesce(sum(mr.cons_integrados), 0)::int       as total_integrados,
  coalesce(sum(mr.cons_novos_membros), 0)::int    as total_novos_membros,
  coalesce(sum(mr.ebd_count), 0)::int             as total_ebd,
  coalesce(sum(CASE WHEN mr.ge_happened THEN 1 ELSE 0 END), 0)::int as total_ge,
  coalesce(sum(mr.oferta_pix + mr.oferta_especie), 0)::numeric       as total_oferta,

  -- Multiplicação
  count(*) filter (where mr.mult_filha_preparacao)::int               as lgs_em_preparacao_mult,
  count(*) filter (where mr.mult_nova_lideranca)::int                 as lgs_nova_lideranca,

  -- Necessidades pastorais
  count(*) filter (where mr.nec_oracao_urgente)::int                  as total_oracao_urgente,
  count(*) filter (where mr.nec_visita_pastoral)::int                 as total_visita_pastoral

from public.meeting_reports mr
join public.life_groups lg      on lg.id = mr.life_group_id
left join public.sectors  se    on se.id = lg.sector_id
left join public.areas    ar    on ar.id = se.area_id
left join public.districts di   on di.id = ar.district_id
left join public.churches  c    on c.id  = lg.church_id
group by
  date_trunc('month', mr.meeting_date),
  to_char(mr.meeting_date, 'YYYY-MM'),
  lg.church_id, c.name, c.type, c.parent_id,
  lg.sector_id, se.name, se.area_id, ar.name,
  ar.district_id, di.name;

comment on view public.monthly_consolidation is
  'Consolidação mensal hierárquica: Setor → Área → Distrito → Igreja → Nacional';

-- ============================================================
-- 7) KPIs DE VARIAÇÃO (crescimento percentual mês a mês)
-- ============================================================
create or replace view public.growth_variation as
with monthly as (
  select
    mes_label,
    mes,
    sum(total_presentes)::int    as presentes,
    sum(total_visitantes)::int   as visitantes,
    sum(total_decisoes)::int     as decisoes,
    sum(total_integrados)::int   as integrados,
    sum(total_disc_ativos)::int  as disc_ativos,
    sum(lgs_reportaram)::int     as lgs_reportaram
  from public.monthly_consolidation
  group by mes_label, mes
)
select
  m.mes_label,
  m.mes,
  m.presentes,
  m.visitantes,
  m.decisoes,
  m.integrados,
  m.disc_ativos,
  m.lgs_reportaram,
  -- Variação % vs mês anterior
  round(
    (m.presentes - lag(m.presentes) over w)::numeric /
    nullif(lag(m.presentes) over w, 0) * 100, 1
  ) as var_pct_presentes,
  round(
    (m.visitantes - lag(m.visitantes) over w)::numeric /
    nullif(lag(m.visitantes) over w, 0) * 100, 1
  ) as var_pct_visitantes,
  round(
    (m.lgs_reportaram - lag(m.lgs_reportaram) over w)::numeric /
    nullif(lag(m.lgs_reportaram) over w, 0) * 100, 1
  ) as var_pct_lgs_reportaram
from monthly m
window w as (order by m.mes)
order by m.mes;

comment on view public.growth_variation is
  'Crescimento percentual mês a mês: presentes, visitantes, decisões, LGs';

-- ============================================================
-- RLS — todas as views herdam do authenticated
-- ============================================================
grant select on public.lg_score_ministerial      to authenticated;
grant select on public.lg_rankings               to authenticated;
grant select on public.retention_funnel          to authenticated;
grant select on public.retention_funnel_by_church to authenticated;
grant select on public.lg_reliability_index      to authenticated;
grant select on public.reliability_summary       to authenticated;
grant select on public.monthly_consolidation     to authenticated;
grant select on public.growth_variation          to authenticated;
