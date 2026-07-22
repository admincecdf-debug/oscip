-- ============================================================
-- CEC FAMILY — M1b: Hero Carousel + Filtros geo + Agenda categorizada
-- Tabelas/colunas: banners, life_groups(state/city/neighborhood), events.event_type
-- Funcao: get_active_banners()
-- Idempotente.
-- ============================================================

-- ---------- 1) BANNERS (Hero Carousel publico) ----------
create table if not exists public.banners (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text,
  image_url   text,
  cta_label   text,
  cta_url     text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  starts_at   timestamptz,                  -- opcional: aparece a partir
  ends_at     timestamptz,                  -- opcional: some apos
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_banners_active on public.banners(is_active, sort_order);

drop trigger if exists trg_banners_updated on public.banners;
create trigger trg_banners_updated before update on public.banners
  for each row execute function public.set_updated_at();

alter table public.banners enable row level security;

-- leitura publica (anon) para banners ativos e dentro do periodo
drop policy if exists banners_public_read on public.banners;
create policy banners_public_read on public.banners for select to anon
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );

-- leitura autenticada (admin ve TUDO; outros so ativos)
drop policy if exists banners_select on public.banners;
create policy banners_select on public.banners for select to authenticated using (true);

drop policy if exists banners_write on public.banners;
create policy banners_write on public.banners for all to authenticated
  using (is_admin()) with check (is_admin());

-- Funcao auxiliar (para uso opcional)
create or replace function public.get_active_banners()
returns setof public.banners
language sql stable security definer set search_path=public as $$
  select * from public.banners
  where is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  order by sort_order asc, created_at desc;
$$;

-- ---------- 2) LIFE_GROUPS: campos geo estruturados ----------
alter table public.life_groups add column if not exists state         text;
alter table public.life_groups add column if not exists city          text;
alter table public.life_groups add column if not exists neighborhood  text;

create index if not exists idx_life_groups_city         on public.life_groups(city);
create index if not exists idx_life_groups_neighborhood on public.life_groups(neighborhood);

-- ---------- 3) EVENTS: categorizacao ----------
do $$ begin
  create type event_type as enum (
    'culto', 'congresso', 'conferencia', 'encontro', 'ebd', 'outro'
  );
exception when duplicate_object then null; end $$;

alter table public.events add column if not exists event_type event_type default 'outro';

create index if not exists idx_events_type on public.events(event_type);
