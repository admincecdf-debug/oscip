-- ============================================================
-- CEC FAMILY — Caderno 17: Central de Metas
-- Metas por nível hierárquico + acompanhamento vs. realizado
-- Idempotente. Depende de: C16_ministerial_intelligence
-- ============================================================

-- ============================================================
-- 1) TABELA DE METAS
-- ============================================================
create table if not exists public.ministry_goals (
  id            uuid primary key default gen_random_uuid(),
  -- Escopo da meta (qual nível)
  scope         text not null check (scope in ('nacional','sede','nucleo','distrito','area','setor','lg')),
  -- Referência ao registro do escopo (null = nacional)
  scope_id      uuid default null,
  scope_name    text not null,                      -- nome legível (desnormalizado p/ performance)
  -- Período
  year          int  not null,
  month         int  default null,                  -- null = meta anual
  -- Indicador
  indicator     text not null check (indicator in (
    'membros_ativos','visitantes','decisoes','batismos',
    'multiplicacoes','lgs_ativos','disc_ativos','integrados',
    'relatorios_enviados','novos_membros'
  )),
  -- Valores
  target_value  numeric(10,2) not null,
  -- Metadata
  notes         text default null,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  -- Unicidade: um indicador por escopo/período
  unique (scope, scope_id, year, month, indicator)
);

alter table public.ministry_goals enable row level security;

drop policy if exists "goals_read" on public.ministry_goals;
create policy "goals_read" on public.ministry_goals
  for select to authenticated using (true);

drop policy if exists "goals_write" on public.ministry_goals;
create policy "goals_write" on public.ministry_goals
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('apostolo','pastor','supervisor')
    )
  );

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists ministry_goals_updated_at on public.ministry_goals;
create trigger ministry_goals_updated_at
  before update on public.ministry_goals
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2) VIEW: METAS vs. REALIZADO (nacional e por igreja)
-- ============================================================
create or replace view public.goals_vs_actual as
with

-- Realizado por indicador (últimos dados disponíveis)
actual as (
  select
    null::uuid as scope_id,
    'nacional'  as scope,
    extract(year from current_date)::int as year,
    extract(month from current_date)::int as month,

    (select count(*)::int from public.members where status = 'ativo')
      as membros_ativos,
    (select count(*)::int from public.life_groups where is_active)
      as lgs_ativos,
    (select coalesce(sum(visitors_count), 0)::int
       from public.meeting_reports
       where meeting_date >= date_trunc('year', current_date))
      as visitantes,
    (select coalesce(sum(decisions_count), 0)::int
       from public.meeting_reports
       where meeting_date >= date_trunc('year', current_date))
      as decisoes,
    (select count(*)::int
       from public.life_groups
       where mother_cell_id is not null
         and founded_at >= date_trunc('year', current_date))
      as multiplicacoes,
    (select coalesce(sum(disc_ativos), 0)::int
       from public.meeting_reports
       where meeting_date >= date_trunc('year', current_date))
      as disc_ativos,
    (select coalesce(sum(cons_integrados), 0)::int
       from public.meeting_reports
       where meeting_date >= date_trunc('year', current_date))
      as integrados,
    (select count(*)::int
       from public.members
       where created_at >= date_trunc('year', current_date))
      as novos_membros,
    (select count(distinct life_group_id)::int
       from public.meeting_reports
       where meeting_date >= current_date - 30)
      as relatorios_enviados
)

select
  g.id,
  g.scope,
  g.scope_id,
  g.scope_name,
  g.year,
  g.month,
  g.indicator,
  g.target_value,
  g.notes,
  -- Realizado (nacional por enquanto; por church_id virá da monthly_consolidation)
  case g.indicator
    when 'membros_ativos'       then a.membros_ativos
    when 'lgs_ativos'           then a.lgs_ativos
    when 'visitantes'           then a.visitantes
    when 'decisoes'             then a.decisoes
    when 'multiplicacoes'       then a.multiplicacoes
    when 'disc_ativos'          then a.disc_ativos
    when 'integrados'           then a.integrados
    when 'novos_membros'        then a.novos_membros
    when 'relatorios_enviados'  then a.relatorios_enviados
    else 0
  end::numeric as actual_value,
  -- % atingido
  round(
    case g.indicator
      when 'membros_ativos'       then a.membros_ativos
      when 'lgs_ativos'           then a.lgs_ativos
      when 'visitantes'           then a.visitantes
      when 'decisoes'             then a.decisoes
      when 'multiplicacoes'       then a.multiplicacoes
      when 'disc_ativos'          then a.disc_ativos
      when 'integrados'           then a.integrados
      when 'novos_membros'        then a.novos_membros
      when 'relatorios_enviados'  then a.relatorios_enviados
      else 0
    end::numeric / nullif(g.target_value, 0) * 100, 1
  ) as pct_atingido,
  -- Status semáforo
  case
    when round(
      case g.indicator
        when 'membros_ativos'      then a.membros_ativos
        when 'lgs_ativos'          then a.lgs_ativos
        when 'visitantes'          then a.visitantes
        when 'decisoes'            then a.decisoes
        when 'multiplicacoes'      then a.multiplicacoes
        when 'disc_ativos'         then a.disc_ativos
        when 'integrados'          then a.integrados
        when 'novos_membros'       then a.novos_membros
        when 'relatorios_enviados' then a.relatorios_enviados
        else 0
      end::numeric / nullif(g.target_value, 0) * 100, 1
    ) >= 100 then 'atingido'
    when round(
      case g.indicator
        when 'membros_ativos'      then a.membros_ativos
        when 'lgs_ativos'          then a.lgs_ativos
        when 'visitantes'          then a.visitantes
        when 'decisoes'            then a.decisoes
        when 'multiplicacoes'      then a.multiplicacoes
        when 'disc_ativos'         then a.disc_ativos
        when 'integrados'          then a.integrados
        when 'novos_membros'       then a.novos_membros
        when 'relatorios_enviados' then a.relatorios_enviados
        else 0
      end::numeric / nullif(g.target_value, 0) * 100, 1
    ) >= 70 then 'no_caminho'
    else 'atencao'
  end as status_meta
from public.ministry_goals g
cross join actual a
where g.scope = 'nacional';

comment on view public.goals_vs_actual is 'Metas vs. realizado com % de atingimento e semáforo';

grant select on public.ministry_goals to authenticated;
grant insert, update, delete on public.ministry_goals to authenticated;
grant select on public.goals_vs_actual to authenticated;
