-- ============================================================
-- CEC FAMILY — Caderno 11-B: Classificação 🟢🟡🔴 nos níveis MDA
-- - Funções de saúde por LG, Setor, Área, Distrito, Igreja
-- - View consolidada de Dashboard hierárquico
-- Idempotente.
-- ============================================================

-- ---------- 1) Enum: classificação MDA (3 níveis) ----------
do $$ begin
  create type mda_status as enum ('saudavel', 'atencao', 'necessita');
exception when duplicate_object then null; end $$;

-- ---------- 2) Função: saúde do Life Group ----------
-- Critérios:
-- 1) Se o último relatório semanal tem saude_status preenchido pelo líder → usa esse
--    (muito_saudavel/saudavel → 🟢, atencao → 🟡, necessita_apoio → 🔴)
-- 2) Se NÃO há relatório nos últimos 21 dias → 🟡 (sem dados = sinal de atenção)
-- 3) Se nunca houve relatório → 🟡
-- 4) Se LG está com status_lg = 'encerrado' → 🟢 (encerrado é resultado conhecido, não problema)
create or replace function public.lg_health_score(p_lg_id uuid)
returns mda_status
language plpgsql stable security definer set search_path = public as $$
declare
  v_last_saude text;
  v_last_date  date;
  v_status_lg  text;
  v_days_since int;
begin
  -- Status do LG
  select status_lg::text into v_status_lg from public.life_groups where id = p_lg_id;

  if v_status_lg in ('encerrado', 'multiplicado') then
    return 'saudavel';
  end if;

  -- Último relatório do LG
  select saude_status::text, meeting_date
    into v_last_saude, v_last_date
    from public.meeting_reports
   where life_group_id = p_lg_id
   order by meeting_date desc
   limit 1;

  if v_last_date is null then
    return 'atencao';  -- Nunca houve relatório
  end if;

  v_days_since := current_date - v_last_date;
  if v_days_since > 21 then
    return 'atencao';  -- Sem relatório recente
  end if;

  -- Mapeia avaliação do líder
  if v_last_saude in ('muito_saudavel', 'saudavel') then
    return 'saudavel';
  elsif v_last_saude = 'atencao' then
    return 'atencao';
  elsif v_last_saude = 'necessita_apoio' then
    return 'necessita';
  end if;

  -- Sem avaliação no último relatório → assume saudável (relatórios em dia)
  return 'saudavel';
end; $$;

grant execute on function public.lg_health_score(uuid) to authenticated;

-- ---------- 3) Função auxiliar: agrega lista de status num único ----------
-- Regra: se algum filho é 🔴 → 🔴; senão se algum é 🟡 → 🟡; senão 🟢
create or replace function public.aggregate_mda_status(p_statuses mda_status[])
returns mda_status
language plpgsql immutable as $$
begin
  if array_length(p_statuses, 1) is null then
    return 'atencao';  -- Sem filhos = sem dados
  end if;
  if 'necessita' = any(p_statuses) then return 'necessita'; end if;
  if 'atencao'  = any(p_statuses) then return 'atencao';   end if;
  return 'saudavel';
end; $$;

grant execute on function public.aggregate_mda_status(mda_status[]) to authenticated;

-- ---------- 4) Função: saúde do Setor ----------
create or replace function public.sector_health_score(p_sector_id uuid)
returns mda_status
language plpgsql stable security definer set search_path = public as $$
declare
  v_statuses mda_status[];
begin
  select array_agg(public.lg_health_score(lg.id))
    into v_statuses
    from public.life_groups lg
   where lg.sector_id = p_sector_id and lg.is_active;

  return public.aggregate_mda_status(v_statuses);
end; $$;

grant execute on function public.sector_health_score(uuid) to authenticated;

-- ---------- 5) Função: saúde da Área ----------
create or replace function public.area_health_score(p_area_id uuid)
returns mda_status
language plpgsql stable security definer set search_path = public as $$
declare
  v_statuses mda_status[];
begin
  select array_agg(public.sector_health_score(s.id))
    into v_statuses
    from public.sectors s
   where s.area_id = p_area_id and s.is_active;

  return public.aggregate_mda_status(v_statuses);
end; $$;

grant execute on function public.area_health_score(uuid) to authenticated;

-- ---------- 6) Função: saúde do Distrito ----------
create or replace function public.district_health_score(p_district_id uuid)
returns mda_status
language plpgsql stable security definer set search_path = public as $$
declare
  v_statuses mda_status[];
begin
  select array_agg(public.area_health_score(a.id))
    into v_statuses
    from public.areas a
   where a.district_id = p_district_id and a.is_active;

  return public.aggregate_mda_status(v_statuses);
end; $$;

grant execute on function public.district_health_score(uuid) to authenticated;

-- ---------- 7) Função: saúde da Igreja (agrega seus distritos) ----------
create or replace function public.church_health_score(p_church_id uuid)
returns mda_status
language plpgsql stable security definer set search_path = public as $$
declare
  v_statuses mda_status[];
begin
  select array_agg(public.district_health_score(d.id))
    into v_statuses
    from public.districts d
   where d.church_id = p_church_id and d.is_active;

  return public.aggregate_mda_status(v_statuses);
end; $$;

grant execute on function public.church_health_score(uuid) to authenticated;

-- ---------- 8) View consolidada: dashboard MDA ----------
-- Retorna toda a árvore MDA com saúde calculada por nível.
create or replace view public.mda_health_dashboard as
select
  c.id as church_id, c.name as church_name, c.type as church_type, c.parent_id as church_parent_id,
  d.id as district_id, d.name as district_name,
  a.id as area_id, a.name as area_name,
  s.id as sector_id, s.name as sector_name,
  lg.id as lg_id, lg.name as lg_name, lg.status_lg::text as lg_status_lg,
  public.lg_health_score(lg.id) as lg_health,
  public.sector_health_score(s.id) as sector_health,
  public.area_health_score(a.id) as area_health,
  public.district_health_score(d.id) as district_health,
  public.church_health_score(c.id) as church_health,
  -- contagens úteis
  (select count(*)::int from public.members m where m.life_group_id = lg.id and m.status = 'ativo') as lg_members_count,
  (select max(meeting_date)::date from public.meeting_reports mr where mr.life_group_id = lg.id) as lg_last_report_date
from public.churches c
left join public.districts d on d.church_id = c.id and d.is_active
left join public.areas a on a.district_id = d.id and a.is_active
left join public.sectors s on s.area_id = a.id and s.is_active
left join public.life_groups lg on lg.sector_id = s.id and lg.is_active
where c.is_active;

comment on view public.mda_health_dashboard is 'Visão consolidada da árvore MDA com saúde 🟢🟡🔴 em cada nível';
