-- ============================================================
-- CEC FAMILY — MEO-001: Modelo da Estrutura Organizacional
-- Migração direta (recria a árvore territorial). Dado real hoje é
-- mínimo (0 distritos, 0 áreas, 0 setores, 1 LG) — risco baixo.
--
-- Nova hierarquia institucional:
--   (Comunidade — implícita) → Estados → Núcleos → Distritos →
--   Setores → Igrejas Locais → Life Groups → Grupos de Evangelismo
--
-- Área (Estrutura de Multiplicação) é formalizada como tabela própria,
-- mas NÃO faz parte do caminho de posse/escopo — é genealogia
-- (3 Setores que multiplicaram formam uma Área-mãe), igual mother_id
-- já funciona hoje pra Distrito/Setor/Life Group.
--
-- Sede Nacional = uma Igreja Local com type = 'sede_nacional',
-- morando normalmente dentro de um Estado/Núcleo/Distrito/Setor
-- como qualquer outra (conforme confirmado com o cliente).
-- ============================================================

-- ============================================================
-- 1) Tabelas novas
-- ============================================================

create table if not exists public.states (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  uf         text not null unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.states is 'Estado (MEO-001) — nível territorial acima de Núcleo.';

create table if not exists public.nucleos (
  id         uuid primary key default gen_random_uuid(),
  state_id   uuid not null references public.states(id) on delete cascade,
  name       text not null,
  leader_id  uuid references public.profiles(id) on delete set null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.nucleos is 'Núcleo (MEO-001) — agrupa Distritos dentro de um Estado.';
create index if not exists idx_nucleos_state on public.nucleos(state_id);

-- Área (Estrutura de Multiplicação, formalizada) — agrupa Setores dentro
-- de um Distrito para fins de genealogia/relatório, sem ser obrigatória
-- no caminho de posse (sectors.district_id continua sendo o pai real).
create table if not exists public.areas (
  id          uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete cascade,
  name        text not null,
  mother_id   uuid references public.areas(id) on delete set null,
  leader_id   uuid references public.profiles(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
comment on table public.areas is 'Área (MEO-001, Estrutura de Multiplicação) — agrupamento genealógico de 3 Setores-mãe, não é caminho de posse obrigatório.';
create index if not exists idx_areas_district on public.areas(district_id);

-- ============================================================
-- 2) Alterar tabelas existentes — reencaixar na nova árvore
-- ============================================================

-- Distrito: passa a pertencer a um Núcleo (antes: church_id)
alter table public.districts add column if not exists nucleo_id uuid references public.nucleos(id) on delete cascade;
-- (mantém church_id temporariamente como coluna legada, sem FK obrigatória, para não perder o que já existe)
alter table public.districts alter column church_id drop not null;

-- Setor: passa a pertencer diretamente a um Distrito (antes: area_id obrigatório)
alter table public.sectors add column if not exists district_id uuid references public.districts(id) on delete cascade;
-- area_id já existe e já aponta pra public.areas — só deixamos de exigir (vira opcional/genealogia,
-- sem derrubar a coluna, já que views e policies existentes dependem dela)
alter table public.sectors alter column area_id drop not null;

-- Igreja Local: passa a pertencer a um Setor (antes: raiz da árvore via parent_id)
alter table public.churches add column if not exists sector_id uuid references public.sectors(id) on delete set null;
-- type ganha o valor especial 'sede_nacional' (mantém os demais valores já existentes: sede/nucleo/local etc.)
-- parent_id (autorreferência sede/núcleo antiga) fica mantida mas não é mais usada pela árvore institucional —
-- não removemos pra não quebrar dado histórico; UI para de depender dela.

-- ============================================================
-- 3) Escopo de permissão em qualquer nível (Estrutura de Supervisão)
-- ============================================================

do $$ begin
  create type scope_level as enum ('nacional','estado','nucleo','distrito','setor','igreja');
exception when duplicate_object then null; end $$;

alter table public.profiles add column if not exists scope_level scope_level;
alter table public.profiles add column if not exists scope_id uuid;

-- Backfill: quem já tinha church_id vira escopo 'igreja' explícito (comportamento idêntico ao de hoje)
update public.profiles set scope_level = 'igreja', scope_id = church_id
where scope_level is null and church_id is not null;

create or replace function public.accessible_church_ids()
returns setof uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_scope_level scope_level;
  v_scope_id uuid;
  v_church uuid;
begin
  select role::text, scope_level, scope_id, church_id
    into v_role, v_scope_level, v_scope_id, v_church
  from public.profiles where id = auth.uid();

  -- Apóstolo, ou escopo nacional, ou pastor legado sem nenhum escopo: vê tudo
  if v_role = 'apostolo' or v_scope_level = 'nacional' or (v_scope_level is null and v_church is null) then
    return query select id from public.churches;
    return;
  end if;

  if v_scope_level = 'estado' then
    return query
    select ch.id from public.churches ch
    join public.sectors se on se.id = ch.sector_id
    join public.districts di on di.id = se.district_id
    join public.nucleos nu on nu.id = di.nucleo_id
    where nu.state_id = v_scope_id;
    return;
  end if;

  if v_scope_level = 'nucleo' then
    return query
    select ch.id from public.churches ch
    join public.sectors se on se.id = ch.sector_id
    join public.districts di on di.id = se.district_id
    where di.nucleo_id = v_scope_id;
    return;
  end if;

  if v_scope_level = 'distrito' then
    return query
    select ch.id from public.churches ch
    join public.sectors se on se.id = ch.sector_id
    where se.district_id = v_scope_id;
    return;
  end if;

  if v_scope_level = 'setor' then
    return query select ch.id from public.churches ch where ch.sector_id = v_scope_id;
    return;
  end if;

  -- 'igreja' (ou legado via church_id): só a própria igreja — sem filhos,
  -- já que Igreja Local agora é folha institucional, não dona de subárvore.
  return query select coalesce(v_scope_id, v_church) where coalesce(v_scope_id, v_church) is not null;
end; $$;
grant execute on function public.accessible_church_ids() to authenticated;

-- ============================================================
-- 4) RLS — states, nucleos, areas (mesmo padrão do resto do sistema)
-- ============================================================
alter table public.states enable row level security;
alter table public.nucleos enable row level security;
alter table public.areas enable row level security;

drop policy if exists states_read on public.states;
create policy states_read on public.states for select to authenticated using (true);
drop policy if exists states_write on public.states;
create policy states_write on public.states for all to authenticated
  using (public.is_apostle()) with check (public.is_apostle());

drop policy if exists nucleos_read on public.nucleos;
create policy nucleos_read on public.nucleos for select to authenticated using (true);
drop policy if exists nucleos_write on public.nucleos;
create policy nucleos_write on public.nucleos for all to authenticated
  using (
    public.is_apostle()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.scope_level = 'nacional' or (p.scope_level = 'estado' and p.scope_id = nucleos.state_id))
    )
  )
  with check (public.is_apostle());

drop policy if exists areas_read on public.areas;
create policy areas_read on public.areas for select to authenticated using (true);
drop policy if exists areas_write on public.areas;
create policy areas_write on public.areas for all to authenticated
  using (public.is_apostle()) with check (public.is_apostle());

-- ============================================================
-- 5) Grupo de Evangelismo — ciclo de vida formal (MEO-001 / ARQ-004 §8)
-- ============================================================
do $$ begin
  create type evangelism_group_status as enum (
    'planejamento','autorizacao','implantacao','evangelizacao','consolidacao',
    'encerrado_novo_lg','encerrado_integrado','encerrado_sem_resultado'
  );
exception when duplicate_object then null; end $$;

alter table public.evangelism_groups add column if not exists status evangelism_group_status not null default 'planejamento';
alter table public.evangelism_groups add column if not exists started_at date;
alter table public.evangelism_groups add column if not exists expected_end_at date;
alter table public.evangelism_groups add column if not exists resulting_lg_id uuid references public.life_groups(id) on delete set null;
comment on column public.evangelism_groups.resulting_lg_id is 'Preenchido quando o G.E. vira um novo Life Group (Resultado 1 do ARQ-004).';
