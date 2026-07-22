-- ============================================================
-- CEC FAMILY — Fix: "column from_stage of relation pastoral_timeline
-- does not exist" ao mudar a Situação Ministerial de um membro.
--
-- Causa: a tabela pastoral_timeline já existia (de uma migration
-- anterior a essa, que não estava neste repositório) sem essas
-- colunas — então o "create table if not exists" do C22 não fez
-- nada. Usando ALTER TABLE, que funciona independente do que já
-- existe. Idempotente.
-- ============================================================

do $$ begin
  create type timeline_event_type as enum (
    'conversao','batismo','consolidacao','mudanca_etapa','discipulado_iniciado',
    'discipulado_concluido','lider_designado','visita_pastoral','oracao','observacao','outro'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.pastoral_timeline (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  event_type   timeline_event_type not null default 'outro',
  title        text not null default '',
  created_at   timestamptz not null default now()
);

alter table public.pastoral_timeline add column if not exists description text;
alter table public.pastoral_timeline add column if not exists from_stage text;
alter table public.pastoral_timeline add column if not exists to_stage text;
alter table public.pastoral_timeline add column if not exists is_progression boolean;
alter table public.pastoral_timeline add column if not exists event_date date not null default current_date;
alter table public.pastoral_timeline add column if not exists created_by uuid references public.profiles(id) on delete set null;

comment on column public.pastoral_timeline.from_stage is
  'Preenchido apenas em eventos do tipo mudanca_etapa: etapa anterior (journey_stage).';

create index if not exists idx_pt_member on public.pastoral_timeline(member_id);
create index if not exists idx_pt_date   on public.pastoral_timeline(event_date desc);

alter table public.pastoral_timeline enable row level security;

drop policy if exists pastoral_timeline_scoped on public.pastoral_timeline;
create policy pastoral_timeline_scoped on public.pastoral_timeline for all to authenticated
  using (member_id in (select id from public.members where church_id in (select public.accessible_church_ids())))
  with check (member_id in (select id from public.members where church_id in (select public.accessible_church_ids())));

grant select, insert, update, delete on public.pastoral_timeline to authenticated;

-- Reaplica o gatilho, garantindo que aponte pra função mais recente (FIX002)
drop trigger if exists trg_members_journey_stage_change on public.members;
create trigger trg_members_journey_stage_change after update on public.members
  for each row execute function public.log_journey_stage_change();
