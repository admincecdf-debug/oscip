-- ============================================================
-- CEC FAMILY — MEO-001 (parte 2): corrige funções de saúde e a
-- view do dashboard para a nova direção da árvore territorial.
--
-- Antes:  Igreja → Distrito → Área → Setor → LG
-- Agora:  Estado → Núcleo → Distrito → Setor → Igreja Local → LG
--
-- sector_health_score fica igual (LGs já penduram direto no Setor).
-- church_health_score, district_health_score mudam de direção.
-- nucleo_health_score e state_health_score são novas.
-- area_health_score continua existindo, mas agora é genealogia
-- (Estrutura de Multiplicação), não caminho de posse obrigatório.
-- ============================================================

-- ---------- Igreja Local: agrega direto seus Life Groups ----------
create or replace function public.church_health_score(p_church_id uuid)
returns mda_status
language plpgsql stable security definer set search_path = public as $$
declare
  v_statuses mda_status[];
begin
  select array_agg(public.lg_health_score(lg.id))
    into v_statuses
    from public.life_groups lg
   where lg.church_id = p_church_id and lg.is_active;

  return public.aggregate_mda_status(v_statuses);
end; $$;
grant execute on function public.church_health_score(uuid) to authenticated;

-- ---------- Setor: agrega suas Igrejas Locais (via saúde de cada uma) ----------
-- Observação: sector_health_score antigo agregava direto os LGs do setor
-- (lg.sector_id). Mantemos isso — é equivalente e mais simples, já que
-- Igreja Local não introduz lógica de saúde própria além da soma dos LGs.
-- (função já existe corretamente, sem mudança necessária)

-- ---------- Distrito: agrega seus Setores ----------
create or replace function public.district_health_score(p_district_id uuid)
returns mda_status
language plpgsql stable security definer set search_path = public as $$
declare
  v_statuses mda_status[];
begin
  select array_agg(public.sector_health_score(s.id))
    into v_statuses
    from public.sectors s
   where s.district_id = p_district_id and s.is_active;

  return public.aggregate_mda_status(v_statuses);
end; $$;
grant execute on function public.district_health_score(uuid) to authenticated;

-- ---------- Núcleo: agrega seus Distritos (NOVO) ----------
create or replace function public.nucleo_health_score(p_nucleo_id uuid)
returns mda_status
language plpgsql stable security definer set search_path = public as $$
declare
  v_statuses mda_status[];
begin
  select array_agg(public.district_health_score(d.id))
    into v_statuses
    from public.districts d
   where d.nucleo_id = p_nucleo_id and d.is_active;

  return public.aggregate_mda_status(v_statuses);
end; $$;
grant execute on function public.nucleo_health_score(uuid) to authenticated;

-- ---------- Estado: agrega seus Núcleos (NOVO) ----------
create or replace function public.state_health_score(p_state_id uuid)
returns mda_status
language plpgsql stable security definer set search_path = public as $$
declare
  v_statuses mda_status[];
begin
  select array_agg(public.nucleo_health_score(n.id))
    into v_statuses
    from public.nucleos n
   where n.state_id = p_state_id and n.is_active;

  return public.aggregate_mda_status(v_statuses);
end; $$;
grant execute on function public.state_health_score(uuid) to authenticated;

-- ---------- View consolidada: agora na direção certa ----------
-- (drop primeiro porque o formato de colunas mudou — "create or replace"
-- só funciona quando as colunas existentes continuam nas mesmas posições)
drop view if exists public.mda_health_dashboard;
create view public.mda_health_dashboard as
select
  st.id as state_id, st.name as state_name,
  nu.id as nucleo_id, nu.name as nucleo_name,
  d.id as district_id, d.name as district_name,
  s.id as sector_id, s.name as sector_name,
  s.area_id as area_id, ar.name as area_name,          -- genealogia (opcional)
  c.id as church_id, c.name as church_name, c.type as church_type,
  lg.id as lg_id, lg.name as lg_name, lg.status_lg::text as lg_status_lg,
  public.lg_health_score(lg.id) as lg_health,
  public.sector_health_score(s.id) as sector_health,
  public.district_health_score(d.id) as district_health,
  public.nucleo_health_score(nu.id) as nucleo_health,
  public.state_health_score(st.id) as state_health,
  public.church_health_score(c.id) as church_health,
  (select count(*)::int from public.members m where m.life_group_id = lg.id and m.status = 'ativo') as lg_members_count,
  (select max(meeting_date)::date from public.meeting_reports mr where mr.life_group_id = lg.id) as lg_last_report_date
from public.states st
left join public.nucleos nu on nu.state_id = st.id and nu.is_active
left join public.districts d on d.nucleo_id = nu.id and d.is_active
left join public.sectors s on s.district_id = d.id and s.is_active
left join public.areas ar on ar.id = s.area_id
left join public.churches c on c.sector_id = s.id and c.is_active
left join public.life_groups lg on lg.church_id = c.id and lg.is_active
where st.is_active;

comment on view public.mda_health_dashboard is 'MEO-001: Estado→Núcleo→Distrito→Setor→Igreja Local→Life Group, com saúde 🟢🟡🔴 em cada nível.';
