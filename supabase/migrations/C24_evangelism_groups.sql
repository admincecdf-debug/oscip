-- ============================================================
-- CEC FAMILY — C24: Grupos de Evangelismo
-- Uma célula (life_group) pode ser responsável por um ou mais
-- Grupos de Evangelismo, cada um com um ou mais responsáveis.
-- Idempotente.
-- ============================================================

-- ---------- 1) Tabela evangelism_groups ----------
create table if not exists public.evangelism_groups (
  id             uuid primary key default gen_random_uuid(),
  cell_id        uuid not null references public.life_groups(id) on delete cascade,
  name           text not null,
  address        text,
  neighborhood   text,
  city           text,
  state          text,
  meeting_weekday text,
  meeting_time   time,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.evangelism_groups is
  'Grupo de Evangelismo — subdivisão de um Life Group. Uma célula pode ter vários.';

create index if not exists idx_eg_cell on public.evangelism_groups(cell_id);

drop trigger if exists trg_eg_updated_at on public.evangelism_groups;
create trigger trg_eg_updated_at before update on public.evangelism_groups
  for each row execute function public.set_updated_at();

-- ---------- 2) Responsáveis (N para N: um grupo pode ter vários responsáveis) ----------
create table if not exists public.evangelism_group_leaders (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.evangelism_groups(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, member_id)
);

comment on table public.evangelism_group_leaders is
  'Responsáveis por um Grupo de Evangelismo (um grupo pode ter mais de um).';

create index if not exists idx_egl_group on public.evangelism_group_leaders(group_id);
create index if not exists idx_egl_member on public.evangelism_group_leaders(member_id);

-- ---------- 3) RLS ----------
alter table public.evangelism_groups enable row level security;
alter table public.evangelism_group_leaders enable row level security;

drop policy if exists eg_admin_all on public.evangelism_groups;
create policy eg_admin_all on public.evangelism_groups for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists egl_admin_all on public.evangelism_group_leaders;
create policy egl_admin_all on public.evangelism_group_leaders for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- 4) Participantes do grupo (pessoas evangelizadas, geralmente não membros) ----------
-- Reaproveita o CRM de visitantes (visitor_pipeline) que já existe, em vez de
-- criar uma tabela paralela — assim o participante já entra automaticamente
-- no funil (contato → convite LG → discipulado → batismo → membro).
alter table public.visitor_pipeline
  add column if not exists evangelism_group_id uuid references public.evangelism_groups(id) on delete set null;

comment on column public.visitor_pipeline.evangelism_group_id is
  'Preenchido quando o contato veio de um Grupo de Evangelismo específico (C24).';

create index if not exists idx_vp_evangelism_group on public.visitor_pipeline(evangelism_group_id) where evangelism_group_id is not null;
