-- ============================================================
-- RELMDA002 — Supervisão de Rede (Fase 2)
-- Especificação: RELMDA-001 §8 / RELMDA-003 §13-17
-- ============================================================
-- Cria:
--   - relmda_supervisor_overview(): visão semanal por Life Group,
--     já com status, números-chave e sinalização de inconsistência
--     (tudo calculado no servidor, respeitando o mesmo escopo do RLS)
--   - relmda_send_report(): corrige o fluxo rascunho/correção -> enviado/corrigido
--   - relmda_mark_in_analysis(): enviado -> em_análise (ao abrir no supervisor)
--   - relmda_request_correction(): solicita correção por item
--   - relmda_validate_report(): valida e fecha o ciclo de análise
-- Idempotente.
-- ============================================================

-- ---------- 1) Visão semanal do supervisor ----------
create or replace function public.relmda_supervisor_overview(
  p_week_number smallint, p_month smallint, p_year smallint
) returns table (
  life_group_id       uuid,
  life_group_name     text,
  leader_name         text,
  report_id           uuid,
  status              relmda_report_status,
  sent_at             timestamptz,
  total_members       int,
  mda_count           int,
  visitantes_count    int,
  ge_count            int,
  offering_total      numeric,
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
    r.id,
    coalesce(r.status, 'rascunho'::relmda_report_status),
    r.sent_at,
    (select count(*)::int from public.members m where m.life_group_id = lg.id and m.status = 'ativo'),
    coalesce(r.mda_count, 0),
    coalesce((select count(*)::int from public.relmda_visitors v where v.report_id = r.id), 0),
    coalesce(r.ge_count, 0),
    coalesce(r.offering_total, 0),
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

-- ---------- 2) Envio corrigido (rascunho->enviado / correção_solicitada->corrigido) ----------
create or replace function public.relmda_send_report(p_report_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status relmda_report_status;
begin
  select status into v_status from public.relmda_weekly_reports where id = p_report_id;
  if v_status is null then raise exception 'Relatório não encontrado'; end if;
  if v_status not in ('rascunho','correcao_solicitada') then
    raise exception 'Relatório não pode ser enviado no status atual (%).', v_status;
  end if;

  update public.relmda_weekly_reports
  set status  = case when v_status = 'correcao_solicitada' then 'corrigido' else 'enviado' end,
      sent_by = auth.uid(),
      sent_at = now()
  where id = p_report_id;
end;
$$;
grant execute on function public.relmda_send_report(uuid) to authenticated;

-- ---------- 3) Abrir para análise (enviado/corrigido -> em_análise) ----------
create or replace function public.relmda_mark_in_analysis(p_report_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.relmda_weekly_reports
  set status = 'em_analise'
  where id = p_report_id
    and status in ('enviado','corrigido')
    and (public.is_apostle() or public.relmda_lg_in_scope(life_group_id) or public.relmda_is_lg_responsible(life_group_id));
end;
$$;
grant execute on function public.relmda_mark_in_analysis(uuid) to authenticated;

-- ---------- 4) Solicitar correção ----------
create or replace function public.relmda_request_correction(
  p_report_id uuid, p_items text[], p_note text, p_deadline timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.relmda_weekly_reports
  set status              = 'correcao_solicitada',
      needs_correction    = true,
      correction_items    = p_items,
      supervisor_note     = coalesce(p_note, supervisor_note),
      correction_deadline = p_deadline
  where id = p_report_id
    and (public.is_apostle() or public.relmda_lg_in_scope(life_group_id) or public.relmda_is_lg_responsible(life_group_id));

  if not found then
    raise exception 'Relatório não encontrado ou sem permissão';
  end if;
end;
$$;
grant execute on function public.relmda_request_correction(uuid, text[], text, timestamptz) to authenticated;

-- ---------- 5) Validar relatório ----------
create or replace function public.relmda_validate_report(p_report_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.relmda_weekly_reports
  set status           = 'validado',
      validated_by     = auth.uid(),
      validated_at     = now(),
      supervisor_note  = coalesce(p_note, supervisor_note),
      needs_correction = false
  where id = p_report_id
    and (public.is_apostle() or public.relmda_lg_in_scope(life_group_id) or public.relmda_is_lg_responsible(life_group_id));

  if not found then
    raise exception 'Relatório não encontrado ou sem permissão';
  end if;
end;
$$;
grant execute on function public.relmda_validate_report(uuid, text) to authenticated;

-- ---------- 6) Salvar apenas a análise do supervisor (sem mudar status) ----------
create or replace function public.relmda_save_supervisor_note(
  p_report_id uuid, p_note text, p_needs_support boolean, p_support_type text
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.relmda_weekly_reports
  set supervisor_note = p_note,
      needs_support    = p_needs_support,
      support_type     = p_support_type
  where id = p_report_id
    and (public.is_apostle() or public.relmda_lg_in_scope(life_group_id) or public.relmda_is_lg_responsible(life_group_id));

  if not found then
    raise exception 'Relatório não encontrado ou sem permissão';
  end if;
end;
$$;
grant execute on function public.relmda_save_supervisor_note(uuid, text, boolean, text) to authenticated;
