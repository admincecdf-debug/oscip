-- ============================================================
-- CEC FAMILY — Quick wins Caderno Técnico 13
-- 1. Seed completo de Sedes + Núcleos (Manaus, Brasília + 16 núcleos)
-- 2. Campos novos no LG: CEP, número, complemento, status, anfitrião auxiliar
-- 3. Enum lg_status com 5 opções
-- Idempotente.
-- ============================================================

-- ---------- 1) Enum: status do Life Group ----------
do $$ begin
  create type lg_status as enum (
    'em_formacao', 'ativo', 'em_multiplicacao', 'multiplicado', 'encerrado'
  );
exception when duplicate_object then null; end $$;

-- ---------- 2) Campos novos em life_groups ----------
alter table public.life_groups
  add column if not exists cep             text,
  add column if not exists numero          text,
  add column if not exists complemento     text,
  add column if not exists status_lg       lg_status not null default 'ativo',
  add column if not exists host_assistant_id uuid references public.profiles(id) on delete set null,
  add column if not exists founded_at      date;

comment on column public.life_groups.cep is 'CEP do endereço do LG';
comment on column public.life_groups.numero is 'Número do endereço';
comment on column public.life_groups.complemento is 'Complemento (apto, bloco, etc.)';
comment on column public.life_groups.status_lg is 'Status ministerial do LG';
comment on column public.life_groups.host_assistant_id is 'Anfitrião auxiliar';
comment on column public.life_groups.founded_at is 'Data de fundação do LG';

-- ---------- 3) Seed de comunidades (Sedes + Núcleos) ----------
-- Usa slug como chave de idempotência. Repetir o SQL não duplica.

-- Backfill defensivo: gera slug a partir do nome se estiver vazio
-- (evita falha no índice unique se houver linhas antigas sem slug)
update public.churches
   set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
 where slug is null or slug = '';

-- Remove índice parcial anterior se existir (criado em tentativa anterior com WHERE).
-- ON CONFLICT precisa de constraint ou índice unique COMPLETO.
drop index if exists public.ux_churches_slug;

-- Cria constraint UNIQUE explícita (mais robusta que índice solto para ON CONFLICT).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname  = 'ux_churches_slug_uniq'
      and conrelid = 'public.churches'::regclass
  ) then
    alter table public.churches
      add constraint ux_churches_slug_uniq unique (slug);
  end if;
end $$;

-- Helper: insere ou atualiza uma comunidade
do $$
declare
  v_manaus_id   uuid;
  v_brasilia_id uuid;
begin
  -- ============================================
  -- SEDE: CEC MANAUS
  -- ============================================
  insert into public.churches (slug, name, type, state, city, is_active)
  values ('cec-manaus', 'CEC Manaus', 'sede', 'AM', 'Manaus', true)
  on conflict (slug) do update set
    name = excluded.name, type = excluded.type, state = excluded.state, city = excluded.city, is_active = true
  returning id into v_manaus_id;

  -- Se já existia antes (sem RETURNING capturar):
  if v_manaus_id is null then
    select id into v_manaus_id from public.churches where slug = 'cec-manaus';
  end if;

  -- NÚCLEOS de Manaus
  insert into public.churches (slug, name, type, parent_id, state, city, is_active) values
    ('cec-itacoatiara',         'CEC Itacoatiara',         'nucleo', v_manaus_id, 'AM', 'Itacoatiara', true),
    ('cec-sangaua',             'CEC Sangaua',             'nucleo', v_manaus_id, 'AM', 'Sangaua', true),
    ('cec-piorini',             'CEC Piorini',             'nucleo', v_manaus_id, 'AM', 'Piorini', true),
    ('cec-puraquequara',        'CEC Puraquequara',        'nucleo', v_manaus_id, 'AM', 'Manaus', true),
    ('cec-cidade-nova',         'CEC Cidade Nova',         'nucleo', v_manaus_id, 'AM', 'Manaus', true),
    ('cec-zona-leste',          'CEC Zona Leste',          'nucleo', v_manaus_id, 'AM', 'Manaus', true),
    ('cec-km-26',               'CEC Km 26',               'nucleo', v_manaus_id, 'AM', 'Manaus', true),
    ('cec-taruma',              'CEC Tarumã',              'nucleo', v_manaus_id, 'AM', 'Manaus', true),
    ('cec-tefe',                'CEC Tefé',                'nucleo', v_manaus_id, 'AM', 'Tefé', true),
    ('cec-colonia-boa-ventura', 'CEC Colônia Boa Ventura', 'nucleo', v_manaus_id, 'AM', 'Manaus', true),
    ('cec-iranduba-4',          'CEC Iranduba 4',          'nucleo', v_manaus_id, 'AM', 'Iranduba', true)
  on conflict (slug) do update set
    name = excluded.name, type = excluded.type, parent_id = excluded.parent_id,
    state = excluded.state, city = excluded.city, is_active = true;

  -- ============================================
  -- SEDE: CEC BRASÍLIA
  -- ============================================
  insert into public.churches (slug, name, type, state, city, is_active)
  values ('cec-brasilia', 'CEC Brasília', 'sede', 'DF', 'Brasília', true)
  on conflict (slug) do update set
    name = excluded.name, type = excluded.type, state = excluded.state, city = excluded.city, is_active = true
  returning id into v_brasilia_id;

  if v_brasilia_id is null then
    select id into v_brasilia_id from public.churches where slug = 'cec-brasilia';
  end if;

  -- NÚCLEOS de Brasília (inclui Cascavel e Joinville — vinculados ministerialmente)
  insert into public.churches (slug, name, type, parent_id, state, city, is_active) values
    ('cec-brasilia-centro', 'CEC Brasília (Núcleo)', 'nucleo', v_brasilia_id, 'DF', 'Brasília', true),
    ('cec-aguas-claras',    'CEC Águas Claras',      'nucleo', v_brasilia_id, 'DF', 'Águas Claras', true),
    ('cec-taguatinga',      'CEC Taguatinga',        'nucleo', v_brasilia_id, 'DF', 'Taguatinga', true),
    ('cec-padre-lucio',     'CEC Padre Lúcio',       'nucleo', v_brasilia_id, 'DF', 'Brasília', true),
    ('cec-brazlandia',      'CEC Brazlândia',        'nucleo', v_brasilia_id, 'DF', 'Brazlândia', true),
    ('cec-cascavel',        'CEC Cascavel',          'nucleo', v_brasilia_id, 'PR', 'Cascavel', true),
    ('cec-joinville',       'CEC Joinville',         'nucleo', v_brasilia_id, 'SC', 'Joinville', true)
  on conflict (slug) do update set
    name = excluded.name, type = excluded.type, parent_id = excluded.parent_id,
    state = excluded.state, city = excluded.city, is_active = true;
end $$;

-- ---------- 4) View útil: árvore de comunidades pra dashboard organizacional ----------
create or replace view public.churches_tree as
select
  c.id, c.slug, c.name, c.type, c.parent_id,
  c.state, c.city, c.is_active,
  parent.name as parent_name,
  parent.type as parent_type,
  case c.type
    when 'sede' then 0
    when 'nucleo' then 1
    when 'igreja_local' then 2
    else 3
  end as hierarchy_level
from public.churches c
left join public.churches parent on parent.id = c.parent_id;
