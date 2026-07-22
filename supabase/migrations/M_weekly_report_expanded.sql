-- ============================================================
-- CEC FAMILY — Etapa 2: Indicadores semanais expandidos
-- - Move quantitativos do mensal físico → relatório semanal
-- - Marcação por membro (MDA, CC, CEL)
-- - Mensal consolida automaticamente
-- Idempotente.
-- ============================================================

-- ---------- 1) Novos campos em meeting_reports ----------
alter table public.meeting_reports
  add column if not exists members_with_disciplers int not null default 0,
  add column if not exists mda_15_dias_happened    boolean default false,
  add column if not exists mda_15_dias_count       int not null default 0,
  add column if not exists ge_happened             boolean default false,
  add column if not exists ge_location             text,
  add column if not exists ge_when                 text,
  add column if not exists oferta_pix              numeric(10,2) not null default 0,
  add column if not exists oferta_especie          numeric(10,2) not null default 0,
  add column if not exists ebd_count               int not null default 0,
  add column if not exists cc_count                int not null default 0,
  add column if not exists cel_count               int not null default 0,
  add column if not exists kg_amor                 numeric(10,2) not null default 0;

comment on column public.meeting_reports.members_with_disciplers is 'Membros com discipuladores ativos nesta semana';
comment on column public.meeting_reports.mda_15_dias_happened is 'Se houve MDA 15 dias nesta semana';
comment on column public.meeting_reports.mda_15_dias_count is 'Quantos membros participaram do MDA 15 dias';
comment on column public.meeting_reports.ge_happened is 'Se houve GE (Grupo de Evangelismo)';
comment on column public.meeting_reports.ge_location is 'Onde foi o GE (texto livre)';
comment on column public.meeting_reports.ge_when is 'Quando foi o GE (texto livre)';
comment on column public.meeting_reports.oferta_pix is 'Valor da oferta via PIX (R$)';
comment on column public.meeting_reports.oferta_especie is 'Valor da oferta em espécie (R$)';
comment on column public.meeting_reports.ebd_count is 'Quantos membros participaram da EBD';
comment on column public.meeting_reports.cc_count is 'Quantos membros foram à Capacitação de Casa';
comment on column public.meeting_reports.cel_count is 'Quantos membros foram à Capacitação de Célula';
comment on column public.meeting_reports.kg_amor is 'Quilos de alimento arrecadados (KG Amor)';

-- ---------- 2) Marcação individual por membro em report_attendance ----------
alter table public.report_attendance
  add column if not exists had_mda_15_dias boolean default false,
  add column if not exists had_cc          boolean default false,
  add column if not exists had_cel         boolean default false;

comment on column public.report_attendance.had_mda_15_dias is 'Este membro participou do MDA 15 dias nesta semana';
comment on column public.report_attendance.had_cc is 'Este membro foi à Capacitação de Casa';
comment on column public.report_attendance.had_cel is 'Este membro foi à Capacitação de Célula';

-- ---------- 3) RPC create_weekly_report — versão expandida ----------
-- Mantém retrocompatibilidade: aceita novos campos como opcionais com defaults
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
  -- Novos campos opcionais (Caderno 11-B)
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
  p_kg_amor                 numeric default 0
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

  -- Totaliza visitantes
  v_visitors_count := jsonb_array_length(p_visits);
  v_visits_made := v_visitors_count;
  v_total := v_att_count + v_visitors_count;

  -- Insere relatório
  insert into public.meeting_reports (
    life_group_id, reported_by, meeting_date, weekday,
    share_theme, bible_text, flowed, flowed_reason,
    attendance_count, frequentadores_count, total_present,
    visitors_count, visits_made, decisions_count,
    needs, summary,
    members_with_disciplers, mda_15_dias_happened, mda_15_dias_count,
    ge_happened, ge_location, ge_when,
    oferta_pix, oferta_especie,
    ebd_count, cc_count, cel_count, kg_amor
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
    coalesce(p_cel_count, 0), coalesce(p_kg_amor, 0)
  ) returning id into v_report_id;

  -- Insere presenças individuais (com novos booleans)
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

  -- Insere visitantes
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
  int, boolean, int, boolean, text, text, numeric, numeric, int, int, int, numeric
) to authenticated;

-- ---------- 4) Atualizar prefill mensal para consolidar campos novos ----------
-- Soma os campos do relatório semanal por semana do mês
create or replace function public.monthly_report_prefill(
  p_life_group_id uuid,
  p_year int,
  p_month int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_report_id uuid;
  v_week_num int;
  v_week_start date;
  v_week_end date;
  v_active_members int;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  -- Cria ou recupera relatório mensal
  insert into public.monthly_reports (life_group_id, year, month)
  values (p_life_group_id, p_year, p_month)
  on conflict (life_group_id, year, month) do nothing;

  select id into v_report_id
  from public.monthly_reports
  where life_group_id = p_life_group_id and year = p_year and month = p_month;

  -- Membros ativos atuais
  select count(*)::int into v_active_members
  from public.members
  where life_group_id = p_life_group_id and status = 'ativo';

  -- Para cada uma das 5 semanas, consolida dados dos relatórios semanais
  for v_week_num in 1..5 loop
    v_week_start := (date_trunc('month', make_date(p_year, p_month, 1))::date)
                    + ((v_week_num - 1) * 7);
    v_week_end := v_week_start + 6;

    insert into public.monthly_report_weeks (
      report_id, week_number,
      num_membros, memb_c_discipuladores, mda_15_dias, ge,
      visitantes, oferta_pix, oferta_especie,
      ebd, cc, cel, kg_amor
    )
    select
      v_report_id, v_week_num,
      v_active_members,
      coalesce(sum(r.members_with_disciplers), 0),
      coalesce(sum(case when r.mda_15_dias_happened then r.mda_15_dias_count else 0 end), 0),
      coalesce(sum(case when r.ge_happened then 1 else 0 end), 0),
      coalesce(sum(r.visitors_count), 0),
      coalesce(sum(r.oferta_pix), 0),
      coalesce(sum(r.oferta_especie), 0),
      coalesce(sum(r.ebd_count), 0),
      coalesce(sum(r.cc_count), 0),
      coalesce(sum(r.cel_count), 0),
      coalesce(sum(r.kg_amor), 0)
    from public.meeting_reports r
    where r.life_group_id = p_life_group_id
      and r.meeting_date between v_week_start and v_week_end
    on conflict (report_id, week_number) do update set
      num_membros           = excluded.num_membros,
      memb_c_discipuladores = excluded.memb_c_discipuladores,
      mda_15_dias           = excluded.mda_15_dias,
      ge                    = excluded.ge,
      visitantes            = excluded.visitantes,
      oferta_pix            = excluded.oferta_pix,
      oferta_especie        = excluded.oferta_especie,
      ebd                   = excluded.ebd,
      cc                    = excluded.cc,
      cel                   = excluded.cel,
      kg_amor               = excluded.kg_amor;
  end loop;

  return v_report_id;
end; $$;

grant execute on function public.monthly_report_prefill(uuid, int, int) to authenticated;
