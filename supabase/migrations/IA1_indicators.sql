-- ============================================================
-- CEC FAMILY — Classificação 🟢🟡🔴 e Dashboard Hierárquico
-- (Fecha Caderno 11-B itens 18 e 19, sem dependência de IA)
-- ============================================================

do $$ begin
  create type mda_health as enum ('saudavel', 'atencao', 'necessita_intervencao');
exception when duplicate_object then null; end $$;

-- ---------- Função-base: métricas de um conjunto de LGs ----------
create or replace function public.lg_set_metrics(p_lg_ids uuid[])
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_total int; v_active int; v_reported_30d int; v_with_leader int;
  v_multiplicando int; v_multiplicado int; v_in_formation int;
  v_members int; v_visitors_30d int; v_decisions_30d int;
  v_evasion_count int; v_health_score int;
begin
  if array_length(p_lg_ids, 1) is null then
    return jsonb_build_object('total_lgs', 0, 'active_lgs', 0, 'health_class', 'necessita_intervencao', 'health_score', 0);
  end if;

  select count(*) into v_total from public.life_groups where id = any(p_lg_ids);
  select count(*) into v_active from public.life_groups
    where id = any(p_lg_ids) and is_active and coalesce(status_lg::text,'ativo') <> 'encerrado';
  select count(*) into v_with_leader from public.life_groups where id = any(p_lg_ids) and leader_id is not null;
  select count(*) into v_multiplicando from public.life_groups where id = any(p_lg_ids) and status_lg::text = 'em_multiplicacao';
  select count(*) into v_multiplicado from public.life_groups where id = any(p_lg_ids) and status_lg::text = 'multiplicado';
  select count(*) into v_in_formation from public.life_groups where id = any(p_lg_ids) and status_lg::text = 'em_formacao';

  select count(distinct life_group_id) into v_reported_30d
    from public.meeting_reports
    where life_group_id = any(p_lg_ids) and meeting_date >= current_date - 30;

  select count(*) into v_members from public.members
    where life_group_id = any(p_lg_ids) and status = 'ativo';

  select coalesce(sum(visitors_count), 0), coalesce(sum(decisions_count), 0)
    into v_visitors_30d, v_decisions_30d
    from public.meeting_reports
    where life_group_id = any(p_lg_ids) and meeting_date >= current_date - 30;

  select count(*) into v_evasion_count
    from public.members_at_risk_evasion
    where life_group_id = any(p_lg_ids);

  if v_active = 0 then
    v_health_score := 0;
  else
    v_health_score :=
      (v_reported_30d::numeric / nullif(v_active, 0) * 50)::int +
      (v_with_leader::numeric  / nullif(v_active, 0) * 30)::int +
      coalesce((greatest(0, 1 - (v_evasion_count::numeric / nullif(v_members, 0))) * 20)::int, 20);
  end if;

  return jsonb_build_object(
    'total_lgs', v_total,
    'active_lgs', v_active,
    'reported_30d', v_reported_30d,
    'with_leader', v_with_leader,
    'multiplicando', v_multiplicando,
    'multiplicado', v_multiplicado,
    'in_formation', v_in_formation,
    'members', v_members,
    'visitors_30d', v_visitors_30d,
    'decisions_30d', v_decisions_30d,
    'evasion_count', v_evasion_count,
    'reporting_rate', case when v_active = 0 then 0 else round(v_reported_30d::numeric / v_active * 100, 1) end,
    'leader_coverage', case when v_active = 0 then 0 else round(v_with_leader::numeric  / v_active * 100, 1) end,
    'health_score', v_health_score,
    'health_class', case
      when v_active = 0 then 'necessita_intervencao'
      when v_health_score >= 75 then 'saudavel'
      when v_health_score >= 50 then 'atencao'
      else 'necessita_intervencao'
    end
  );
end; $$;
grant execute on function public.lg_set_metrics(uuid[]) to authenticated;

-- ---------- Métricas por nível MDA ----------
create or replace function public.sector_metrics(p_sector_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.lg_set_metrics(array(select id from public.life_groups where sector_id = p_sector_id));
$$;
grant execute on function public.sector_metrics(uuid) to authenticated;

create or replace function public.area_metrics(p_area_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.lg_set_metrics(array(
    select lg.id from public.life_groups lg
    join public.sectors s on s.id = lg.sector_id
    where s.area_id = p_area_id));
$$;
grant execute on function public.area_metrics(uuid) to authenticated;

create or replace function public.district_metrics(p_district_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.lg_set_metrics(array(
    select lg.id from public.life_groups lg
    join public.sectors s on s.id = lg.sector_id
    join public.areas a   on a.id = s.area_id
    where a.district_id = p_district_id));
$$;
grant execute on function public.district_metrics(uuid) to authenticated;

create or replace function public.church_metrics(p_church_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.lg_set_metrics(array(select id from public.life_groups where church_id = p_church_id));
$$;
grant execute on function public.church_metrics(uuid) to authenticated;

create or replace function public.church_tree_metrics(p_church_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with recursive descendants as (
    select id from public.churches where id = p_church_id
    union all
    select c.id from public.churches c
    inner join descendants d on c.parent_id = d.id
  )
  select public.lg_set_metrics(array(
    select id from public.life_groups where church_id in (select id from descendants)));
$$;
grant execute on function public.church_tree_metrics(uuid) to authenticated;

create or replace function public.national_metrics()
returns jsonb language sql stable security definer set search_path = public as $$
  select public.lg_set_metrics(array(select id from public.life_groups));
$$;
grant execute on function public.national_metrics() to authenticated;

-- ---------- Lista de LGs com classificação ----------
create or replace function public.lgs_with_health(p_church_id uuid default null)
returns table (
  lg_id uuid, lg_name text, church_id uuid, status_lg text,
  members_count int, last_report_date date, evasion_count int, health_class text
)
language plpgsql stable security definer set search_path = public as $$
declare v_lg_ids uuid[];
begin
  if p_church_id is null then
    v_lg_ids := array(select id from public.life_groups);
  else
    with recursive descendants as (
      select id from public.churches where id = p_church_id
      union all
      select c.id from public.churches c
      inner join descendants d on c.parent_id = d.id
    )
    select array(select id from public.life_groups where church_id in (select id from descendants))
    into v_lg_ids;
  end if;

  return query
  select
    lg.id, lg.name, lg.church_id, coalesce(lg.status_lg::text, 'ativo'),
    (select count(*)::int from public.members where life_group_id = lg.id and status = 'ativo'),
    (select max(meeting_date) from public.meeting_reports where life_group_id = lg.id),
    (select count(*)::int from public.members_at_risk_evasion where life_group_id = lg.id),
    (public.lg_set_metrics(array[lg.id])->>'health_class')::text
  from public.life_groups lg
  where lg.id = any(v_lg_ids);
end; $$;
grant execute on function public.lgs_with_health(uuid) to authenticated;
