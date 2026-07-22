-- ============================================================
-- CEC FAMILY — Ministérios
-- Tabelas: ministries, ministry_members (N:N), ministry_posts
-- + Seed padrão (7 ministérios por igreja existente)
-- Idempotente.
-- ============================================================

-- ---------- 1) Enum: papel no ministério ----------
do $$ begin
  create type ministry_role as enum ('lider', 'vice', 'membro');
exception when duplicate_object then null; end $$;

-- ---------- 2) Tabela ministries ----------
create table if not exists public.ministries (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches(id) on delete cascade,
  name            text not null,
  slug            text,
  description     text,
  leader_id       uuid references public.profiles(id) on delete set null,
  vice_leader_id  uuid references public.profiles(id) on delete set null,
  color           text default '#C9A227',
  icon            text default 'sparkles',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_ministries_church on public.ministries(church_id);
create unique index if not exists ux_ministries_church_slug on public.ministries(church_id, slug) where slug is not null;

drop trigger if exists trg_ministries_updated on public.ministries;
create trigger trg_ministries_updated before update on public.ministries
  for each row execute function public.set_updated_at();

alter table public.ministries enable row level security;

-- Leitura aberta (autenticados): qualquer membro vê os ministérios da igreja dele
-- A página pública também pode listar (sem dados sensíveis)
drop policy if exists ministries_public_read on public.ministries;
create policy ministries_public_read on public.ministries for select to anon
  using (is_active);

drop policy if exists ministries_select on public.ministries;
create policy ministries_select on public.ministries for select to authenticated using (true);

drop policy if exists ministries_write on public.ministries;
create policy ministries_write on public.ministries for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- 3) Tabela ministry_members (N:N) ----------
create table if not exists public.ministry_members (
  id           uuid primary key default gen_random_uuid(),
  ministry_id  uuid not null references public.ministries(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  role         ministry_role not null default 'membro',
  joined_at    date not null default current_date,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create unique index if not exists ux_ministry_members_unique
  on public.ministry_members(ministry_id, member_id);
create index if not exists idx_mm_member on public.ministry_members(member_id);
create index if not exists idx_mm_ministry on public.ministry_members(ministry_id);

alter table public.ministry_members enable row level security;

-- Membro vê suas próprias vinculações
drop policy if exists mm_self_select on public.ministry_members;
create policy mm_self_select on public.ministry_members for select to authenticated
  using (
    member_id in (select id from public.members where profile_id = auth.uid())
    or is_admin()
  );

-- Admin gerencia (criar/editar/apagar vinculações)
drop policy if exists mm_admin_write on public.ministry_members;
create policy mm_admin_write on public.ministry_members for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- 4) Tabela ministry_posts (notícias do ministério) ----------
create table if not exists public.ministry_posts (
  id            uuid primary key default gen_random_uuid(),
  ministry_id   uuid not null references public.ministries(id) on delete cascade,
  author_id     uuid references public.profiles(id) on delete set null,
  title         text not null,
  body          text,
  cover_url     text,
  is_published  boolean not null default true,
  published_at  timestamptz default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_mp_ministry on public.ministry_posts(ministry_id, published_at desc);

drop trigger if exists trg_mp_updated on public.ministry_posts;
create trigger trg_mp_updated before update on public.ministry_posts
  for each row execute function public.set_updated_at();

alter table public.ministry_posts enable row level security;

-- Membro vê posts dos ministérios em que está vinculado (ativo)
-- Admin vê tudo
drop policy if exists mp_member_select on public.ministry_posts;
create policy mp_member_select on public.ministry_posts for select to authenticated
  using (
    is_admin()
    or ministry_id in (
      select mm.ministry_id
      from public.ministry_members mm
      join public.members m on m.id = mm.member_id
      where m.profile_id = auth.uid() and mm.is_active = true
    )
  );

-- Admin (apóstolo, pastor) cria/edita/apaga posts
drop policy if exists mp_admin_write on public.ministry_posts;
create policy mp_admin_write on public.ministry_posts for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- 5) Função helper: listar ministérios do membro logado ----------
create or replace function public.my_ministries()
returns setof public.ministries
language sql stable security definer set search_path = public as $$
  select ms.* from public.ministries ms
  join public.ministry_members mm on mm.ministry_id = ms.id
  join public.members m on m.id = mm.member_id
  where m.profile_id = auth.uid()
    and mm.is_active = true
    and ms.is_active = true;
$$;
grant execute on function public.my_ministries() to authenticated;

-- ---------- 6) Seed: 7 ministérios padrão para cada igreja ativa ----------
-- Insere apenas se não houver nenhum ministério para a igreja ainda
do $$
declare ch record;
begin
  for ch in select id from public.churches where is_active loop
    if not exists (select 1 from public.ministries where church_id = ch.id) then
      insert into public.ministries (church_id, name, slug, description, color, icon) values
        (ch.id, 'Jovens e Adolescentes', 'jovens',      'Ministério com foco na nova geração', '#3B82F6', 'flame'),
        (ch.id, 'Louvor e Adoração',     'louvor',      'Equipe de ministração e música',      '#A855F7', 'music'),
        (ch.id, 'Dança',                 'danca',       'Ministério de dança e expressão',     '#EC4899', 'sparkles'),
        (ch.id, 'Mulheres de Valor',     'mulheres',    'Ministério feminino',                 '#F59E0B', 'flower'),
        (ch.id, 'Intercessão',           'intercessao', 'Ministério de oração e intercessão',  '#0EA5E9', 'praying-hands'),
        (ch.id, 'Ação Social',           'acao-social', 'Atendimento e ações comunitárias',    '#10B981', 'hand-helping'),
        (ch.id, 'Casais',                'casais',      'Ministério familiar',                 '#EF4444', 'heart');
    end if;
  end loop;
end $$;
