-- ============================================================
-- CEC FAMILY — Engajamento: evasão, multiplicação, badges de LG
-- - View: members_at_risk_evasion
-- - life_groups.multiplication_target (campo configurável)
-- - Function: get_lg_badges(life_group_id)
-- Idempotente.
-- ============================================================

-- ---------- 1) Meta de multiplicação no LG ----------
alter table public.life_groups
  add column if not exists multiplication_target integer not null default 12;

comment on column public.life_groups.multiplication_target is
  'Número de membros ativos para multiplicar o LG. Default = 12.';

-- ---------- 2) View: membros em risco de evasão ----------
-- Critério: membro ativo cujo último relatório com presença=true foi há 3 ou mais relatórios atrás
-- (incluindo o caso de NUNCA ter aparecido).
create or replace view public.members_at_risk_evasion as
with last_3_reports_per_lg as (
  -- Pega os IDs dos últimos 3 relatórios de cada LG
  select id, life_group_id, meeting_date,
         row_number() over (partition by life_group_id order by meeting_date desc) as rn
  from public.meeting_reports
),
recent_3 as (
  select id, life_group_id from last_3_reports_per_lg where rn <= 3
),
member_presence_recent as (
  -- Para cada membro ativo, conta quantos dos últimos 3 relatórios do LG ele esteve presente
  select
    m.id as member_id,
    m.full_name,
    m.life_group_id,
    m.church_id,
    m.phone,
    m.email,
    (
      select count(*)
      from recent_3 r3
      left join public.report_attendance ra
        on ra.report_id = r3.id and ra.member_id = m.id and ra.present = true
      where r3.life_group_id = m.life_group_id and ra.id is not null
    ) as presences_in_last_3,
    (
      select count(*) from recent_3 r3 where r3.life_group_id = m.life_group_id
    ) as reports_count,
    (
      select max(r.meeting_date)
      from public.report_attendance ra
      join public.meeting_reports r on r.id = ra.report_id
      where ra.member_id = m.id and ra.present = true
    ) as last_seen_at
  from public.members m
  where m.status = 'ativo' and m.life_group_id is not null
)
select *
from member_presence_recent
where reports_count >= 3
  and presences_in_last_3 = 0;

comment on view public.members_at_risk_evasion is
  'Membros ativos sem presença nos últimos 3 relatórios consecutivos do seu LG.';

-- ---------- 3) Função: badges conquistados por um LG ----------
-- Retorna lista textual de badges baseados em condições objetivas.
-- Cada badge tem: key (id), label (display), icon (lucide ref), description.
create or replace function public.get_lg_badges(p_lg_id uuid)
returns table(
  key text,
  label text,
  description text,
  icon text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_active_members      int;
  v_target              int;
  v_prayer_last_30      int;
  v_new_converts_90d    int;
  v_consecutive_reports int;
begin
  -- 1) Contagem de membros ativos
  select count(*) into v_active_members
  from public.members m
  where m.life_group_id = p_lg_id and m.status = 'ativo';

  -- 2) Meta de multiplicação
  select coalesce(multiplication_target, 12) into v_target
  from public.life_groups where id = p_lg_id;

  -- 3) Pedidos de oração nos últimos 30 dias (do membros do LG)
  select count(*) into v_prayer_last_30
  from public.prayer_requests pr
  join public.members m on m.id = pr.member_id
  where m.life_group_id = p_lg_id
    and pr.created_at >= now() - interval '30 days';

  -- 4) Novos convertidos nos últimos 90 dias (membros do LG marcados como novo_convertido)
  select count(*) into v_new_converts_90d
  from public.members m
  where m.life_group_id = p_lg_id
    and m.journey_stage = 'novo_convertido'
    and m.created_at >= now() - interval '90 days';

  -- 5) Relatórios consecutivos (últimos N)
  select count(*) into v_consecutive_reports
  from public.meeting_reports
  where life_group_id = p_lg_id
    and meeting_date >= now() - interval '90 days';

  -- Badges
  -- A: Casa Cheia — 10+ membros ativos
  if v_active_members >= 10 then
    return query select 'casa_cheia'::text, 'Casa Cheia'::text,
      ('Mais de 10 membros ativos (' || v_active_members || ')')::text,
      'home'::text;
  end if;

  -- B: Pronto para Multiplicar — atingiu ou passou da meta
  if v_active_members >= v_target then
    return query select 'multiplicar'::text, 'Pronto para Multiplicar'::text,
      ('Atingiu a meta de ' || v_target || ' membros ativos')::text,
      'split'::text;
  end if;

  -- C: Casa de Oração — 5+ pedidos no último mês
  if v_prayer_last_30 >= 5 then
    return query select 'casa_oracao'::text, 'Casa de Oração'::text,
      (v_prayer_last_30 || ' pedidos de oração nos últimos 30 dias')::text,
      'praying-hands'::text;
  end if;

  -- D: Acolhedor — 3+ novos convertidos em 90 dias
  if v_new_converts_90d >= 3 then
    return query select 'acolhedor'::text, 'Acolhedor'::text,
      (v_new_converts_90d || ' novos convertidos nos últimos 90 dias')::text,
      'heart'::text;
  end if;

  -- E: Constância — 12+ relatórios em 90 dias (semanal)
  if v_consecutive_reports >= 12 then
    return query select 'constancia'::text, 'Constância'::text,
      ('Reuniões semanais regulares — ' || v_consecutive_reports || ' encontros em 90 dias')::text,
      'calendar-check'::text;
  end if;

  return;
end; $$;

grant execute on function public.get_lg_badges(uuid) to authenticated;

-- ---------- 4) Função: progresso de multiplicação ----------
create or replace function public.get_lg_multiplication_progress(p_lg_id uuid)
returns table(
  current_count int,
  target int,
  percent int
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.members where life_group_id = p_lg_id and status = 'ativo') as current_count,
    coalesce((select multiplication_target from public.life_groups where id = p_lg_id), 12) as target,
    least(
      100,
      (
        (select count(*)::int from public.members where life_group_id = p_lg_id and status = 'ativo') * 100
        / nullif(coalesce((select multiplication_target from public.life_groups where id = p_lg_id), 12), 0)
      )
    ) as percent;
$$;

grant execute on function public.get_lg_multiplication_progress(uuid) to authenticated;
