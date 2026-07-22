-- ============================================================
-- CEC FAMILY — M6: Distribuição automática de Life Group
-- - Campo target_audience em life_groups (Supervisor de Área decide)
-- - Campos de sugestão em visitor_pipeline
-- - RPC suggest_life_group(p_pipeline_id) com matching textual + balanceamento
-- Idempotente.
-- ============================================================

-- ---------- 1) Enum: público-alvo do LG ----------
do $$ begin
  create type lg_target_audience as enum (
    'misto', 'jovens', 'adolescentes', 'adultos', 'casais',
    'terceira_idade', 'mulheres', 'homens', 'outro'
  );
exception when duplicate_object then null; end $$;

alter table public.life_groups
  add column if not exists target_audience lg_target_audience default 'misto';

-- ---------- 2) Campos de sugestão em visitor_pipeline ----------
alter table public.visitor_pipeline
  add column if not exists suggested_lg_id uuid references public.life_groups(id) on delete set null,
  add column if not exists suggestion_score numeric(5,2),
  add column if not exists suggestion_reason text,
  add column if not exists suggestion_calculated_at timestamptz;

create index if not exists idx_vp_suggested_lg on public.visitor_pipeline(suggested_lg_id);

-- ---------- 3) RPC: calcula top 3 sugestões para um visitante ----------
-- Score:
--   - Mesma cidade do visitante:        +50
--   - Mesmo estado (sem cidade igual):  +20
--   - Mesma comunidade (sempre):        +30 (base)
-- Penalidade por LG cheio:
--   - members_count >= target * 1.2  → score *= 0.50  (transbordando, prioridade baixíssima)
--   - members_count >= target * 1.0  → score *= 0.75  (pronto pra multiplicar, evitar engordar)
--   - members_count >= target * 0.8  → score *= 0.90  (quase lá)
--   - members_count <  target * 0.8  → score *= 1.00  (saudável, prefere)
create or replace function public.suggest_life_groups_for_pipeline(p_pipeline_id uuid)
returns table (
  lg_id uuid,
  lg_name text,
  raw_score numeric,
  adjusted_score numeric,
  members_count int,
  target int,
  reason text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_community uuid;
  v_state text;
  v_city text;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select community_id, state, city
    into v_community, v_state, v_city
  from public.visitor_pipeline where id = p_pipeline_id;

  if v_community is null then
    return;
  end if;

  return query
  with lg_stats as (
    select
      lg.id,
      lg.name,
      lg.neighborhood,
      lg.city as lg_city,
      lg.state as lg_state,
      lg.target_audience,
      lg.meeting_weekday,
      lg.meeting_time,
      coalesce(lg.multiplication_target, 12) as target,
      (
        select count(*)::int from public.members m
        where m.life_group_id = lg.id and m.status = 'ativo'
      ) as members_count
    from public.life_groups lg
    where lg.is_active and lg.church_id = v_community
  ),
  scored as (
    select
      s.id,
      s.name,
      s.members_count,
      s.target,
      -- Score base
      (
        30 +  -- mesma comunidade
        case when v_city  is not null and lower(s.lg_city)  = lower(v_city)  then 50 else 0 end +
        case when v_state is not null and upper(s.lg_state) = upper(v_state) and (v_city is null or lower(s.lg_city) <> lower(v_city)) then 20 else 0 end
      ) as raw_score,
      -- Fator de balanceamento
      case
        when s.members_count >= s.target * 1.2 then 0.50
        when s.members_count >= s.target * 1.0 then 0.75
        when s.members_count >= s.target * 0.8 then 0.90
        else 1.00
      end as balance_factor,
      -- Motivo textual
      concat_ws(' · ',
        case
          when v_city is not null and lower(s.lg_city) = lower(v_city) then 'Mesma cidade'
          when v_state is not null and upper(s.lg_state) = upper(v_state) then 'Mesmo estado'
          else null
        end,
        case when s.neighborhood is not null then 'Bairro: ' || s.neighborhood else null end,
        s.members_count || ' membros',
        case when s.meeting_weekday is not null and s.meeting_time is not null
             then initcap(s.meeting_weekday::text) || ' às ' || to_char(s.meeting_time, 'HH24:MI')
             else null end,
        'Público: ' || coalesce(s.target_audience::text, 'misto')
      ) as reason
    from lg_stats s
  )
  select
    sc.id as lg_id,
    sc.name as lg_name,
    sc.raw_score,
    round(sc.raw_score * sc.balance_factor, 2) as adjusted_score,
    sc.members_count,
    sc.target,
    sc.reason
  from scored sc
  order by adjusted_score desc, sc.members_count asc
  limit 3;
end; $$;

grant execute on function public.suggest_life_groups_for_pipeline(uuid) to authenticated;

-- ---------- 4) RPC: aceitar uma sugestão e atribuir LG ----------
create or replace function public.pipeline_accept_lg_suggestion(
  p_pipeline_id uuid,
  p_lg_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  update public.visitor_pipeline
     set life_group_id = p_lg_id,
         suggested_lg_id = p_lg_id,
         suggestion_calculated_at = now()
   where id = p_pipeline_id;

  return p_pipeline_id;
end; $$;

grant execute on function public.pipeline_accept_lg_suggestion(uuid, uuid) to authenticated;

-- ---------- 5) RPC: calcula e grava a melhor sugestão automática ----------
-- Útil pra disparar batch (ex: ao final do wizard, ou um cron diário)
create or replace function public.compute_top_suggestion_for_pipeline(p_pipeline_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_top_lg uuid;
  v_top_score numeric;
  v_top_reason text;
begin
  select lg_id, adjusted_score, reason
    into v_top_lg, v_top_score, v_top_reason
  from public.suggest_life_groups_for_pipeline(p_pipeline_id)
  order by adjusted_score desc
  limit 1;

  if v_top_lg is not null then
    update public.visitor_pipeline
       set suggested_lg_id = v_top_lg,
           suggestion_score = v_top_score,
           suggestion_reason = v_top_reason,
           suggestion_calculated_at = now()
     where id = p_pipeline_id;
  end if;

  return v_top_lg;
end; $$;

grant execute on function public.compute_top_suggestion_for_pipeline(uuid) to authenticated;
