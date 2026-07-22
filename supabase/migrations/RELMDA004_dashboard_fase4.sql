-- ============================================================
-- RELMDA004 — Dashboard e Comparativo Mensal (Fase 4)
-- Especificação: RELMDA-001 §12-13
-- ============================================================
-- relmda_monthly_comparison(): totais agregados por semana (1-5)
-- dentro do escopo do usuário, pra montar os gráficos comparativos
-- do mês sem precisar de 5 chamadas separadas.
-- Idempotente.
-- ============================================================

create or replace function public.relmda_monthly_comparison(p_month smallint, p_year smallint)
returns table (
  week_number      int,
  life_groups      int,
  total_members    int,
  mda_count        int,
  ge_count         int,
  visitantes_count int,
  offering_total   numeric,
  kg_amor          numeric,
  tadel_count      int,
  emp_participants int,
  enviados         int,
  esperados        int
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  select
    w.week_number,
    count(distinct lg.id)::int,
    coalesce(sum((select count(*) from public.members m where m.life_group_id = lg.id and m.status = 'ativo')), 0)::int,
    coalesce(sum(r.mda_count), 0)::int,
    coalesce(sum(r.ge_count), 0)::int,
    coalesce(sum((select count(*) from public.relmda_visitors v where v.report_id = r.id)), 0)::int,
    coalesce(sum(r.offering_total), 0),
    coalesce(sum(r.kg_amor), 0),
    coalesce(sum(r.tadel_count), 0)::int,
    coalesce(sum(r.emp_participants), 0)::int,
    count(*) filter (where r.id is not null and r.status <> 'rascunho')::int,
    count(*)::int
  from generate_series(1, 5) as w(week_number)
  cross join public.life_groups lg
  left join public.relmda_weekly_reports r
    on r.life_group_id = lg.id and r.week_number = w.week_number and r.month = p_month and r.year = p_year
  where lg.is_active
    and (
      public.is_apostle()
      or lg.church_id in (select public.accessible_church_ids())
      or lg.supervisor_id = auth.uid()
      or lg.leader_id = auth.uid() or lg.coleader_id = auth.uid()
    )
  group by w.week_number
  order by w.week_number;
end;
$$;
grant execute on function public.relmda_monthly_comparison(smallint, smallint) to authenticated;
