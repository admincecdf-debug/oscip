-- ============================================================
-- CEC FAMILY — Etapa 11-B Parte 2: Discipulado, Consolidação, Liderança,
-- Multiplicação, Saúde do LG e Necessidades Pastorais
-- 23 campos novos em meeting_reports
-- Idempotente.
-- ============================================================

-- ---------- 1) Enum: saúde do LG ----------
do $$ begin
  create type lg_health as enum ('muito_saudavel', 'saudavel', 'atencao', 'necessita_apoio');
exception when duplicate_object then null; end $$;

-- ---------- 2) Novos campos em meeting_reports ----------
alter table public.meeting_reports
  -- Discipulado (5 campos)
  add column if not exists disc_realizados int not null default 0,
  add column if not exists disc_ativos int not null default 0,
  add column if not exists disc_encontros int not null default 0,
  add column if not exists disc_interrompidos int not null default 0,
  add column if not exists disc_novos int not null default 0,
  -- Consolidação (4 campos)
  add column if not exists cons_retornantes int not null default 0,
  add column if not exists cons_acompanhamento int not null default 0,
  add column if not exists cons_integrados int not null default 0,
  add column if not exists cons_novos_membros int not null default 0,
  -- Formação de Liderança (3 bools + 1 texto)
  add column if not exists lid_aux_treinamento boolean default false,
  add column if not exists lid_em_formacao boolean default false,
  add column if not exists lid_potencial_multiplicador boolean default false,
  add column if not exists lid_observacoes text,
  -- Multiplicação (3 bools)
  add column if not exists mult_filha_preparacao boolean default false,
  add column if not exists mult_nova_lideranca boolean default false,
  add column if not exists mult_potencial boolean default false,
  -- Saúde do LG (enum + comentários)
  add column if not exists saude_status lg_health,
  add column if not exists saude_comentarios text,
  -- Necessidades Pastorais (5 bools)
  add column if not exists nec_oracao_urgente boolean default false,
  add column if not exists nec_visita_pastoral boolean default false,
  add column if not exists nec_problema_familiar boolean default false,
  add column if not exists nec_problema_espiritual boolean default false,
  add column if not exists nec_encaminhar_supervisor boolean default false;

-- Index pra dashboards futuros que filtram por saúde
create index if not exists idx_mr_saude on public.meeting_reports(saude_status);

