-- ============================================================
-- RELMDA001 — Relatório Semanal de Life Group (Fase 1)
-- Especificação: RELMDA-001 / RELMDA-002 / RELMDA-003
-- ============================================================
-- Decisões ministeriais já confirmadas nesta fase:
--   - MDA semanal = nº de encontros de discipulado um-a-um (fora do LG)
--   - EMP = Encontro de Maturidade Pessoal (retiro p/ novos convertidos):
--     conta participantes E ocorrências
--   - CC (Capitão da Casa) = NÃO é campo novo — era só um apelido antigo
--     pro próprio Life Group na planilha. Não existe coluna "cc" aqui.
--   - Cesta Básica / Kg do Amor seguem juntos (kg + cestas completas)
--   - Seção de ofertas chama-se "Momento de Generosidade" (rótulo de tela,
--     nomes técnicos de coluna continuam "offering_*")
--   - Presença é NOMINAL (líder marca membro a membro, sistema conta)
--   - Visitante: nome é obrigatório (não só quantidade)
--   - Prazo padrão de envio: segunda-feira 18h (configurável depois)
--
-- Tabelas novas, prefixo relmda_, sem conflito com meeting_reports
-- (relatório semanal antigo, que continua existindo e funcionando).
-- Idempotente.
-- ============================================================

-- ---------- 1) Enums ----------
do $$ begin
  create type relmda_report_status as enum (
    'rascunho','enviado','em_analise','correcao_solicitada','corrigido','validado','encerrado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type relmda_health as enum ('muito_saudavel','saudavel','atencao','necessita_apoio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type relmda_flow as enum ('muito_bem','bem','regular','dificil');
exception when duplicate_object then null; end $$;

do $$ begin
  create type relmda_visitor_followup as enum ('sem_contato','contatado','em_acompanhamento','integrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type relmda_no_meeting_reason as enum (
    'feriado','evento_igreja','enfermidade','ausencia_lideranca','reorganizacao','outro'
  );
exception when duplicate_object then null; end $$;

-- ---------- 2) Tabela principal ----------
create table if not exists public.relmda_weekly_reports (
  id                  uuid primary key default gen_random_uuid(),
  life_group_id       uuid not null references public.life_groups(id) on delete cascade,
  week_number         smallint not null check (week_number between 1 and 5),
  month               smallint not null check (month between 1 and 12),
  year                smallint not null check (year between 2020 and 2100),
  reference_date      date,

  happened            boolean not null default true,
  no_meeting_reason    relmda_no_meeting_reason,
  no_meeting_note      text,
  extraordinary        boolean not null default false,
  week_note            text,

  -- Discipulado / MDA (encontros um-a-um)
  mda_count                    int not null default 0,
  new_discipleships            int not null default 0,
  interrupted_discipleships    int not null default 0,

  -- Evangelismo (GE)
  ge_happened          boolean not null default false,
  ge_count             int not null default 0,
  evangelism_group_id  uuid references public.evangelism_groups(id),
  ge_people_reached    int not null default 0,
  ge_decisions         int not null default 0,

  -- TADEL
  tadel_count          int not null default 0,

  -- EMP — Encontro de Maturidade Pessoal
  emp_participants     int not null default 0,
  emp_occurrences      int not null default 0,

  -- Momento de Generosidade
  offering_pix         numeric(10,2) not null default 0,
  offering_especie     numeric(10,2) not null default 0,
  offering_outros      numeric(10,2) not null default 0,
  offering_outros_desc text,
  offering_total       numeric(10,2) generated always as (offering_pix + offering_especie + offering_outros) stored,

  -- Ação social (continuam juntos)
  kg_amor              numeric(10,2) not null default 0,
  cestas_completas     int not null default 0,

  -- Conteúdo do encontro
  topic                text,
  bible_text           text,
  flow                 relmda_flow,
  health_assessment    relmda_health,
  health_comment       text,
  summary              text,

  -- Fluxo / status
  status               relmda_report_status not null default 'rascunho',
  created_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  sent_by              uuid references public.profiles(id),
  sent_at              timestamptz,
  validated_by         uuid references public.profiles(id),
  validated_at         timestamptz,

  -- Campos exclusivos do supervisor
  supervisor_note      text,
  needs_correction     boolean not null default false,
  correction_items     text[],
  correction_deadline  timestamptz,
  needs_support        boolean not null default false,
  support_type         text,

  unique (life_group_id, week_number, year)
);

