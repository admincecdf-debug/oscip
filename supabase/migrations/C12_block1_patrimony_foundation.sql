-- ============================================================
-- CEC FAMILY — Caderno 12 Bloco 1: Fundação Patrimonial
-- - Tabelas: properties, assets, property_documents, asset_documents, asset_photos
-- - Enums: occupation_type, asset_category, asset_condition, asset_origin
-- - Supabase Storage bucket: patrimonio
-- - RLS reusa accessible_church_ids() do C13c
-- Idempotente.
-- ============================================================

-- ---------- 1) Enums ----------
do $$ begin
  create type occupation_type as enum ('proprio', 'alugado', 'cedido', 'comodato', 'em_regularizacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_category as enum ('mobiliario', 'equipamentos', 'som_multimidia', 'infraestrutura', 'nao_duravel');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_condition as enum ('novo', 'otimo', 'bom', 'regular', 'ruim', 'inutilizado', 'baixado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_origin as enum ('compra_nf', 'doacao', 'sem_nf', 'transferencia', 'comodato', 'outro');
exception when duplicate_object then null; end $$;

-- ---------- 2) Tabela properties (imóveis) ----------
create table if not exists public.properties (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches(id) on delete restrict,
  name            text not null,
  occupation_type occupation_type not null default 'proprio',
  -- Endereço estruturado
  cep             text,
  state           text,
  city            text,
  neighborhood    text,
  address         text,
  numero          text,
  complemento     text,
  latitude        double precision,
  longitude       double precision,
  -- Datas e prazos
  acquired_at     date,
  contract_end_at date,
  iptu_due_at     date,
  -- Doc do proprietário (se alugado/comodato)
  owner_name      text,
  owner_document  text,
  owner_phone     text,
  observations    text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_properties_church on public.properties(church_id);
create index if not exists idx_properties_contract on public.properties(contract_end_at) where contract_end_at is not null;

drop trigger if exists trg_properties_updated on public.properties;
create trigger trg_properties_updated before update on public.properties
  for each row execute function public.set_updated_at();

alter table public.properties enable row level security;

drop policy if exists properties_scoped on public.properties;
create policy properties_scoped on public.properties for all to authenticated
  using (church_id in (select public.accessible_church_ids()))
  with check (church_id in (select public.accessible_church_ids()));

-- ---------- 3) Tabela assets (bens) ----------
create table if not exists public.assets (
  id                uuid primary key default gen_random_uuid(),
  church_id         uuid not null references public.churches(id) on delete restrict,
  property_id       uuid references public.properties(id) on delete set null,
  patrimony_code    text,
  tag_number        text,
  name              text not null,
  category          asset_category not null,
  subcategory       text,
  description       text,
  manufacturer      text,
  model             text,
  serial_number     text,
  responsible_id    uuid references public.profiles(id) on delete set null,
  location_text     text,
  acquired_at       date,
  acquisition_value numeric(12,2),
  origin            asset_origin default 'outro',
  condition         asset_condition not null default 'bom',
  is_durable        boolean not null default true,
  is_active         boolean not null default true,
  observations      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_assets_church on public.assets(church_id);
create index if not exists idx_assets_property on public.assets(property_id);
create index if not exists idx_assets_category on public.assets(category);
create unique index if not exists ux_assets_patrimony_code on public.assets(church_id, patrimony_code)
  where patrimony_code is not null;

drop trigger if exists trg_assets_updated on public.assets;
create trigger trg_assets_updated before update on public.assets
  for each row execute function public.set_updated_at();

alter table public.assets enable row level security;

drop policy if exists assets_scoped on public.assets;
create policy assets_scoped on public.assets for all to authenticated
  using (church_id in (select public.accessible_church_ids()))
  with check (church_id in (select public.accessible_church_ids()));

-- ---------- 4) Tabela property_documents ----------
create table if not exists public.property_documents (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  doc_type     text not null,
  title        text not null,
  storage_path text,
  size_bytes   bigint,
  mime_type    text,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  uploaded_at  timestamptz not null default now(),
  observations text
);

create index if not exists idx_pd_property on public.property_documents(property_id);

alter table public.property_documents enable row level security;

