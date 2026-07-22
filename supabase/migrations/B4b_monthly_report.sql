-- ============================================================
-- CEC FAMILY — B4b: Relatorio Mensal de Life Group
-- Fiel ao papel fisico enviado pelo cliente.
-- Idempotente: pode rodar varias vezes.
-- ============================================================

-- ---------- monthly_reports (cabecalho) ----------
create table if not exists public.monthly_reports (
  id            uuid primary key default gen_random_uuid(),
  life_group_id uuid not null references public.life_groups(id) on delete cascade,
  year          integer not null check (year between 2020 and 2100),
  month         integer not null check (month between 1 and 12),
  nucleo        text,
  reported_by   uuid references public.profiles(id) on delete set null,
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (life_group_id, year, month)
);
create index if not exists idx_monthly_reports_group on public.monthly_reports(life_group_id);
create index if not exists idx_monthly_reports_ym    on public.monthly_reports(year desc, month desc);

drop trigger if exists trg_monthly_reports_updated on public.monthly_reports;
create trigger trg_monthly_reports_updated before update on public.monthly_reports
  for each row execute function public.set_updated_at();

-- ---------- monthly_report_weeks (totais semana a semana, 1a a 5a) ----------
create table if not exists public.monthly_report_weeks (
  id                     uuid primary key default gen_random_uuid(),
  report_id              uuid not null references public.monthly_reports(id) on delete cascade,
  week_number            integer not null check (week_number between 1 and 5),
  num_membros            integer default 0,
  memb_c_discipuladores  integer default 0,
  mda_15_dias            integer default 0,
  ge                     integer default 0,
  visitantes             integer default 0,
  oferta_pix             numeric(14,2) default 0,
  oferta_especie         numeric(14,2) default 0,
  ebd                    integer default 0,
  cc                     integer default 0,
  cel                    integer default 0,
  kg_amor                integer default 0,
  unique (report_id, week_number)
);
create index if not exists idx_monthly_report_weeks_report on public.monthly_report_weeks(report_id);

-- ---------- monthly_report_members (cabecalho do membro no relatorio) ----------
create table if not exists public.monthly_report_members (
  id                 uuid primary key default gen_random_uuid(),
  report_id          uuid not null references public.monthly_reports(id) on delete cascade,
  member_id          uuid not null references public.members(id) on delete cascade,
  discipulador_id    uuid references public.members(id) on delete set null,
  discipulador_nome  text,
  unique (report_id, member_id)
);
create index if not exists idx_monthly_report_members_report on public.monthly_report_members(report_id);

-- ---------- monthly_report_member_weeks (contagens MDA/CC/CEL por membro por semana) ----------
create table if not exists public.monthly_report_member_weeks (
  id                          uuid primary key default gen_random_uuid(),
  monthly_report_member_id    uuid not null references public.monthly_report_members(id) on delete cascade,
  week_number                 integer not null check (week_number between 1 and 5),
  mda                         integer not null default 0,
  cc                          integer not null default 0,
  cel                         integer not null default 0,
  unique (monthly_report_member_id, week_number)
);
create index if not exists idx_mr_member_weeks_member on public.monthly_report_member_weeks(monthly_report_member_id);

-- ============================================================
-- RLS - mesmo padrao do meeting_reports
-- ============================================================
alter table public.monthly_reports             enable row level security;
alter table public.monthly_report_weeks        enable row level security;
alter table public.monthly_report_members      enable row level security;
alter table public.monthly_report_member_weeks enable row level security;

drop policy if exists monthly_reports_all on public.monthly_reports;
create policy monthly_reports_all on public.monthly_reports for all to authenticated
  using ( leads_group(life_group_id) or (is_admin() and group_in_my_network(life_group_id)) )
  with check ( leads_group(life_group_id) or (is_admin() and group_in_my_network(life_group_id)) );

drop policy if exists mrw_all on public.monthly_report_weeks;
create policy mrw_all on public.monthly_report_weeks for all to authenticated
  using ( exists (select 1 from public.monthly_reports r where r.id = monthly_report_weeks.report_id
                  and (leads_group(r.life_group_id) or (is_admin() and group_in_my_network(r.life_group_id)))) )
  with check ( exists (select 1 from public.monthly_reports r where r.id = monthly_report_weeks.report_id
                  and (leads_group(r.life_group_id) or (is_admin() and group_in_my_network(r.life_group_id)))) );

