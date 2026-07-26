-- ============================================================
-- CEC FAMILY / APS — RENAME001
-- Passada 1 de 2 da evolução para multi-tenant (OSCs, institutos, OSCIPs).
--
-- O QUE ESTA MIGRATION FAZ:
--   1) Renomeia a tabela `churches` -> `organizations`
--   2) Renomeia TODA coluna cujo nome contenha "church" para a
--      variante equivalente com "organization" (church_id ->
--      organization_id, from_church_id -> from_organization_id,
--      church_name -> organization_name, etc.) — feito via
--      introspecção do information_schema, não uma lista manual,
--      porque parte do schema atual foi criada direto no SQL Editor
--      e não está 100% documentada nas migrations anteriores.
--   3) Cria a tabela `tenants` (uma linha por instituição contratante:
--      CEC, FAM, próxima OSC) e a coluna `organizations.tenant_id`.
--   4) Faz backfill: cria o tenant "CEC" e associa todas as
--      organizations existentes a ele, para nada quebrar.
--
-- O QUE ESTA MIGRATION *NÃO* FAZ (fica pra Passada 2):
--   - Recriar as ~37 funções PL/pgSQL que mencionam "church" no
--     corpo (accessible_church_ids, consume_invite_link, dashboards,
--     relatórios RELMDA, etc.). Renomear tabela/coluna NÃO atualiza
--     o texto dessas funções automaticamente — elas vão falhar em
--     runtime até a Passada 2 rodar. Views, FKs, índices e RLS
--     policies SIM são atualizados automaticamente pelo Postgres
--     (referência interna por posição, não por texto), então esses
--     não quebram.
--   - Resolver os dois overloads órfãos já identificados
--     (consume_invite_link de 4 parâmetros e register_checkin de
--     4 parâmetros, ambos código morto hoje) — serão consolidados
--     na Passada 2.
--
-- IMPORTANTE: aplique isto SOMENTE junto com a Passada 2 e o deploy
-- do frontend já com os nomes novos. Rodar só esta migration deixa
-- o app fora do ar até a Passada 2 ser aplicada, porque toda função
-- que hoje referencia `church_id`/`churches` vai passar a apontar
-- para colunas/tabelas que não existem mais com esses nomes.
--
-- Idempotente: pode ser executada mais de uma vez sem erro.
-- ============================================================

begin;

-- ---------- 1) Renomear a tabela principal ----------
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'churches')
     and not exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'organizations')
  then
    alter table public.churches rename to organizations;
    raise notice 'Tabela churches renomeada para organizations.';
  else
    raise notice 'Rename de churches->organizations ignorado (já aplicado ou tabela não existe).';
  end if;
end $$;

-- ---------- 2) Renomear toda coluna que contenha "church", em qualquer tabela do schema public ----------
-- Regra: substitui a substring "church" por "organization" preservando o resto do nome
-- (church_id -> organization_id, from_church_id -> from_organization_id,
--  church_name -> organization_name, church_logo_url -> organization_logo_url, etc.)
do $$
declare
  r record;
  v_new_name text;
begin
  for r in
    select c.table_schema, c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name ~ 'church'
  loop
    v_new_name := regexp_replace(r.column_name, 'church', 'organization', 'g');

    -- só renomeia se o nome de destino ainda não existir na mesma tabela
    if not exists (
      select 1 from information_schema.columns c2
      where c2.table_schema = r.table_schema
        and c2.table_name = r.table_name
        and c2.column_name = v_new_name
    ) then
      execute format(
        'alter table %I.%I rename column %I to %I;',
        r.table_schema, r.table_name, r.column_name, v_new_name
      );
      raise notice 'Coluna renomeada: %.%.% -> %', r.table_schema, r.table_name, r.column_name, v_new_name;
    end if;
  end loop;
end $$;

-- ---------- 3) Renomear tipos ENUM / domínios que contenham "church" (se existirem) ----------
do $$
declare
  r record;
  v_new_name text;
begin
  for r in
    select t.typname
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname ~ 'church'
      and t.typtype in ('e', 'd')  -- enum ou domain
  loop
    v_new_name := regexp_replace(r.typname, 'church', 'organization', 'g');
    if not exists (select 1 from pg_type where typname = v_new_name) then
      execute format('alter type public.%I rename to %I;', r.typname, v_new_name);
      raise notice 'Tipo renomeado: % -> %', r.typname, v_new_name;
    end if;
  end loop;
