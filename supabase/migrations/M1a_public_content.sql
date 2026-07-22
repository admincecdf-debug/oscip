-- ============================================================
-- CEC FAMILY — M1a: Conteudo publico + formularios
-- Tabelas: news, public_prayer_requests, visit_requests
-- Atualizacao: daily_words.prayer
-- Funcao: get_pending_counts() para badges
-- Idempotente.
-- ============================================================

-- ---------- 1) DAILY_WORDS: adicionar campo prayer ----------
alter table public.daily_words add column if not exists prayer text;

-- ---------- 2) NEWS (noticias com categorias) ----------
do $$ begin
  create type news_category as enum ('minha_comunidade','cec_manaus','cec_brasilia','geral');
exception when duplicate_object then null; end $$;

create table if not exists public.news (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  category    news_category not null default 'geral',
  title       text not null,
  summary     text,
  body        text,
  cover_url   text,
  author_name text,
  church_id   uuid references public.churches(id) on delete set null,
  is_published boolean not null default false,
  published_at timestamptz,
  -- SEO
  meta_title       text,
  meta_description text,
  og_image_url     text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_news_category    on public.news(category);
create index if not exists idx_news_published   on public.news(is_published, published_at desc);

drop trigger if exists trg_news_updated on public.news;
create trigger trg_news_updated before update on public.news
  for each row execute function public.set_updated_at();

alter table public.news enable row level security;

drop policy if exists news_public_read on public.news;
create policy news_public_read on public.news for select to anon
  using (is_published and (published_at is null or published_at <= now()));

drop policy if exists news_select on public.news;
create policy news_select on public.news for select to authenticated using (true);

drop policy if exists news_write on public.news;
create policy news_write on public.news for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- 3) PUBLIC_PRAYER_REQUESTS (form publico sem login) ----------
do $$ begin
  create type contact_status as enum ('novo','em_andamento','concluido','spam');
exception when duplicate_object then null; end $$;

create table if not exists public.public_prayer_requests (
  id        uuid primary key default gen_random_uuid(),
  full_name text not null,
  email     text,
  phone     text,
  city      text,
  request   text not null,
  status    contact_status not null default 'novo',
  -- anti-spam: honeypot que NUNCA deve vir preenchido
  honeypot  text,
  assigned_to uuid references public.profiles(id) on delete set null,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ppr_status on public.public_prayer_requests(status, created_at desc);

drop trigger if exists trg_ppr_updated on public.public_prayer_requests;
create trigger trg_ppr_updated before update on public.public_prayer_requests
  for each row execute function public.set_updated_at();

alter table public.public_prayer_requests enable row level security;

-- ANON pode INSERIR (formulario publico), mas honeypot deve estar vazio
drop policy if exists ppr_public_insert on public.public_prayer_requests;
create policy ppr_public_insert on public.public_prayer_requests for insert to anon
  with check (honeypot is null or honeypot = '');

-- ANON NAO pode ler (privacidade)
-- Admin/pastor le e gerencia
drop policy if exists ppr_admin_all on public.public_prayer_requests;
create policy ppr_admin_all on public.public_prayer_requests for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- 4) VISIT_REQUESTS (quero ser visitado) ----------
create table if not exists public.visit_requests (
  id        uuid primary key default gen_random_uuid(),
  full_name text not null,
  email     text,
  phone     text not null,
  city      text,
  address   text,
  best_time text,
  reason    text,
  status    contact_status not null default 'novo',
  honeypot  text,
  assigned_to uuid references public.profiles(id) on delete set null,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_vr_status on public.visit_requests(status, created_at desc);

drop trigger if exists trg_vr_updated on public.visit_requests;
create trigger trg_vr_updated before update on public.visit_requests
  for each row execute function public.set_updated_at();

alter table public.visit_requests enable row level security;

drop policy if exists vr_public_insert on public.visit_requests;
create policy vr_public_insert on public.visit_requests for insert to anon
  with check (honeypot is null or honeypot = '');

drop policy if exists vr_admin_all on public.visit_requests;
create policy vr_admin_all on public.visit_requests for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- 5) FUNCAO de contagem para badges no admin ----------
create or replace function public.get_pending_counts()
returns table(prayer_pending bigint, visit_pending bigint)
language sql stable security definer set search_path=public as $$
  select
    (select count(*) from public.public_prayer_requests where status = 'novo') as prayer_pending,
    (select count(*) from public.visit_requests          where status = 'novo') as visit_pending;
$$;

-- ---------- 6) Seed: 1 noticia exemplo (so se nao houver) ----------
insert into public.news (slug, category, title, summary, body, is_published, published_at, meta_title, meta_description)
select
  'bem-vindo-ao-cec-family',
  'cec_manaus',
  'Bem-vindo ao CEC Family',
  'A nova plataforma digital da nossa comunidade ja esta no ar.',
  'Estamos felizes em apresentar a voce o CEC Family, nossa plataforma apostolica de discipulado e governo pastoral.',
  true, now(),
  'Bem-vindo ao CEC Family | CEC Manaus',
  'Conheca a nova plataforma digital da CEC Manaus para discipulado, celulas e gestao pastoral.'
where not exists (select 1 from public.news);
