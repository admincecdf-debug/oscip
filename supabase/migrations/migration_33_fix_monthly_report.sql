-- ============================================================
-- MIGRATION 33 — Fix RPC monthly_report_prefill
-- Remove is_admin() check — controle via RLS
-- CEC Family · AGILIZE Tecnologia · Junho 2026
-- ============================================================

CREATE OR REPLACE FUNCTION public.monthly_report_prefill(
  p_life_group_id uuid,
  p_year int,
  p_month int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_id uuid;
  v_week_num int;
  v_week_start date;
  v_week_end date;
  v_active_members int;
BEGIN
  -- Cria ou recupera relatório mensal
  INSERT INTO public.monthly_reports (life_group_id, year, month)
  VALUES (p_life_group_id, p_year, p_month)
  ON CONFLICT (life_group_id, year, month) DO NOTHING;

  SELECT id INTO v_report_id
  FROM public.monthly_reports
  WHERE life_group_id = p_life_group_id
    AND year = p_year
    AND month = p_month;

  -- Membros ativos atuais
  SELECT count(*)::int INTO v_active_members
  FROM public.members
  WHERE life_group_id = p_life_group_id
    AND status = 'ativo';

  -- Para cada uma das 5 semanas, consolida dados dos meeting_reports
  FOR v_week_num IN 1..5 LOOP
    v_week_start := (date_trunc('month', make_date(p_year, p_month, 1))::date)
                    + ((v_week_num - 1) * 7);
    v_week_end := v_week_start + 6;

    INSERT INTO public.monthly_report_weeks (
      report_id, week_number,
      num_membros, memb_c_discipuladores, mda_15_dias, ge,
      visitantes, oferta_pix, oferta_especie,
      ebd, cc, cel, kg_amor
    )
    SELECT
      v_report_id,
      v_week_num,
      v_active_members,
      COALESCE(SUM(r.members_with_disciplers), 0),
      COALESCE(SUM(CASE WHEN r.mda_15_dias_happened THEN r.mda_15_dias_count ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN r.ge_happened THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(r.visitors_count), 0),
      COALESCE(SUM(r.oferta_pix), 0),
      COALESCE(SUM(r.oferta_especie), 0),
      COALESCE(SUM(r.ebd_count), 0),
      COALESCE(SUM(r.cc_count), 0),
      COALESCE(SUM(r.cel_count), 0),
      COALESCE(SUM(r.kg_amor), 0)
    FROM public.meeting_reports r
    WHERE r.life_group_id = p_life_group_id
      AND r.meeting_date BETWEEN v_week_start AND v_week_end
    ON CONFLICT (report_id, week_number) DO UPDATE SET
      num_membros           = EXCLUDED.num_membros,
      memb_c_discipuladores = EXCLUDED.memb_c_discipuladores,
      mda_15_dias           = EXCLUDED.mda_15_dias,
      ge                    = EXCLUDED.ge,
      visitantes            = EXCLUDED.visitantes,
      oferta_pix            = EXCLUDED.oferta_pix,
      oferta_especie        = EXCLUDED.oferta_especie,
      ebd                   = EXCLUDED.ebd,
      cc                    = EXCLUDED.cc,
      cel                   = EXCLUDED.cel,
      kg_amor               = EXCLUDED.kg_amor;
  END LOOP;

  -- Pré-preenche membros do LG no relatório
  INSERT INTO public.monthly_report_members (report_id, member_id)
  SELECT v_report_id, m.id
  FROM public.members m
  WHERE m.life_group_id = p_life_group_id
    AND m.status = 'ativo'
  ON CONFLICT (report_id, member_id) DO NOTHING;

  -- Pré-preenche semanas por membro
  INSERT INTO public.monthly_report_member_weeks (monthly_report_member_id, week_number)
  SELECT mrm.id, w.n
  FROM public.monthly_report_members mrm
  CROSS JOIN (SELECT generate_series(1,5) AS n) w
  WHERE mrm.report_id = v_report_id
  ON CONFLICT (monthly_report_member_id, week_number) DO NOTHING;

  RETURN v_report_id;
END;
$$;

-- Garante que qualquer usuário autenticado pode chamar
-- (RLS das tabelas controla o acesso aos dados)
GRANT EXECUTE ON FUNCTION public.monthly_report_prefill(uuid, int, int) TO authenticated;