end $$;

-- ---------- 4) Tabela tenants ----------
create extension if not exists citext;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','SUSPENDED','INACTIVE','ARCHIVED')),
  segment text not null default 'RELIGIOUS'
    check (segment in ('RELIGIOUS','SOCIAL_OSC','INSTITUTE','OSCIP','OTHER')),
  primary_color text,
  secondary_color text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tenants_slug unique (slug)
);

-- ---------- 5) organizations.tenant_id ----------
alter table public.organizations add column if not exists tenant_id uuid references public.tenants(id) on delete restrict;

-- ---------- 6) Backfill: cria o tenant "CEC" e associa as organizations existentes ----------
insert into public.tenants (name, slug, segment, status)
select 'CEC', 'cec', 'RELIGIOUS', 'ACTIVE'
where not exists (select 1 from public.tenants where slug = 'cec');

update public.organizations
set tenant_id = (select id from public.tenants where slug = 'cec')
where tenant_id is null;

-- A partir daqui toda organization nova é obrigada a ter tenant_id
alter table public.organizations alter column tenant_id set not null;

create index if not exists idx_organizations_tenant on public.organizations(tenant_id);

-- ---------- 7) profiles.tenant_id ----------
-- Necessário porque nem todo profile aponta pra uma organization específica
-- (ex.: apóstolo com escopo nacional) — sem isso não dá pra saber com
-- segurança de qual tenant é um usuário assim.
alter table public.profiles add column if not exists tenant_id uuid references public.tenants(id) on delete restrict;

update public.profiles p
set tenant_id = coalesce(
  (select o.tenant_id from public.organizations o where o.id = p.organization_id),
  (select id from public.tenants where slug = 'cec')
)
where p.tenant_id is null;

alter table public.profiles alter column tenant_id set not null;
create index if not exists idx_profiles_tenant on public.profiles(tenant_id);

-- ---------- 8) Funções auxiliares de tenant (usadas pela Passada 2) ----------
create or replace function public.current_tenant_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;
grant execute on function public.current_tenant_id() to authenticated;

-- Verifica se uma organization pertence ao mesmo tenant do usuário logado.
-- Usada para impedir que um bypass de papel (ex.: apóstolo) vaze entre tenants.
create or replace function public.same_tenant(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_organization_id is null or exists (
    select 1 from public.organizations o
    where o.id = p_organization_id and o.tenant_id = public.current_tenant_id()
  );
$$;
grant execute on function public.same_tenant(uuid) to authenticated;

commit;

-- ============================================================
-- Checklist da Passada 2 (não incluído aqui de propósito — precisa
-- de revisão função por função antes de aplicar):
--
-- Segurança / core (prioridade alta):
--   accessible_church_ids, has_permission, get_community_by_slug,
--   resolve_church_ancestry, can_delete_church, move_church,
--   church_dependencies, church_state_name
--
-- Convites (prioridade alta, inclui consolidar overload):
--   consume_invite_link (unificar as versões de 4 e 5 parâmetros
--     em UMA só, combinando o fix de role do CT002f com a dedução
--     de organização via life group do FIX003),
--   validate_invite_token, create_invite_link, list_invite_links,
--   can_create_invite_kind
--
-- Pessoas / liderança:
--   relocate_member, assign_leadership, remanejar_lideranca,
--   sync_member_church_from_lg, member_structure_names,
--   approve_member_card
--
-- Check-in / eventos (inclui resolver overload de register_checkin):
--   checkin_lookup_by_cec_id, checkin_lookup_by_token,
--   register_checkin, cancel_event_registration
--
-- Dashboards / relatórios / inteligência (menor risco, podem ir por
-- último — são majoritariamente leitura):
--   central_pendencias, dashboard_ministerios_eventos_scoped,
--   dashboard_ministerios_ranking, intelligence_growth_by_sector,
--   intelligence_growth_overall, lgs_with_health, church_health_score,
--   church_tree_metrics, church_metrics, relmda_lg_in_scope,
--   relmda_monthly_comparison, relmda_supervisor_overview,
--   pastors_without_scope_count, suggest_life_groups_for_pipeline
-- ============================================================
