-- STUB mínimo, só para validar sintaxe/lógica das migrations RENAME001/RENAME002.
-- Não reproduz o schema real inteiro (que nem está 100% nas migrations, conforme
-- comentário do próprio time em CT002f). Cobre só o necessário para as funções
-- do lote "segurança/core + convites".

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid; $$;

create type scope_level as enum ('nacional','estado','nucleo','distrito','setor','igreja');
create type user_role as enum ('apostolo','pastor','supervisor','lider','membro','administrador');
create type church_type as enum ('sede','nucleo','igreja_local');
create type invite_link_kind as enum ('visitante','membro','lider_lg','lider_jovens','lider_casais','lider_criancas','musico','pastor','administrador','diretor_financeiro','secretario');
create type invite_link_status as enum ('ativo','revogado','expirado','esgotado');
create type journey_stage as enum ('visitante','novo_convertido','membro_ativo','servo','lider');
create type leadership_function as enum ('pastor_auxiliar','lider_lg','lider_jovens','lider_casais','lider_infantil','lider_louvor');
create type delegation_module as enum ('financeiro','pessoas','governanca');
create type delegation_status as enum ('ativo','revogado','expirado');
create type delegation_scope as enum ('nacional','local');

create table public.states (id uuid primary key default gen_random_uuid(), name text);
create table public.nucleos (id uuid primary key default gen_random_uuid(), name text, state_id uuid references public.states(id));
create table public.districts (id uuid primary key default gen_random_uuid(), name text, nucleo_id uuid references public.nucleos(id));
create table public.sectors (id uuid primary key default gen_random_uuid(), name text, district_id uuid references public.districts(id));

create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type church_type,
  parent_id uuid,
  sector_id uuid references public.sectors(id),
  slug text,
  logo_url text,
  is_active boolean not null default true,
  status_admin text default 'ativa',
  parent_level text,
  parent_territorial_id uuid
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  role user_role not null default 'membro',
  church_id uuid references public.churches(id),
  scope_level scope_level,
  scope_id uuid,
  full_name text,
  email text,
  phone text
);

create table public.life_groups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references public.churches(id),
  name text,
  leader_id uuid references public.profiles(id)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id),
  full_name text,
  email text,
  phone text,
  life_group_id uuid references public.life_groups(id),
  church_id uuid references public.churches(id),
  journey_stage journey_stage,
  status text default 'ativo',
  joined_at timestamptz
);

create table public.meeting_reports (
  id uuid primary key default gen_random_uuid(),
  life_group_id uuid references public.life_groups(id)
);

create table public.ministries (id uuid primary key default gen_random_uuid(), name text);
create table public.ministry_members (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid references public.ministries(id),
  profile_id uuid references public.profiles(id),
  role text,
  unique (ministry_id, profile_id)
);

create table public.discipleship (
  id uuid primary key default gen_random_uuid(),
  discipler_id uuid references public.profiles(id),
  disciple_id uuid references public.profiles(id),
  status text,
  started_on date,
  unique (discipler_id, disciple_id)
);

create table public.invite_links (
  id uuid primary key default gen_random_uuid(),
  token text unique,
  kind invite_link_kind,
  church_id uuid references public.churches(id),
  district_id uuid references public.districts(id),
  area_id uuid,
  sector_id uuid references public.sectors(id),
  life_group_id uuid references public.life_groups(id),
  ministry_id uuid references public.ministries(id),
  target_role user_role default 'membro',
  discipler_id uuid references public.profiles(id),
  expires_at timestamptz,
  max_uses int,
  uses_count int not null default 0,
  allowed_ip_cidr text,
  scope_level scope_level,
  scope_id uuid,
  created_by uuid references public.profiles(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.invite_link_uses (
  id uuid primary key default gen_random_uuid(),
  invite_link_id uuid references public.invite_links(id),
  used_by uuid,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.module_delegations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id),
  module delegation_module,
  status delegation_status,
  expires_at timestamptz,
  scope delegation_scope,
  scope_id uuid,
  scope_exceptions uuid[],
  propagates_to_subordinates boolean default false
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique,
  module delegation_module
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text,
  entity text,
  entity_id uuid,
  created_at timestamptz not null default now()
);

-- stubs de funções auxiliares já existentes no projeto (fora do escopo do rename)
create or replace function public.is_apostle() returns boolean
language sql stable as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'apostolo'); $$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.is_apostle(); $$;

create or replace function public.audit_log(p_action text, p_entity text, p_entity_id uuid, p_meta jsonb default null)
returns void language sql as $$ insert into public.audit_logs(action, entity, entity_id) values (p_action, p_entity, p_entity_id); $$;

create or replace function public.assign_leadership(
  p_profile_id uuid, p_function leadership_function, p_church_id uuid,
  p_scope_level scope_level, p_scope_id uuid, p_ministry_id uuid, p_life_group_id uuid,
  p_start_date date, p_reason text
) returns void language sql as $$ select 1; $$;

create or replace function public.delegation_effective_permissions(p_delegation_id uuid)
returns text[] language sql stable as $$ select array[]::text[]; $$;

