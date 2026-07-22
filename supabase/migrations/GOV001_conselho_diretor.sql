-- ============================================================
-- CEC FAMILY — Governança: Conselho Diretor + Delegação de Módulos
--
-- O frontend (DelegationsAdmin.tsx, src/services/delegations.ts)
-- já existe e é rico (Pendentes/Ativas/Conselho/Emergencial/
-- Compliance/Solicitar) — mas o banco nunca tinha sido criado.
-- Reconstruído aqui a partir do contrato exato que o frontend usa.
--
-- Módulos cobertos (10 no total — 6 originais + 4 novos, por
-- decisão do cliente de expandir este mesmo sistema em vez de criar
-- um separado):
--   intelligence, reports, control_tower, finance, patrimony, audit,
--   administrativo, comunicacao, documentacao, supervisao
-- ============================================================

do $$ begin
  create type delegation_module as enum (
    'intelligence','reports','control_tower','finance','patrimony','audit',
    'administrativo','comunicacao','documentacao','supervisao'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type delegation_scope as enum ('lg','setor','area','distrito','nucleo','sede','nacional');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delegation_status as enum ('pendente','ativo','rejeitado','revogado','expirado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type council_vote as enum ('aprovado','reprovado','abstencao');
exception when duplicate_object then null; end $$;

create table if not exists public.council_members (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  cargo       text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id)
);

create table if not exists public.module_delegations (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  module            delegation_module not null,
  trust_level       int not null default 1 check (trust_level between 1 and 5),
  scope             delegation_scope not null default 'sede',
  scope_id          uuid,
  scope_name        text not null default '',
  status            delegation_status not null default 'pendente',
  expires_at        timestamptz,
  requested_by      uuid references public.profiles(id) on delete set null,
  requested_at      timestamptz not null default now(),
  request_reason    text not null default '',
  is_critical       boolean not null default false,
  council_pauta     boolean not null default false,
  council_pauta_at  timestamptz,
  reviewed_by       uuid references public.profiles(id) on delete set null,
  reviewed_at       timestamptz,
  review_notes      text,
  revoked_by        uuid references public.profiles(id) on delete set null,
  revoked_at        timestamptz,
  revoke_reason     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create or replace function public.touch_module_delegations_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists trg_module_delegations_touch on public.module_delegations;
create trigger trg_module_delegations_touch before update on public.module_delegations
  for each row execute function public.touch_module_delegations_updated_at();

create or replace function public.default_is_critical()
returns trigger language plpgsql as $$
begin
  if new.is_critical is null or new.is_critical = false then
    new.is_critical := new.module in ('finance','patrimony','audit')
      or (new.module = 'administrativo' and new.scope in ('nacional','sede'));
  end if;
  return new;
end; $$;

drop trigger if exists trg_module_delegations_critical on public.module_delegations;
create trigger trg_module_delegations_critical before insert on public.module_delegations
  for each row execute function public.default_is_critical();

create index if not exists idx_module_delegations_profile on public.module_delegations(profile_id);
create index if not exists idx_module_delegations_status on public.module_delegations(status);

create table if not exists public.delegation_approvals (
  id            uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references public.module_delegations(id) on delete cascade,
  director_id   uuid not null references public.profiles(id) on delete cascade,
  vote          council_vote not null,
  observation   text,
  created_at    timestamptz not null default now(),
  unique (delegation_id, director_id)
);

create table if not exists public.role_delegations (
  id           uuid primary key default gen_random_uuid(),
  role_name    text not null,
  module       delegation_module not null,
  trust_level  int not null default 1 check (trust_level between 1 and 5),
  scope        text not null default 'sede',
  description  text,
  is_active    boolean not null default true,
  unique (role_name, module)
);

create table if not exists public.emergency_access (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  module       delegation_module not null,
  reason       text not null,
  approved_by  uuid references public.profiles(id) on delete set null,
  starts_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  is_active    boolean not null default true
);

alter table public.council_members enable row level security;
alter table public.module_delegations enable row level security;
alter table public.delegation_approvals enable row level security;
alter table public.role_delegations enable row level security;
alter table public.emergency_access enable row level security;

drop policy if exists council_members_read on public.council_members;
create policy council_members_read on public.council_members for select to authenticated using (true);
drop policy if exists council_members_write on public.council_members;
create policy council_members_write on public.council_members for all to authenticated
  using (public.is_apostle()) with check (public.is_apostle());

drop policy if exists module_delegations_read on public.module_delegations;
create policy module_delegations_read on public.module_delegations for select to authenticated
  using (
    profile_id = auth.uid() or public.is_apostle()
    or exists (select 1 from public.council_members cm where cm.profile_id = auth.uid() and cm.is_active)
  );
drop policy if exists module_delegations_insert on public.module_delegations;
create policy module_delegations_insert on public.module_delegations for insert to authenticated
  with check (profile_id = auth.uid() or public.is_apostle());
drop policy if exists module_delegations_update on public.module_delegations;
create policy module_delegations_update on public.module_delegations for update to authenticated
  using (
    public.is_apostle()
    or exists (select 1 from public.council_members cm where cm.profile_id = auth.uid() and cm.is_active)
  );

drop policy if exists delegation_approvals_read on public.delegation_approvals;
create policy delegation_approvals_read on public.delegation_approvals for select to authenticated using (true);
drop policy if exists delegation_approvals_write on public.delegation_approvals;
create policy delegation_approvals_write on public.delegation_approvals for all to authenticated
  using (
    director_id = auth.uid()
    and exists (select 1 from public.council_members cm where cm.profile_id = auth.uid() and cm.is_active)
  )
  with check (director_id = auth.uid());

drop policy if exists role_delegations_read on public.role_delegations;
create policy role_delegations_read on public.role_delegations for select to authenticated using (true);
drop policy if exists role_delegations_write on public.role_delegations;
create policy role_delegations_write on public.role_delegations for all to authenticated
  using (public.is_apostle()) with check (public.is_apostle());

drop policy if exists emergency_access_read on public.emergency_access;
create policy emergency_access_read on public.emergency_access for select to authenticated
  using (profile_id = auth.uid() or public.is_apostle());
drop policy if exists emergency_access_write on public.emergency_access;
create policy emergency_access_write on public.emergency_access for all to authenticated
  using (public.is_apostle()) with check (public.is_apostle());

grant select, insert, update on public.module_delegations to authenticated;
grant select on public.council_members, public.role_delegations to authenticated;
grant select, insert, update on public.delegation_approvals to authenticated;
grant select, insert, update on public.emergency_access to authenticated;

create or replace view public.delegation_panel as
select
  d.*,
  p.full_name as profile_name, p.email as profile_email, p.role::text as profile_role,
  p.church_id as profile_church_id, ch.name as profile_church_name,
  rb.full_name as requested_by_name,
  rv.full_name as reviewed_by_name,
  rk.full_name as revoked_by_name,
  coalesce((select count(*) from public.delegation_approvals a where a.delegation_id = d.id and a.vote = 'aprovado'), 0) as votes_yes,
  coalesce((select count(*) from public.delegation_approvals a where a.delegation_id = d.id and a.vote = 'reprovado'), 0) as votes_no,
  coalesce((select count(*) from public.delegation_approvals a where a.delegation_id = d.id and a.vote = 'abstencao'), 0) as votes_abstain,
  coalesce((select count(*) from public.delegation_approvals a where a.delegation_id = d.id), 0) as votes_total,
  case when d.expires_at is not null then greatest(0, extract(day from d.expires_at - now())::int) else null end as days_remaining
from public.module_delegations d
left join public.profiles p on p.id = d.profile_id
left join public.churches ch on ch.id = p.church_id
left join public.profiles rb on rb.id = d.requested_by
left join public.profiles rv on rv.id = d.reviewed_by
left join public.profiles rk on rk.id = d.revoked_by;

grant select on public.delegation_panel to authenticated;

create or replace view public.compliance_dashboard as
select
  count(*)::int as total_delegacoes,
  count(*) filter (where status = 'ativo')::int as ativas,
  count(*) filter (where status = 'pendente')::int as pendentes,
  count(*) filter (where status = 'expirado')::int as expiradas,
  count(*) filter (where status = 'revogado')::int as revogadas,
  count(*) filter (where status = 'ativo' and expires_at is not null and expires_at <= now() + interval '7 days')::int as vencendo_7d,
  count(*) filter (where status = 'ativo' and expires_at is not null and expires_at <= now() + interval '15 days')::int as vencendo_15d,
  count(*) filter (where status = 'ativo' and expires_at is not null and expires_at <= now() + interval '30 days')::int as vencendo_30d,
  count(*) filter (where status = 'ativo' and expires_at is null)::int as permanentes,
  count(*) filter (where status = 'ativo' and is_critical)::int as criticas_ativas,
  count(*) filter (where trust_level >= 4)::int as nivel_estrategico,
  count(*) filter (where council_pauta and status = 'pendente')::int as aguardando_conselho
from public.module_delegations;

grant select on public.compliance_dashboard to authenticated;

create or replace view public.module_delegation_ranking as
select
  module,
  count(*) filter (where status = 'ativo')::int as delegacoes_ativas,
  count(*) filter (where status = 'pendente')::int as pendentes,
  count(*)::int as total_historico,
  coalesce(avg(trust_level) filter (where status = 'ativo'), 0)::numeric(4,2) as nivel_medio
from public.module_delegations
group by module;

grant select on public.module_delegation_ranking to authenticated;

create or replace view public.active_emergency_access as
select ea.*, p.full_name as profile_name, p.email as profile_email
from public.emergency_access ea
left join public.profiles p on p.id = ea.profile_id
where ea.is_active and now() between ea.starts_at and ea.expires_at;

grant select on public.active_emergency_access to authenticated;

create or replace function public.has_module_access(p_profile_id uuid, p_module delegation_module)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_is_apostle boolean;
begin
  select role = 'apostolo' into v_is_apostle from public.profiles where id = p_profile_id;
  if v_is_apostle then return true; end if;

  if exists (
    select 1 from public.module_delegations
    where profile_id = p_profile_id and module = p_module and status = 'ativo'
      and (expires_at is null or expires_at > now())
  ) then return true; end if;

  if exists (
    select 1 from public.active_emergency_access
    where profile_id = p_profile_id and module = p_module
  ) then return true; end if;

  return false;
end; $$;
grant execute on function public.has_module_access(uuid, delegation_module) to authenticated;

create or replace function public.expire_delegations()
returns void
language sql security definer set search_path = public as $$
  update public.module_delegations
  set status = 'expirado'
  where status = 'ativo' and expires_at is not null and expires_at <= now();
$$;
grant execute on function public.expire_delegations() to authenticated;