drop policy if exists mrm_all on public.monthly_report_members;
create policy mrm_all on public.monthly_report_members for all to authenticated
  using ( exists (select 1 from public.monthly_reports r where r.id = monthly_report_members.report_id
                  and (leads_group(r.life_group_id) or (is_admin() and group_in_my_network(r.life_group_id)))) )
  with check ( exists (select 1 from public.monthly_reports r where r.id = monthly_report_members.report_id
                  and (leads_group(r.life_group_id) or (is_admin() and group_in_my_network(r.life_group_id)))) );

drop policy if exists mrmw_all on public.monthly_report_member_weeks;
create policy mrmw_all on public.monthly_report_member_weeks for all to authenticated
  using ( exists (
    select 1 from public.monthly_report_members m
    join public.monthly_reports r on r.id = m.report_id
    where m.id = monthly_report_member_weeks.monthly_report_member_id
      and (leads_group(r.life_group_id) or (is_admin() and group_in_my_network(r.life_group_id)))
  ) )
  with check ( exists (
    select 1 from public.monthly_report_members m
    join public.monthly_reports r on r.id = m.report_id
    where m.id = monthly_report_member_weeks.monthly_report_member_id
      and (leads_group(r.life_group_id) or (is_admin() and group_in_my_network(r.life_group_id)))
  ) );

-- ============================================================
-- Pre-preenchimento a partir dos relatorios semanais
-- ============================================================
create or replace function public.monthly_report_prefill(
  p_life_group_id uuid, p_year int, p_month int
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_report_id uuid; v_num_membros int; v_week int;
  v_visitantes int; v_cel_total int;
  v_member record; v_mrm_id uuid; v_cel_member int;
begin
  insert into public.monthly_reports (life_group_id, year, month, reported_by)
  values (p_life_group_id, p_year, p_month, auth.uid())
  on conflict (life_group_id, year, month) do update set updated_at = now()
  returning id into v_report_id;

  select count(*) into v_num_membros
  from public.members
  where life_group_id = p_life_group_id and status = 'ativo';

  for v_week in 1..5 loop
    select coalesce(sum(visit_count), 0) into v_visitantes
    from (
      select (select count(*) from public.report_visits rv where rv.report_id = r.id) as visit_count
      from public.meeting_reports r
      where r.life_group_id = p_life_group_id
        and extract(year from r.meeting_date) = p_year
        and extract(month from r.meeting_date) = p_month
        and ceil(extract(day from r.meeting_date)::numeric / 7) = v_week
    ) t;

    select coalesce(count(*), 0) into v_cel_total
    from public.report_attendance ra
    join public.meeting_reports r on r.id = ra.report_id
    where r.life_group_id = p_life_group_id
      and extract(year from r.meeting_date) = p_year
      and extract(month from r.meeting_date) = p_month
      and ceil(extract(day from r.meeting_date)::numeric / 7) = v_week
      and ra.present = true;

    insert into public.monthly_report_weeks
      (report_id, week_number, num_membros, visitantes, cel)
    values
      (v_report_id, v_week, v_num_membros, v_visitantes, v_cel_total)
    on conflict (report_id, week_number) do update
      set num_membros = excluded.num_membros,
          visitantes  = excluded.visitantes,
          cel         = excluded.cel;
  end loop;

  for v_member in
    select id from public.members
    where life_group_id = p_life_group_id and status = 'ativo'
    order by full_name
  loop
    insert into public.monthly_report_members (report_id, member_id)
    values (v_report_id, v_member.id)
    on conflict (report_id, member_id) do update set report_id = excluded.report_id
    returning id into v_mrm_id;

    for v_week in 1..5 loop
      select coalesce(count(*), 0) into v_cel_member
      from public.report_attendance ra
      join public.meeting_reports r on r.id = ra.report_id
      where r.life_group_id = p_life_group_id
        and ra.member_id = v_member.id
        and ra.present = true
        and extract(year from r.meeting_date) = p_year
        and extract(month from r.meeting_date) = p_month
        and ceil(extract(day from r.meeting_date)::numeric / 7) = v_week;

      insert into public.monthly_report_member_weeks
        (monthly_report_member_id, week_number, cel)
      values
        (v_mrm_id, v_week, v_cel_member)
      on conflict (monthly_report_member_id, week_number) do update
        set cel = excluded.cel;
    end loop;
  end loop;

  return v_report_id;
end; $$;
