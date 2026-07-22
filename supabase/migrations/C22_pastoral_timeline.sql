-- ============================================================
-- CEC FAMILY — C22: Timeline Pastoral + registro automático de
-- mudança de etapa (journey_stage) do membro
-- - Tabela: pastoral_timeline
-- - Trigger: registra automaticamente toda vez que members.journey_stage muda
-- - Função auxiliar: journey_stage_label(stage) — rótulo em português
-- Idempotente.
-- ============================================================

-- ---------- 1) Enum de tipos de evento ----------
-- Mesmos valores já usados no front-end (src/types/domain.ts, TimelineEventType)
do $$ begin
  create type timeline_event_type as enum (
    'conversao','batismo','consolidacao','discipulado','curso',
    'ministerio','encontro','mudanca_etapa','observacao'
  );
exception when duplicate_object then null; end $$;

-- ---------- 2) Tabela pastoral_timeline ----------
create table if not exists public.pastoral_timeline (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  event_type   timeline_event_type not null,
  title        text not null,
  description  text,
  from_stage   text,
  to_stage     text,
  is_progression boolean,
  event_date   date not null default current_date,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on column public.pastoral_timeline.from_stage is
  'Preenchido apenas em eventos do tipo mudanca_etapa: etapa anterior (journey_stage).';
comment on column public.pastoral_timeline.to_stage is
  'Preenchido apenas em eventos do tipo mudanca_etapa: nova etapa (journey_stage).';
comment on column public.pastoral_timeline.is_progression is
  'true = avançou na jornada, false = retrocedeu, null = não aplicável (outros tipos de evento).';

-- ---------- 2b) Ordem canônica das etapas ----------
-- Fonte única de verdade para "isso é avanço ou retrocesso" — usada pelo
-- trigger abaixo. Se a ordem das etapas mudar, ajuste só aqui.
create or replace function public.journey_stage_rank(p_stage text)
returns int
language sql immutable as $$
  select case p_stage
    when 'visitante'        then 1
    when 'novo_convertido'  then 2
    when 'consolidacao'     then 3
    when 'discipulado'      then 4
    when 'batismo'          then 5
    when 'membro_ativo'     then 6
    when 'servo'            then 7
    when 'lider_formacao'   then 8
    when 'lider'            then 9
    when 'supervisor'       then 10
    when 'missionario'      then 11
    else 0
  end;
$$;

create index if not exists idx_pt_member on public.pastoral_timeline(member_id);
create index if not exists idx_pt_date   on public.pastoral_timeline(event_date desc);

comment on table public.pastoral_timeline is
  'Linha do tempo pastoral de cada membro: marcos, mudanças de etapa e observações.';

alter table public.pastoral_timeline enable row level security;

-- Admin/pastor gerencia tudo (mesma convenção usada em outras tabelas do projeto)
drop policy if exists pt_admin_all on public.pastoral_timeline;
create policy pt_admin_all on public.pastoral_timeline for all to authenticated
  using (is_admin())
  with check (is_admin());

-- Membro vê a própria timeline
drop policy if exists pt_owner_select on public.pastoral_timeline;
create policy pt_owner_select on public.pastoral_timeline for select to authenticated
  using (member_id in (select id from public.members where profile_id = auth.uid()));

-- ---------- 3) Rótulo em português de cada etapa ----------
-- Espelha STAGE_LABELS usado no front-end (sem os emojis).
create or replace function public.journey_stage_label(p_stage text)
returns text
language sql immutable as $$
  select case p_stage
    when 'visitante'        then 'Visitante'
    when 'novo_convertido'  then 'Novo Convertido'
    when 'consolidacao'     then 'Consolidação'
    when 'discipulado'      then 'Discipulado'
    when 'batismo'          then 'Batismo'
    when 'membro_ativo'     then 'Membro Ativo'
    when 'servo'            then 'Servo'
    when 'lider_formacao'   then 'Líder em Formação'
    when 'lider'            then 'Líder'
    when 'supervisor'       then 'Supervisor'
    when 'missionario'      then 'Missionário'
    else p_stage
  end;
$$;

-- ---------- 4) Trigger: registra toda mudança de etapa ----------
create or replace function public.log_journey_stage_change()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.journey_stage is distinct from old.journey_stage then
    insert into public.pastoral_timeline (member_id, event_type, title, from_stage, to_stage, is_progression, event_date)
    values (
      new.id,
      'mudanca_etapa',
      'Mudou de etapa: ' || public.journey_stage_label(old.journey_stage) || ' → ' || public.journey_stage_label(new.journey_stage),
      old.journey_stage,
      new.journey_stage,
      public.journey_stage_rank(new.journey_stage) > public.journey_stage_rank(old.journey_stage),
      current_date
    );
  end if;
  return new;
end; $$;

drop trigger if exists trg_members_journey_stage_change on public.members;
create trigger trg_members_journey_stage_change
  after update on public.members
  for each row
  execute function public.log_journey_stage_change();
