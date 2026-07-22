-- ============================================================
-- RELMDA003 — Consolidação por Setor/Rede com drill-down (Fase 3)
-- Especificação: RELMDA-001 §10-11 / RELMDA-003 §19
-- ============================================================
-- Estende relmda_supervisor_overview() com church_id/church_name,
-- para permitir agrupar os mesmos dados por Setor no cliente sem
-- precisar de uma segunda função/consulta.
-- Idempotente (create or replace substitui a versão da RELMDA002).
-- ============================================================

drop function if exists public.relmda_supervisor_overview(smallint, smallint, smallint);

create function public.relmda_supervisor_overview(
  p_week_number smallint, p_month smallint, p_year smallint
) returns table (
  life_group_id       uuid,
  life_group_name     text,
  leader_name         text,
  church_id           uuid,
  church_name         text,
  report_id           uuid,
  status              relmda_report_status,
  sent_at             timestamptz,
  total_members       int,
  mda_count           int,
  visitantes_count    int,
  ge_count            int,
  offering_total      numeric,
  kg_amor             numeric,
  tadel_count         int,
  emp_participants    int,
  needs_correction    boolean,
  correction_deadline timestamptz,
  is_inconsistent     boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  select
    lg.id,
    lg.name,
    p.full_name,
    lg.church_id,
    ch.name,
    r.id,
    coalesce(r.status, 'rascunho'::relmda_report_status),
    r.sent_at,
    (select count(*)::int from public.members m where m.life_group_id = lg.id and m.status = 'ativo'),
    coalesce(r.mda_count, 0),
    coalesce((select count(*)::int from public.relmda_visitors v where v.report_id = r.id), 0),
    coalesce(r.ge_count, 0),
    coalesce(r.offering_total, 0),
    coalesce(r.kg_amor, 0),
    coalesce(r.tadel_count, 0),
    coalesce(r.emp_participants, 0),
    coalesce(r.needs_correction, false),
    r.correction_deadline,
    coalesce(
      (
        (select count(*) from public.relmda_attendance a where a.report_id = r.id and a.present)
          > (select count(*) from public.members m2 where m2.life_group_id = lg.id and m2.status = 'ativo')
      )
      or (r.happened = false and r.offering_total > 0)
      or (r.id is not null and r.mda_count > greatest(1, (select count(*) from public.members m3 where m3.life_group_id = lg.id and m3.status = 'ativo')) * 3)
    , false)
  from public.life_groups lg
  left join public.churches ch on ch.id = lg.church_id
  left join public.profiles p on p.id = lg.leader_id
  left join public.relmda_weekly_reports r
    on r.life_group_id = lg.id and r.week_number = p_week_number and r.month = p_month and r.year = p_year
  where lg.is_active
    and (
      public.is_apostle()
      or lg.church_id in (select public.accessible_church_ids())
      or lg.supervisor_id = auth.uid()
      or lg.leader_id = auth.uid() or lg.coleader_id = auth.uid()
    )
  order by lg.name;
end;
$$;
grant execute on function public.relmda_supervisor_overview(smallint, smallint, smallint) to authenticated;
