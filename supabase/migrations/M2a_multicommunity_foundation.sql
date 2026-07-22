-- ============================================================
-- CEC FAMILY — M2a: Fundacao multicomunidade
-- - Expande `churches` (slug, pastor_id, logo_url, banner_url, cores)
-- - Garante `church_id` em news, banners, daily_words
-- - Cadastra CEC Brasilia como segunda comunidade
-- - Funcao auxiliar para resolver comunidade por slug
-- Idempotente.
-- ============================================================

-- ---------- 1) CHURCHES: campos novos ----------
alter table public.churches add column if not exists slug            text;
alter table public.churches add column if not exists pastor_id       uuid references public.profiles(id) on delete set null;
alter table public.churches add column if not exists logo_url        text;
alter table public.churches add column if not exists banner_url      text;
alter table public.churches add column if not exists primary_color   text;     -- ex: '#0E2A47'
alter table public.churches add column if not exists secondary_color text;     -- ex: '#C9A227'
alter table public.churches add column if not exists short_description text;
alter table public.churches add column if not exists site_url        text;
alter table public.churches add column if not exists whatsapp_phone  text;

-- unique no slug, mas so quando preenchido
create unique index if not exists ux_churches_slug
  on public.churches(slug) where slug is not null;

-- Preenche slug das igrejas existentes (so se ainda for null)
update public.churches set slug = 'manaus'
 where slug is null and name = 'CEC Manaus - Sede';

-- ---------- 2) Garantir church_id em conteudos publicos ----------
-- daily_words pode existir sem church_id, vamos adicionar
alter table public.daily_words add column if not exists church_id uuid references public.churches(id) on delete set null;
create index if not exists idx_daily_words_church on public.daily_words(church_id);

-- banners ainda nao tem church_id, adiciona como NULL = global
alter table public.banners add column if not exists church_id uuid references public.churches(id) on delete set null;
create index if not exists idx_banners_church on public.banners(church_id);

-- ---------- 3) Cadastrar CEC Brasilia (so se nao existir) ----------
insert into public.churches (
  name, type, parent_id, slug, address, city, state, is_active,
  short_description, primary_color, secondary_color
)
select
  'CEC Brasilia', 'sede', null, 'brasilia',
  null, 'Brasilia', 'DF', true,
  'Comunidade Evangelica Crista de Brasilia',
  '#0E2A47', '#C9A227'
where not exists (select 1 from public.churches where slug = 'brasilia');

-- ---------- 4) Funcao auxiliar: resolver comunidade por slug ----------
create or replace function public.get_community_by_slug(p_slug text)
returns public.churches
language sql stable security definer set search_path=public as $$
  select * from public.churches
  where is_active and slug = p_slug
  limit 1;
$$;

-- ---------- 5) RLS: leitura publica das igrejas com slug ----------
-- A pagina publica precisa ler churches anonimamente (so as ativas).
drop policy if exists churches_public_read on public.churches;
create policy churches_public_read on public.churches for select to anon
  using (is_active);
