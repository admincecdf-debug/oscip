-- ============================================================
-- CEC FAMILY — UX-003 Cap. 3 Parte 3: indicadores de Ministérios
-- e Eventos pro Dashboard Executivo.
-- ============================================================

create or replace function public.dashboard_ministerios_eventos_scoped(p_church_id uuid default null)
returns table (
  total_ministerios int,
  total_integrantes int,
  eventos_futuros int,
  eventos_realizados_30d int,
  total_inscricoes_30d int
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.ministries m
       where (p_church_id is not null and m.church_id = p_church_id)
          or (p_church_id is null and m.church_id in (select public.accessible_church_ids()))),
    (select count(*)::int from public.ministry_members mm
       join public.ministries m on m.id = mm.ministry_id
       where (p_church_id is not null and m.church_id = p_church_id)
          or (p_church_id is null and m.church_id in (select public.accessible_church_ids()))),
    (select count(*)::int from public.events e
       where e.starts_at > now() and e.is_published
         and ((p_church_id is not null and e.church_id = p_church_id)
              or (p_church_id is null and (e.church_id is null or e.church_id in (select public.accessible_church_ids()))))),
    (select count(*)::int from public.events e
       where e.starts_at <= now() and e.starts_at > now() - interval '30 days'
         and ((p_church_id is not null and e.church_id = p_church_id)
              or (p_church_id is null and (e.church_id is null or e.church_id in (select public.accessible_church_ids()))))),
    (select count(*)::int from public.event_registrations er
       join public.events e on e.id = er.event_id
       where er.registered_at > now() - interval '30 days'
         and ((p_church_id is not null and e.church_id = p_church_id)
              or (p_church_id is null and (e.church_id is null or e.church_id in (select public.accessible_church_ids())))));
$$;
grant execute on function public.dashboard_ministerios_eventos_scoped(uuid) to authenticated;

-- ============================================================
-- Ranking de ministérios por número de integrantes (top 8)
-- ============================================================
create or replace function public.dashboard_ministerios_ranking(p_church_id uuid default null)
returns table (nome text, integrantes int)
language sql stable security definer set search_path = public as $$
  select m.name, count(mm.id)::int
  from public.ministries m
  left join public.ministry_members mm on mm.ministry_id = m.id
  where (p_church_id is not null and m.church_id = p_church_id)
     or (p_church_id is null and m.church_id in (select public.accessible_church_ids()))
  group by m.id, m.name
  order by count(mm.id) desc
  limit 8;
$$;
grant execute on function public.dashboard_ministerios_ranking(uuid) to authenticated;