drop policy if exists property_documents_scoped on public.property_documents;
create policy property_documents_scoped on public.property_documents for all to authenticated
  using (
    property_id in (
      select id from public.properties where church_id in (select public.accessible_church_ids())
    )
  )
  with check (
    property_id in (
      select id from public.properties where church_id in (select public.accessible_church_ids())
    )
  );

-- ---------- 5) Tabela asset_documents ----------
create table if not exists public.asset_documents (
  id           uuid primary key default gen_random_uuid(),
  asset_id     uuid not null references public.assets(id) on delete cascade,
  doc_type     text not null,
  title        text not null,
  storage_path text,
  size_bytes   bigint,
  mime_type    text,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  uploaded_at  timestamptz not null default now(),
  observations text
);

create index if not exists idx_ad_asset on public.asset_documents(asset_id);

alter table public.asset_documents enable row level security;

drop policy if exists asset_documents_scoped on public.asset_documents;
create policy asset_documents_scoped on public.asset_documents for all to authenticated
  using (
    asset_id in (
      select id from public.assets where church_id in (select public.accessible_church_ids())
    )
  )
  with check (
    asset_id in (
      select id from public.assets where church_id in (select public.accessible_church_ids())
    )
  );

-- ---------- 6) Tabela asset_photos (linha do tempo fotográfica) ----------
create table if not exists public.asset_photos (
  id           uuid primary key default gen_random_uuid(),
  asset_id     uuid not null references public.assets(id) on delete cascade,
  photo_year   int,
  taken_at     date,
  storage_path text not null,
  caption      text,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  uploaded_at  timestamptz not null default now()
);

create index if not exists idx_ap_asset on public.asset_photos(asset_id, photo_year);

alter table public.asset_photos enable row level security;

drop policy if exists asset_photos_scoped on public.asset_photos;
create policy asset_photos_scoped on public.asset_photos for all to authenticated
  using (
    asset_id in (
      select id from public.assets where church_id in (select public.accessible_church_ids())
    )
  )
  with check (
    asset_id in (
      select id from public.assets where church_id in (select public.accessible_church_ids())
    )
  );

-- ---------- 7) Supabase Storage: bucket "patrimonio" ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patrimonio',
  'patrimonio',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf','application/xml','text/xml','application/vnd.ms-excel']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists patrimonio_scoped_read on storage.objects;
create policy patrimonio_scoped_read on storage.objects for select to authenticated
  using (
    bucket_id = 'patrimonio'
    and (storage.foldername(name))[1]::uuid in (select public.accessible_church_ids())
  );

drop policy if exists patrimonio_scoped_write on storage.objects;
create policy patrimonio_scoped_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'patrimonio'
    and (storage.foldername(name))[1]::uuid in (select public.accessible_church_ids())
  );

drop policy if exists patrimonio_scoped_update on storage.objects;
create policy patrimonio_scoped_update on storage.objects for update to authenticated
  using (
    bucket_id = 'patrimonio'
    and (storage.foldername(name))[1]::uuid in (select public.accessible_church_ids())
  );

drop policy if exists patrimonio_scoped_delete on storage.objects;
create policy patrimonio_scoped_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'patrimonio'
    and (storage.foldername(name))[1]::uuid in (select public.accessible_church_ids())
  );

-- ---------- 8) View útil: resumo patrimonial por comunidade ----------
create or replace view public.patrimony_summary as
select
  c.id as church_id, c.name as church_name,
  (select count(*)::int from public.properties p where p.church_id = c.id and p.is_active) as properties_count,
  (select count(*)::int from public.assets a where a.church_id = c.id and a.is_active) as assets_count,
  (select coalesce(sum(acquisition_value), 0) from public.assets a where a.church_id = c.id and a.is_active) as total_acquisition_value,
  (select count(*)::int from public.properties p
    where p.church_id = c.id and p.contract_end_at is not null
      and p.contract_end_at <= current_date + 90
      and p.contract_end_at >= current_date) as contracts_expiring_90d
from public.churches c
where c.is_active;

comment on view public.patrimony_summary is 'Resumo patrimonial por comunidade — total de imóveis, bens, valor acumulado, contratos vencendo';
