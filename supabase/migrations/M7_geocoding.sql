-- ============================================================
-- CEC FAMILY — M7: LifeGroup Geointeligente (OpenStreetMap)
-- - Tabela: geocode_cache (cache de Nominatim)
-- - Função: haversine_distance_km (cálculo de distância)
-- - Update do M6: sugestão prefere distância real quando lat/lng existe
-- Idempotente.
-- ============================================================

-- ---------- 1) Cache de geocoding ----------
-- Evita bater na Nominatim toda vez (rate limit 1 req/s + ToS exige cache)
create table if not exists public.geocode_cache (
  id          uuid primary key default gen_random_uuid(),
  query       text not null,            -- endereço ou CEP normalizado
  query_hash  text not null,            -- hash do query (busca rápida)
  latitude    double precision,
  longitude   double precision,
  display_name text,                    -- "Rua X, 123, Bairro, Cidade - UF"
  source      text default 'nominatim',
  found       boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists ux_geocode_hash on public.geocode_cache(query_hash);
create index if not exists idx_geocode_query on public.geocode_cache(query);

-- RLS: leitura aberta (não tem dado sensível), escrita só pelo backend
alter table public.geocode_cache enable row level security;

drop policy if exists geocode_read on public.geocode_cache;
create policy geocode_read on public.geocode_cache for select to authenticated using (true);

drop policy if exists geocode_write on public.geocode_cache;
create policy geocode_write on public.geocode_cache for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- 2) Função: distância Haversine em km ----------
create or replace function public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable parallel safe as $$
  select 6371.0 * 2 * asin(sqrt(
    pow(sin(radians((lat2 - lat1) / 2)), 2)
    + cos(radians(lat1)) * cos(radians(lat2))
      * pow(sin(radians((lng2 - lng1) / 2)), 2)
  ));
$$;

-- ---------- 3) Update do M6: matching com geo + textual ----------
-- Se LG tiver lat/lng E visitante tiver lat/lng → score por distância
-- Caso contrário → fallback no textual (cidade/estado)
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
  v_cep text;
  v_lat double precision;
  v_lng double precision;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select community_id, state, city, cep
    into v_community, v_state, v_city, v_cep
  from public.visitor_pipeline where id = p_pipeline_id;

  if v_community is null then
    return;
  end if;

  -- Tenta lat/lng do CEP do visitante via cache
  if v_cep is not null then
    select latitude, longitude into v_lat, v_lng
    from public.geocode_cache
    where query = v_cep and found
    limit 1;
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
      lg.latitude as lg_lat,
      lg.longitude as lg_lng,
      coalesce(lg.multiplication_target, 12) as target,
      (
        select count(*)::int from public.members m
        where m.life_group_id = lg.id and m.status = 'ativo'
      ) as members_count,
      -- Distância em km (se ambos têm lat/lng)
      case
        when lg.latitude is not null and lg.longitude is not null
         and v_lat is not null and v_lng is not null
        then public.haversine_km(lg.latitude, lg.longitude, v_lat, v_lng)
        else null
      end as distance_km
    from public.life_groups lg
    where lg.is_active and lg.church_id = v_community
  ),
  scored as (
    select
      s.id,
      s.name,
      s.members_count,
      s.target,
      s.distance_km,
      -- Score base
      (
        30 +  -- mesma comunidade (sempre)
        case
          -- GEO: prioridade máxima quando temos distância real
          when s.distance_km is not null and s.distance_km <= 2  then 80  -- ≤ 2km: muito perto
          when s.distance_km is not null and s.distance_km <= 5  then 65  -- 5km
          when s.distance_km is not null and s.distance_km <= 10 then 50  -- 10km
          when s.distance_km is not null and s.distance_km <= 20 then 35  -- 20km
          when s.distance_km is not null                         then 15  -- > 20km
          -- TEXTUAL: fallback se não tem geo
          when v_city is not null and lower(s.lg_city) = lower(v_city) then 50
          when v_state is not null and upper(s.lg_state) = upper(v_state) then 20
          else 0
        end
      ) as raw_score,
      -- Fator de balanceamento (penaliza LG cheio)
      case
        when s.members_count >= s.target * 1.2 then 0.50
        when s.members_count >= s.target * 1.0 then 0.75
        when s.members_count >= s.target * 0.8 then 0.90
        else 1.00
      end as balance_factor,
      -- Razão textual com distância quando disponível
      concat_ws(' · ',
        case
          when s.distance_km is not null
          then 'A ' || round(s.distance_km::numeric, 1) || ' km'
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

-- ---------- 4) View pública: LGs com coordenadas (para mapa) ----------
-- Lista LGs ativos com lat/lng pra renderizar no mapa público
create or replace view public.public_cells_with_geo as
select
  lg.id, lg.name, lg.neighborhood, lg.city, lg.state, lg.address,
  lg.latitude, lg.longitude,
  lg.meeting_weekday, lg.meeting_time,
  lg.church_id, lg.target_audience
from public.life_groups lg
where lg.is_active
  and lg.latitude is not null
  and lg.longitude is not null;