-- ---------- 3) RPC create_weekly_report v3 (com 23 campos novos) ----------
create or replace function public.create_weekly_report(
  p_life_group_id           uuid,
  p_meeting_date            date,
  p_weekday                 text default null,
  p_share_theme             text default null,
  p_bible_text              text default null,
  p_flowed                  boolean default null,
  p_flowed_reason           text default null,
  p_decisions_count         int default 0,
  p_needs                   text default null,
  p_summary                 text default null,
  p_attendance              jsonb default '[]'::jsonb,
  p_visits                  jsonb default '[]'::jsonb,
  -- Indicadores semanais (parte 1)
  p_members_with_disciplers int default 0,
  p_mda_15_dias_happened    boolean default false,
  p_mda_15_dias_count       int default 0,
  p_ge_happened             boolean default false,
  p_ge_location             text default null,
  p_ge_when                 text default null,
  p_oferta_pix              numeric default 0,
  p_oferta_especie          numeric default 0,
  p_ebd_count               int default 0,
  p_cc_count                int default 0,
  p_cel_count               int default 0,
  p_kg_amor                 numeric default 0,
  -- Discipulado (5)
  p_disc_realizados         int default 0,
  p_disc_ativos             int default 0,
  p_disc_encontros          int default 0,
  p_disc_interrompidos      int default 0,
  p_disc_novos              int default 0,
  -- Consolidação (4)
  p_cons_retornantes        int default 0,
  p_cons_acompanhamento     int default 0,
  p_cons_integrados         int default 0,
  p_cons_novos_membros      int default 0,
  -- Liderança (3 bools + 1 texto)
  p_lid_aux_treinamento     boolean default false,
  p_lid_em_formacao         boolean default false,
  p_lid_potencial_mult      boolean default false,
  p_lid_observacoes         text default null,
  -- Multiplicação (3 bools)
  p_mult_filha_preparacao   boolean default false,
  p_mult_nova_lideranca     boolean default false,
  p_mult_potencial          boolean default false,
  -- Saúde (enum + texto)
  p_saude_status            text default null,
  p_saude_comentarios       text default null,
  -- Necessidades Pastorais (5 bools)
  p_nec_oracao_urgente      boolean default false,
  p_nec_visita_pastoral     boolean default false,
  p_nec_problema_familiar   boolean default false,
  p_nec_problema_espiritual boolean default false,
  p_nec_encaminhar_super    boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_report_id uuid;
  v_att_count int := 0;
  v_visitors_count int := 0;
  v_freq_count int := 0;
  v_total int := 0;
  v_visits_made int := 0;
  v_att jsonb;
  v_vis jsonb;
begin
  -- Totaliza presenças
  for v_att in select * from jsonb_array_elements(p_attendance) loop
    if (v_att->>'present')::boolean then
      v_att_count := v_att_count + 1;
      if v_att->>'kind' = 'frequentador' then
        v_freq_count := v_freq_count + 1;
      end if;
    end if;
  end loop;

  v_visitors_count := jsonb_array_length(p_visits);
  v_visits_made := v_visitors_count;
  v_total := v_att_count + v_visitors_count;

  insert into public.meeting_reports (
    life_group_id, reported_by, meeting_date, weekday,
    share_theme, bible_text, flowed, flowed_reason,
    attendance_count, frequentadores_count, total_present,
    visitors_count, visits_made, decisions_count,
    needs, summary,
    members_with_disciplers, mda_15_dias_happened, mda_15_dias_count,
    ge_happened, ge_location, ge_when,
    oferta_pix, oferta_especie,
    ebd_count, cc_count, cel_count, kg_amor,
    -- Novos
    disc_realizados, disc_ativos, disc_encontros, disc_interrompidos, disc_novos,
    cons_retornantes, cons_acompanhamento, cons_integrados, cons_novos_membros,
    lid_aux_treinamento, lid_em_formacao, lid_potencial_multiplicador, lid_observacoes,
    mult_filha_preparacao, mult_nova_lideranca, mult_potencial,
    saude_status, saude_comentarios,
    nec_oracao_urgente, nec_visita_pastoral,
    nec_problema_familiar, nec_problema_espiritual, nec_encaminhar_supervisor
  ) values (
    p_life_group_id, auth.uid(), p_meeting_date, p_weekday::weekday_enum,
    p_share_theme, p_bible_text, p_flowed, p_flowed_reason,
    v_att_count, v_freq_count, v_total,
    v_visitors_count, v_visits_made, p_decisions_count,
    p_needs, p_summary,
    coalesce(p_members_with_disciplers, 0),
    coalesce(p_mda_15_dias_happened, false),
    coalesce(p_mda_15_dias_count, 0),
    coalesce(p_ge_happened, false), p_ge_location, p_ge_when,
    coalesce(p_oferta_pix, 0), coalesce(p_oferta_especie, 0),
    coalesce(p_ebd_count, 0), coalesce(p_cc_count, 0),
    coalesce(p_cel_count, 0), coalesce(p_kg_amor, 0),
    -- Novos
    coalesce(p_disc_realizados, 0), coalesce(p_disc_ativos, 0),
    coalesce(p_disc_encontros, 0), coalesce(p_disc_interrompidos, 0),
    coalesce(p_disc_novos, 0),
    coalesce(p_cons_retornantes, 0), coalesce(p_cons_acompanhamento, 0),
    coalesce(p_cons_integrados, 0), coalesce(p_cons_novos_membros, 0),
    coalesce(p_lid_aux_treinamento, false), coalesce(p_lid_em_formacao, false),
    coalesce(p_lid_potencial_mult, false), p_lid_observacoes,
    coalesce(p_mult_filha_preparacao, false),
    coalesce(p_mult_nova_lideranca, false),
    coalesce(p_mult_potencial, false),
    nullif(p_saude_status, '')::lg_health, p_saude_comentarios,
    coalesce(p_nec_oracao_urgente, false),
    coalesce(p_nec_visita_pastoral, false),
    coalesce(p_nec_problema_familiar, false),
    coalesce(p_nec_problema_espiritual, false),
    coalesce(p_nec_encaminhar_super, false)
  ) returning id into v_report_id;

  -- Inserção das presenças individuais (com booleans existentes)
  for v_att in select * from jsonb_array_elements(p_attendance) loop
    insert into public.report_attendance (
      report_id, member_id, present, kind, absence_reason,
      had_mda_15_dias, had_cc, had_cel
    ) values (
      v_report_id,
      (v_att->>'member_id')::uuid,
      coalesce((v_att->>'present')::boolean, false),
      coalesce((v_att->>'kind')::attendance_kind, 'frequentador'),
      v_att->>'absence_reason',
      coalesce((v_att->>'had_mda_15_dias')::boolean, false),
      coalesce((v_att->>'had_cc')::boolean, false),
      coalesce((v_att->>'had_cel')::boolean, false)
    );
  end loop;

  -- Visitantes
  for v_vis in select * from jsonb_array_elements(p_visits) loop
    insert into public.report_visits (
      report_id, visitor_name, phone, notes
    ) values (
      v_report_id,
      v_vis->>'visitor_name',
      v_vis->>'phone',
      v_vis->>'notes'
    );
  end loop;

  return v_report_id;
end; $$;

grant execute on function public.create_weekly_report(
  uuid, date, text, text, text, boolean, text, int, text, text, jsonb, jsonb,
  int, boolean, int, boolean, text, text, numeric, numeric, int, int, int, numeric,
  int, int, int, int, int,
  int, int, int, int,
  boolean, boolean, boolean, text,
  boolean, boolean, boolean,
  text, text,
  boolean, boolean, boolean, boolean, boolean
) to authenticated;
