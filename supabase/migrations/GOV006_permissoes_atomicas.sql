-- ============================================================
-- CEC FAMILY — Governança: evolução para o modelo de 4 camadas do
-- UX-003 (Perfil → Papel → Permissões atômicas → Escopo com herança).
--
-- Aditivo — não quebra o que já funciona (module-level continua
-- valendo como o "guarda-chuva" de cada delegação; permissões
-- atômicas refinam o que é permitido DENTRO do módulo).
-- ============================================================

-- ---------- Novos status: programada e concluída ----------
do $$ begin
  alter type delegation_status add value if not exists 'programada';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type delegation_status add value if not exists 'concluida';
exception when duplicate_object then null; end $$;

-- ---------- Herança de escopo (propagação pra unidades subordinadas) ----------
alter table public.module_delegations add column if not exists propagates_to_subordinates boolean not null default true;
alter table public.module_delegations add column if not exists scope_exceptions uuid[] default '{}';
comment on column public.module_delegations.propagates_to_subordinates is
  'Se true, a delegação alcança as unidades territoriais subordinadas ao escopo (ex: Distrito alcança Núcleos/Setores/Igrejas dele). Se false, vale só a unidade exata.';
comment on column public.module_delegations.scope_exceptions is
  'IDs de unidades (igrejas, setores, etc.) especificamente excluídas da propagação, mesmo estando dentro do escopo.';

-- ---------- Catálogo de Permissões atômicas ----------
create table if not exists public.permissions (
  key          text primary key,  -- ex: 'usuarios.visualizar', 'financeiro.aprovar'
  module       delegation_module not null,
  label        text not null,
  description  text,
  is_write     boolean not null default false  -- diferencia visualizar (false) de ação (true)
);

alter table public.permissions enable row level security;
drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions for select to authenticated using (true);
drop policy if exists permissions_write on public.permissions;
create policy permissions_write on public.permissions for all to authenticated
  using (is_apostle()) with check (is_apostle());
grant select on public.permissions to authenticated;

-- Catálogo inicial (exemplos do UX-003 §3.56 + extensões pros módulos já existentes)
insert into public.permissions (key, module, label, is_write) values
  ('usuarios.visualizar',   'administrativo', 'Visualizar usuários',            false),
  ('usuarios.criar',        'administrativo', 'Criar usuários',                 true),
  ('usuarios.editar',       'administrativo', 'Editar usuários',                true),
  ('usuarios.inativar',     'administrativo', 'Inativar usuários',              true),
  ('convites.criar',        'administrativo', 'Criar convites',                 true),
  ('convites.cancelar',     'administrativo', 'Cancelar convites',              true),
  ('lifegroups.visualizar', 'administrativo', 'Visualizar Life Groups',         false),
  ('lifegroups.administrar','administrativo', 'Administrar Life Groups',        true),
  ('relatorios.gerar',      'administrativo', 'Gerar relatórios',               true),
  ('relatorios.exportar',   'administrativo', 'Exportar relatórios',            true),
  ('financeiro.visualizar', 'finance',        'Visualizar dados financeiros',   false),
  ('financeiro.lancar',     'finance',        'Lançar movimentações',           true),
  ('financeiro.aprovar',    'finance',        'Aprovar movimentações',          true),
  ('financeiro.exportar',   'finance',        'Exportar dados financeiros',     true),
  ('patrimonio.visualizar', 'patrimony',      'Visualizar patrimônio',          false),
  ('patrimonio.administrar','patrimony',      'Administrar patrimônio',         true),
  ('auditoria.visualizar',  'audit',          'Visualizar auditoria',           false),
  ('supervisao.visualizar', 'supervisao',     'Visualizar relatórios de rede',  false),
  ('supervisao.validar',    'supervisao',     'Validar relatórios de LG',       true),
  ('comunicacao.publicar',  'comunicacao',    'Publicar notícias/agenda',       true),
  ('configuracoes.alterar', 'administrativo', 'Alterar configurações globais',  true)
on conflict (key) do nothing;

-- ---------- Vínculo Delegação ↔ Permissões atômicas ----------
create table if not exists public.delegation_permissions (
  id             uuid primary key default gen_random_uuid(),
  delegation_id  uuid not null references public.module_delegations(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  unique (delegation_id, permission_key)
);

alter table public.delegation_permissions enable row level security;
drop policy if exists delegation_permissions_read on public.delegation_permissions;
create policy delegation_permissions_read on public.delegation_permissions for select to authenticated
  using (
    delegation_id in (select id from public.module_delegations where profile_id = auth.uid())
    or is_apostle()
    or exists (select 1 from public.council_members cm where cm.profile_id = auth.uid() and cm.is_active)
  );
drop policy if exists delegation_permissions_write on public.delegation_permissions;
create policy delegation_permissions_write on public.delegation_permissions for all to authenticated
  using (is_apostle() or exists (select 1 from public.council_members cm where cm.profile_id = auth.uid() and cm.is_active))
  with check (is_apostle() or exists (select 1 from public.council_members cm where cm.profile_id = auth.uid() and cm.is_active));
grant select, insert, delete on public.delegation_permissions to authenticated;

-- Ao conceder uma delegação sem especificar permissões atômicas, libera TODAS
-- as do módulo por padrão (compatibilidade com o modelo atual, module-level).
create or replace function public.delegation_effective_permissions(p_delegation_id uuid)
returns text[]
language plpgsql stable security definer set search_path = public as $$
declare
  v_specific text[];
  v_module delegation_module;
begin
  select array_agg(permission_key) into v_specific from public.delegation_permissions where delegation_id = p_delegation_id;
  if v_specific is not null and array_length(v_specific, 1) > 0 then
    return v_specific;
  end if;
  select module into v_module from public.module_delegations where id = p_delegation_id;
  return coalesce((select array_agg(key) from public.permissions where module = v_module), '{}');
end; $$;
grant execute on function public.delegation_effective_permissions(uuid) to authenticated;

-- ---------- RPC: checagem de permissão atômica (considera herança de escopo) ----------
create or replace function public.has_permission(p_profile_id uuid, p_permission_key text, p_target_church_id uuid default null)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_is_apostle boolean;
  v_module delegation_module;
  d record;
begin
  select role = 'apostolo' into v_is_apostle from public.profiles where id = p_profile_id;
  if v_is_apostle then return true; end if;

  select module into v_module from public.permissions where key = p_permission_key;
  if v_module is null then return false; end if;

  for d in
    select * from public.module_delegations
    where profile_id = p_profile_id and module = v_module and status = 'ativo'::delegation_status
      and (expires_at is null or expires_at > now())
  loop
    if not (p_permission_key = any(public.delegation_effective_permissions(d.id))) then
      continue;
    end if;

    if p_target_church_id is null then
      return true;
    end if;

    if d.scope = 'nacional'::delegation_scope then
      return true;
    end if;

    if d.scope_exceptions is not null and p_target_church_id = any(d.scope_exceptions) then
      continue;
    end if;

    if d.propagates_to_subordinates and d.scope_id is not null then
      if p_target_church_id in (select public.accessible_church_ids()) then
        return true;
      end if;
    elsif d.scope_id = p_target_church_id then
      return true;
    end if;
  end loop;

  return false;
end; $$;
grant execute on function public.has_permission(uuid, text, uuid) to authenticated;