comment on table public.relmda_weekly_reports is
  'RELMDA — Relatório semanal de Life Group (Fase 1: formulário do líder). Um registro por Life Group/semana/ano.';
comment on column public.relmda_weekly_reports.mda_count is
  'MDA semanal = quantidade de encontros de discipulado um-a-um realizados na semana (fora da reunião do LG).';
comment on column public.relmda_weekly_reports.emp_participants is
  'EMP = Encontro de Maturidade Pessoal (retiro de fim de semana p/ novos convertidos). Participantes na semana.';
comment on column public.relmda_weekly_reports.emp_occurrences is
  'Quantidade de edições/ocorrências do EMP na semana (normalmente 0 ou 1).';

create index if not exists idx_relmda_reports_lg     on public.relmda_weekly_reports(life_group_id);
create index if not exists idx_relmda_reports_status on public.relmda_weekly_reports(status);
create index if not exists idx_relmda_reports_period  on public.relmda_weekly_reports(year, month, week_number);

drop trigger if exists trg_relmda_reports_updated_at on public.relmda_weekly_reports;
create trigger trg_relmda_reports_updated_at before update on public.relmda_weekly_reports
  for each row execute function public.set_updated_at();

-- ---------- 3) Presença nominal ----------
create table if not exists public.relmda_attendance (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.relmda_weekly_reports(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  present    boolean not null default false,
  unique (report_id, member_id)
);
create index if not exists idx_relmda_attendance_report on public.relmda_attendance(report_id);
comment on table public.relmda_attendance is 'Presença marcada nominalmente pelo líder, membro a membro.';

-- ---------- 4) Visitantes (nome obrigatório) ----------
create table if not exists public.relmda_visitors (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references public.relmda_weekly_reports(id) on delete cascade,
  full_name        text not null check (length(trim(full_name)) > 0),
  phone            text,
  first_visit      boolean not null default true,
  followup_status  relmda_visitor_followup not null default 'sem_contato',
  note             text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_relmda_visitors_report on public.relmda_visitors(report_id);

-- ---------- 5) Necessidades pastorais (dado restrito) ----------
create table if not exists public.relmda_pastoral_needs (
  id                 uuid primary key default gen_random_uuid(),
  report_id          uuid not null references public.relmda_weekly_reports(id) on delete cascade,
  need_type          text,
  urgent_prayer      boolean not null default false,
  pastoral_visit     boolean not null default false,
  related_member_id  uuid references public.members(id),
  description        text,
  responsible_id     uuid references public.profiles(id),
  deadline           date,
  status             text not null default 'aberto',
  created_at         timestamptz not null default now()
);
create index if not exists idx_relmda_needs_report on public.relmda_pastoral_needs(report_id);
comment on table public.relmda_pastoral_needs is
  'Dado pastoral restrito — visibilidade deve ser tratada com mais rigor na Fase 2 (RLS aqui é o mínimo, mesma regra das outras tabelas do relatório).';

-- ---------- 6) Histórico de status ----------
create table if not exists public.relmda_status_history (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.relmda_weekly_reports(id) on delete cascade,
  from_status  relmda_report_status,
  to_status    relmda_report_status not null,
  changed_by   uuid references public.profiles(id),
  changed_at   timestamptz not null default now(),
  note         text
);
create index if not exists idx_relmda_history_report on public.relmda_status_history(report_id);

create or replace function public.relmda_log_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.relmda_status_history (report_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_relmda_status_history on public.relmda_weekly_reports;
create trigger trg_relmda_status_history after update on public.relmda_weekly_reports
  for each row execute function public.relmda_log_status_change();

-- ============================================================
-- 7) RLS
-- ============================================================
alter table public.relmda_weekly_reports  enable row level security;
alter table public.relmda_attendance      enable row level security;
alter table public.relmda_visitors        enable row level security;
alter table public.relmda_pastoral_needs  enable row level security;
alter table public.relmda_status_history  enable row level security;

-- Responsável direto pelo LG (líder, líder auxiliar ou supervisor cadastrado na célula)
create or replace function public.relmda_is_lg_responsible(p_life_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.life_groups lg
    where lg.id = p_life_group_id
      and (lg.leader_id = auth.uid() or lg.coleader_id = auth.uid() or lg.supervisor_id = auth.uid())
  );
$$;
grant execute on function public.relmda_is_lg_responsible(uuid) to authenticated;

-- Acesso por escopo territorial (apóstolo / pastor / etc., via church_id do LG)
create or replace function public.relmda_lg_in_scope(p_life_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.life_groups lg
    where lg.id = p_life_group_id
      and lg.church_id in (select public.accessible_church_ids())
  );
$$;
grant execute on function public.relmda_lg_in_scope(uuid) to authenticated;

drop policy if exists relmda_reports_rw on public.relmda_weekly_reports;
create policy relmda_reports_rw on public.relmda_weekly_reports for all to authenticated
using (
  public.is_apostle()
  or public.relmda_is_lg_responsible(life_group_id)
  or public.relmda_lg_in_scope(life_group_id)
)
with check (
  public.is_apostle()
  or public.relmda_is_lg_responsible(life_group_id)
  or public.relmda_lg_in_scope(life_group_id)
);

-- Escopo via relatório (usado pelas tabelas filhas)
create or replace function public.relmda_report_scope_ok(p_report_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.relmda_weekly_reports r
    where r.id = p_report_id
      and (
        public.is_apostle()
        or public.relmda_is_lg_responsible(r.life_group_id)
        or public.relmda_lg_in_scope(r.life_group_id)
      )
  );
$$;
grant execute on function public.relmda_report_scope_ok(uuid) to authenticated;

drop policy if exists relmda_attendance_rw on public.relmda_attendance;
create policy relmda_attendance_rw on public.relmda_attendance for all to authenticated
  using (public.relmda_report_scope_ok(report_id))
  with check (public.relmda_report_scope_ok(report_id));

drop policy if exists relmda_visitors_rw on public.relmda_visitors;
create policy relmda_visitors_rw on public.relmda_visitors for all to authenticated
  using (public.relmda_report_scope_ok(report_id))
  with check (public.relmda_report_scope_ok(report_id));

drop policy if exists relmda_needs_rw on public.relmda_pastoral_needs;
create policy relmda_needs_rw on public.relmda_pastoral_needs for all to authenticated
  using (public.relmda_report_scope_ok(report_id))
  with check (public.relmda_report_scope_ok(report_id));

drop policy if exists relmda_history_read on public.relmda_status_history;
create policy relmda_history_read on public.relmda_status_history for select to authenticated
  using (public.relmda_report_scope_ok(report_id));

-- ============================================================
-- 8) Funções de apoio (snapshot automático + criar/obter rascunho)
-- ============================================================

-- Total de membros ativos do LG + quantos têm discipulador ativo (automático, não digitado)
create or replace function public.relmda_lg_snapshot(p_life_group_id uuid)
returns table(total_members int, with_discipler int)
language sql stable security definer set search_path = public as $$
  select
    count(*)::int as total_members,
    count(*) filter (
      where exists (
        select 1 from public.discipleship d
        where d.disciple_id = m.profile_id and d.status = 'ativo'
      )
    )::int as with_discipler
  from public.members m
  where m.life_group_id = p_life_group_id and m.status = 'ativo';
$$;
grant execute on function public.relmda_lg_snapshot(uuid) to authenticated;

-- Busca o relatório da semana ou cria um rascunho novo (idempotente por LG/semana/ano)
create or replace function public.relmda_get_or_create_draft(
  p_life_group_id uuid, p_week_number smallint, p_month smallint, p_year smallint
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from public.relmda_weekly_reports
  where life_group_id = p_life_group_id and week_number = p_week_number and year = p_year;

  if v_id is null then
    insert into public.relmda_weekly_reports (life_group_id, week_number, month, year, created_by)
    values (p_life_group_id, p_week_number, p_month, p_year, auth.uid())
    returning id into v_id;
  end if;

  return v_id;
end;
$$;
grant execute on function public.relmda_get_or_create_draft(uuid, smallint, smallint, smallint) to authenticated;
