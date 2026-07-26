-- ============================================================
-- CEC FAMILY / APS — RENAME002
-- Passada 2 de N: recria as funções PL/pgSQL do lote
-- "segurança/core + convites" com os nomes novos (organization_*),
-- e de quebra:
--   (a) corrige o vazamento de tenant no "apóstolo vê tudo"
--       (accessible_organization_ids e has_permission agora respeitam
--       o tenant do usuário, não veem mais TODAS as organizations
--       de TODOS os tenants);
--   (b) consolida os dois overloads simultâneos de
--       consume_invite_link (4 e 5 parâmetros) numa função só,
--       juntando o fix de role do CT002f com a dedução de
--       organização via life group do FIX003 — o bug relatado
--       originalmente ("convite de pastor virava membro") e o bug
--       que eu encontrei depois (fix do FIX003 nunca era executado)
--       ficam resolvidos ao mesmo tempo.
--
-- Escopo desta passada (ver checklist completo no fim do RENAME001):
--   accessible_church_ids, has_permission, get_community_by_slug,
--   resolve_church_ancestry (+ view church_ancestry), church_dependencies,
--   can_delete_church, move_church, church_state_name,
--   consume_invite_link, validate_invite_token, create_invite_link,
--   list_invite_links, can_create_invite_kind
--
-- NÃO incluído aqui (fica para as próximas passadas):
--   relocate_member, assign_leadership, remanejar_lideranca,
--   sync_member_church_from_lg, member_structure_names,
--   approve_member_card, check-in/eventos, dashboards/relatórios.
--
-- PRÉ-REQUISITO: RENAME001_organizations_and_tenants.sql já aplicada.
--
-- BUG PRÉ-EXISTENTE ENCONTRADO (não corrigido aqui, fora do escopo
-- de um rename): church_state_name faz "select state_name from
-- resolve_church_ancestry(...)", mas a versão atual de
-- resolve_church_ancestry (desde FLEX001) não retorna state_name.
-- Ou seja, essa função provavelmente já falha em produção hoje,
-- independente do rename. Mantive o mesmo comportamento (só troquei
-- os nomes) para não misturar um fix funcional dentro de uma
-- migration de rename. Recomendo tratar isso à parte.
-- ============================================================

begin;

-- ============================================================
-- 1) accessible_organization_ids() — agora respeita o tenant
-- ============================================================
create or replace function public.accessible_organization_ids()
returns setof uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_scope_level scope_level;
  v_scope_id uuid;
  v_organization uuid;
  v_tenant_id uuid;
begin
  select role::text, scope_level, scope_id, organization_id, tenant_id
    into v_role, v_scope_level, v_scope_id, v_organization, v_tenant_id
  from public.profiles where id = auth.uid();

  -- Apóstolo, ou escopo nacional, ou pastor legado sem nenhum escopo:
  -- vê tudo DENTRO DO PRÓPRIO TENANT (antes via literalmente todas as
  -- linhas de organizations, de qualquer tenant — bug de isolamento).
  if v_role = 'apostolo' or v_scope_level = 'nacional' or (v_scope_level is null and v_organization is null) then
    return query select id from public.organizations where tenant_id = v_tenant_id;
    return;
  end if;

  if v_scope_level = 'estado' then
    return query
    select o.id from public.organizations o
    join public.sectors se on se.id = o.sector_id
    join public.districts di on di.id = se.district_id
    join public.nucleos nu on nu.id = di.nucleo_id
    where nu.state_id = v_scope_id and o.tenant_id = v_tenant_id;
    return;
  end if;

  if v_scope_level = 'nucleo' then
    return query
    select o.id from public.organizations o
    join public.sectors se on se.id = o.sector_id
    join public.districts di on di.id = se.district_id
    where di.nucleo_id = v_scope_id and o.tenant_id = v_tenant_id;
    return;
  end if;

  if v_scope_level = 'distrito' then
    return query
    select o.id from public.organizations o
    join public.sectors se on se.id = o.sector_id
    where se.district_id = v_scope_id and o.tenant_id = v_tenant_id;
    return;
  end if;

  if v_scope_level = 'setor' then
    return query select o.id from public.organizations o
    where o.sector_id = v_scope_id and o.tenant_id = v_tenant_id;
    return;
  end if;

  -- 'igreja' (ou legado via organization_id): só a própria organização —
  -- sem filhos, já que Organização Local é folha institucional.
  return query
  select coalesce(v_scope_id, v_organization)
  where coalesce(v_scope_id, v_organization) is not null;
end; $$;
grant execute on function public.accessible_organization_ids() to authenticated;

drop function if exists public.accessible_church_ids();

-- ============================================================
-- 2) has_permission() — bypass de apóstolo agora respeita tenant
-- ============================================================
create or replace function public.has_permission(p_profile_id uuid, p_permission_key text, p_target_organization_id uuid default null)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_is_apostle boolean;
  v_module delegation_module;
  d record;
begin
  select role = 'apostolo' into v_is_apostle from public.profiles where id = p_profile_id;
  -- Apóstolo só ganha bypass total se o alvo (quando informado) for do mesmo tenant.
  if v_is_apostle and public.same_tenant(p_target_organization_id) then
    return true;
  end if;

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

    if p_target_organization_id is null then
      return true;
    end if;

    if d.scope = 'nacional'::delegation_scope then
      return true;
    end if;

    if d.scope_exceptions is not null and p_target_organization_id = any(d.scope_exceptions) then
      continue;
    end if;

    if d.propagates_to_subordinates and d.scope_id is not null then
      if p_target_organization_id in (select public.accessible_organization_ids()) then
        return true;
      end if;
    elsif d.scope_id = p_target_organization_id then
      return true;
    end if;
  end loop;

  return false;
end; $$;
grant execute on function public.has_permission(uuid, text, uuid) to authenticated;

-- ============================================================
-- 3) get_community_by_slug()
-- ============================================================
create or replace function public.get_community_by_slug(p_slug text)
returns public.organizations
language sql stable security definer set search_path=public as $$
  select * from public.organizations
  where is_active and slug = p_slug
  limit 1;
$$;

-- ============================================================
-- 4) resolve_organization_ancestry() + view organization_ancestry
-- ============================================================
create or replace function public.resolve_organization_ancestry(p_organization_id uuid)
returns table(state_id uuid, nucleo_id uuid, district_id uuid, sector_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_parent_level text; v_parent_id uuid;
begin
  select parent_level::text, parent_territorial_id into v_parent_level, v_parent_id
  from public.organizations where id = p_organization_id;
  return query select * from public.resolve_territorial_ancestry(v_parent_level, v_parent_id);
end; $$;
grant execute on function public.resolve_organization_ancestry(uuid) to authenticated;

drop view if exists public.church_ancestry;
drop function if exists public.resolve_church_ancestry(uuid);

create or replace view public.organization_ancestry as
select o.id as organization_id, anc.state_id as state_id, anc.nucleo_id as nucleo_id,
       anc.district_id as district_id, anc.sector_id as sector_id
from public.organizations o
cross join lateral public.resolve_organization_ancestry(o.id) anc;

grant select on public.organization_ancestry to authenticated;

-- ============================================================
-- 5) organization_dependencies() / can_delete_organization() / move_organization()
-- ============================================================
create or replace function public.organization_dependencies(p_organization_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_children    int;
  v_life_groups int;
  v_members     int;
  v_reports     int;
begin
  select count(*) into v_children
  from public.organizations where parent_id = p_organization_id;

  select count(*) into v_life_groups
  from public.life_groups where organization_id = p_organization_id;

  select count(*) into v_members
  from public.members where organization_id = p_organization_id;

  select count(*) into v_reports
  from public.meeting_reports mr
  join public.life_groups lg on lg.id = mr.life_group_id
  where lg.organization_id = p_organization_id;

  return jsonb_build_object(
    'children', v_children,
    'life_groups', v_life_groups,
    'members', v_members,
    'reports', v_reports,
    'total', v_children + v_life_groups + v_members + v_reports
  );
end; $$;
grant execute on function public.organization_dependencies(uuid) to authenticated;

drop function if exists public.church_dependencies(uuid);

create or replace function public.can_delete_organization(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select (public.organization_dependencies(p_organization_id)->>'total')::int = 0;
$$;
grant execute on function public.can_delete_organization(uuid) to authenticated;

drop function if exists public.can_delete_church(uuid);

create or replace function public.move_organization(p_organization_id uuid, p_new_parent_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_type        organization_type;
  v_parent_type organization_type;
  v_candidate   uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select type into v_type from public.organizations where id = p_organization_id;
  if v_type is null then
    raise exception 'organization not found';
  end if;

  if p_new_parent_id is null then
    if v_type <> 'sede' then
      raise exception 'Apenas comunidades do tipo Sede podem ficar sem Comunidade Mãe';
    end if;
    update public.organizations set parent_id = null where id = p_organization_id;
    return;
  end if;

  if p_new_parent_id = p_organization_id then
    raise exception 'Uma comunidade não pode ser sua própria Comunidade Mãe';
  end if;

  select type into v_parent_type from public.organizations where id = p_new_parent_id;
  if v_parent_type is null then
    raise exception 'Nova Comunidade Mãe não encontrada';
  end if;

  if v_type = 'nucleo' and v_parent_type <> 'sede' then
    raise exception 'Núcleo só pode ter uma Sede como Comunidade Mãe';
  end if;
  if v_type = 'igreja_local' and v_parent_type not in ('sede', 'nucleo') then
    raise exception 'Igreja Local só pode ter Sede ou Núcleo como Comunidade Mãe';
  end if;
  if v_type = 'sede' and v_parent_type <> 'sede' then
    raise exception 'Sede só pode ter outra Sede como Comunidade Mãe (ou ficar sem)';
  end if;

  -- Impede que a nova organização-mãe pertença a outro tenant.
  if not public.same_tenant(p_new_parent_id) then
    raise exception 'Comunidade Mãe precisa pertencer à mesma organização contratante (tenant)';
  end if;

  v_candidate := p_new_parent_id;
  while v_candidate is not null loop
    if v_candidate = p_organization_id then
      raise exception 'Mover criaria um ciclo na estrutura organizacional';
    end if;
    select parent_id into v_candidate from public.organizations where id = v_candidate;
  end loop;

  update public.organizations set parent_id = p_new_parent_id where id = p_organization_id;
end; $$;
grant execute on function public.move_organization(uuid, uuid) to authenticated;

drop function if exists public.move_church(uuid, uuid);

-- ============================================================
-- 6) organization_state_name() — BUG PRÉ-EXISTENTE CONFIRMADO:
--    a versão anterior (church_state_name) fazia
--    "select state_name from resolve_church_ancestry(...)", mas
--    resolve_organization_ancestry (renomeada de resolve_church_ancestry)
--    NUNCA retornou uma coluna state_name — só state_id. Tentei recriar
--    essa função com o texto só renomeado e o Postgres recusou compilar
--    (a mesma falha já deveria estar acontecendo em produção hoje,
--    silenciosamente, toda vez que essa função for chamada). Corrigido
--    aqui buscando o nome pela tabela states via o state_id já retornado.
-- ============================================================
create or replace function public.organization_state_name(p_organization_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select s.name
  from public.resolve_organization_ancestry(p_organization_id) anc
  join public.states s on s.id = anc.state_id
  limit 1;
$$;
grant execute on function public.organization_state_name(uuid) to authenticated, anon;

drop function if exists public.church_state_name(uuid);

-- ============================================================
-- 7) Convites — consolidação do overload de consume_invite_link
-- ============================================================

-- Remove os DOIS overloads simultâneos que existem hoje em produção
-- (4 e 5 parâmetros) antes de criar a versão única e definitiva.
drop function if exists public.consume_invite_link(text, text, text, text);
drop function if exists public.consume_invite_link(text, text, text, text, uuid);

create or replace function public.consume_invite_link(
  p_token text, p_ip text default null, p_user_agent text default null,
  p_phone text default null, p_user_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_link record;
  v_uid uuid;
  v_organization_id uuid;
  v_journey_stage text;
  v_leadership_function text;
begin
  v_uid := coalesce(auth.uid(), p_user_id);
  if v_uid is null then
    raise exception 'Não foi possível identificar o usuário para vincular o convite';
  end if;

  select * into v_link from public.invite_links il where il.token = p_token for update;
  if v_link.id is null then raise exception 'Convite inválido'; end if;
  if v_link.revoked_at is not null then raise exception 'Convite revogado'; end if;
  if v_link.expires_at is not null and v_link.expires_at < now() then raise exception 'Convite expirado'; end if;
  if v_link.max_uses is not null and v_link.uses_count >= v_link.max_uses then raise exception 'Convite esgotado'; end if;

  -- 1) Aplica o cargo (role) definido no convite (fix do CT002f)
  update public.profiles set
    role = v_link.target_role,
    organization_id = coalesce(v_link.organization_id, organization_id),
    phone = coalesce(p_phone, phone),
    scope_level = coalesce(v_link.scope_level, scope_level),
    scope_id = case when v_link.scope_level is not null then v_link.scope_id else scope_id end
  where id = v_uid;

  if not found then
    raise exception 'Perfil do usuário ainda não existe — tente novamente em alguns segundos';
  end if;

  -- 2) Situação Ministerial mapeada pelo tipo de convite
  v_journey_stage := case v_link.kind
    when 'visitante'           then 'visitante'
    when 'membro'              then 'membro_ativo'
    when 'lider_lg'            then 'lider'
    when 'lider_jovens'        then 'lider'
    when 'lider_casais'        then 'lider'
    when 'lider_criancas'      then 'lider'
    when 'musico'              then 'servo'
    when 'pastor'              then 'lider'
    when 'administrador'       then 'lider'
    when 'diretor_financeiro'  then 'servo'
    when 'secretario'          then 'servo'
    else 'membro_ativo'
  end;

  -- 3) Resolve a organização: a do link, ou deduzida do Life Group do link
  --    (fix do FIX003, que hoje nunca roda por causa do overload — agora
  --    faz parte da única versão ativa desta função)
  v_organization_id := v_link.organization_id;
  if v_organization_id is null and v_link.life_group_id is not null then
    select organization_id into v_organization_id from public.life_groups where id = v_link.life_group_id;
  end if;

  -- 4) Cria/atualiza o registro de membro sempre que houver organização OU
  --    Life Group no convite (não só quando organization_id está preenchido)
  if v_organization_id is not null or v_link.life_group_id is not null then
    insert into public.members (profile_id, full_name, email, phone, life_group_id, organization_id, journey_stage, status, joined_at)
    select v_uid, p.full_name, p.email, coalesce(p_phone, p.phone), v_link.life_group_id, v_organization_id, v_journey_stage::journey_stage, 'ativo', now()
    from public.profiles p where p.id = v_uid
    on conflict do nothing;
  end if;

  -- 5) Designação automática de Liderança (nunca quebra o cadastro se a função não existir)
  v_leadership_function := case v_link.kind
    when 'pastor'         then 'pastor_auxiliar'
    when 'lider_lg'       then 'lider_lg'
    when 'lider_jovens'   then 'lider_jovens'
    when 'lider_casais'   then 'lider_casais'
    when 'lider_criancas' then 'lider_infantil'
    when 'musico'         then 'lider_louvor'
    else null
  end;

  if v_leadership_function is not null and v_organization_id is not null then
    begin
      perform public.assign_leadership(
        v_uid, v_leadership_function::leadership_function, v_organization_id,
        v_link.scope_level, v_link.scope_id,
        v_link.ministry_id, v_link.life_group_id,
        current_date, 'Designação automática via convite'
      );
    exception when others then null;
    end;
  end if;

  if v_link.discipler_id is not null then
    insert into public.discipleship (discipler_id, disciple_id, status, started_on)
    values (v_link.discipler_id, v_uid, 'ativo', current_date)
    on conflict do nothing;
  end if;

  if v_link.ministry_id is not null then
    insert into public.ministry_members (ministry_id, profile_id, role)
    values (v_link.ministry_id, v_uid, 'membro')
    on conflict do nothing;
  end if;

  update public.invite_links set uses_count = uses_count + 1 where id = v_link.id;

  insert into public.invite_link_uses (invite_link_id, used_by, ip, user_agent)
  values (v_link.id, v_uid, p_ip, p_user_agent);

  begin
    perform public.audit_log('insert', 'invite_link_use', v_link.id, jsonb_build_object('target_role', v_link.target_role, 'kind', v_link.kind));
  exception when others then null;
  end;
end; $$;
grant execute on function public.consume_invite_link(text, text, text, text, uuid) to authenticated, anon;

-- ============================================================
-- 8) validate_invite_token() — colunas de saída renomeadas
-- ============================================================
drop function if exists public.validate_invite_token(text);

create or replace function public.validate_invite_token(p_token text)
returns table (
  valid boolean, reason text,
  kind invite_link_kind, organization_name text, life_group_name text, ministry_name text,
  target_role user_role, scope_level scope_level, scope_name text,
  organization_logo_url text, org_unit_name text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_link record;
  v_scope_name text;
  v_organization_logo text;
  v_org_unit text;
begin
  select * into v_link from public.invite_links il where il.token = p_token;

  if v_link.id is null then
    return query select false, 'nao_encontrado', null::invite_link_kind, null::text, null::text, null::text, null::user_role, null::scope_level, null::text, null::text, null::text;
    return;
  end if;
  if v_link.revoked_at is not null then
    return query select false, 'revogado', v_link.kind, null::text, null::text, null::text, v_link.target_role, null::scope_level, null::text, null::text, null::text;
    return;
  end if;
  if v_link.expires_at is not null and v_link.expires_at < now() then
    return query select false, 'expirado', v_link.kind, null::text, null::text, null::text, v_link.target_role, null::scope_level, null::text, null::text, null::text;
    return;
  end if;
  if v_link.max_uses is not null and v_link.uses_count >= v_link.max_uses then
    return query select false, 'esgotado', v_link.kind, null::text, null::text, null::text, v_link.target_role, null::scope_level, null::text, null::text, null::text;
    return;
  end if;

  v_scope_name := case v_link.scope_level
    when 'estado'   then (select name from public.states where id = v_link.scope_id)
    when 'nucleo'   then (select name from public.nucleos where id = v_link.scope_id)
    when 'distrito' then (select name from public.districts where id = v_link.scope_id)
    when 'setor'    then (select name from public.sectors where id = v_link.scope_id)
    when 'igreja'   then (select name from public.organizations where id = v_link.scope_id)
    else null
  end;

  select logo_url into v_organization_logo from public.organizations where id = v_link.organization_id;

  v_org_unit := coalesce(
    (select name from public.life_groups where id = v_link.life_group_id),
    (select name from public.sectors where id = v_link.sector_id),
    (select name from public.districts where id = v_link.district_id),
    v_scope_name
  );

  return query
  select true, null::text, v_link.kind,
    (select name from public.organizations where id = v_link.organization_id),
    (select name from public.life_groups where id = v_link.life_group_id),
    (select name from public.ministries where id = v_link.ministry_id),
    v_link.target_role, v_link.scope_level, v_scope_name,
    v_organization_logo, v_org_unit;
end; $$;
grant execute on function public.validate_invite_token(text) to anon, authenticated;

-- ============================================================
-- 9) create_invite_link() — p_church_id -> p_organization_id
-- ============================================================
drop function if exists public.create_invite_link(
  invite_link_kind, uuid, uuid, uuid, uuid, uuid, uuid, user_role, uuid, text, int, text, scope_level, uuid
);

create or replace function public.create_invite_link(
  p_kind invite_link_kind,
  p_organization_id uuid,
  p_district_id uuid default null,
  p_area_id uuid default null,
  p_sector_id uuid default null,
  p_life_group_id uuid default null,
  p_ministry_id uuid default null,
  p_target_role user_role default 'membro',
  p_discipler_id uuid default null,
  p_validity text default 'permanente',
  p_max_uses int default null,
  p_allowed_ip_cidr text default null,
  p_scope_level scope_level default null,
  p_scope_id uuid default null
) returns table (id uuid, token text)
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_expires_at timestamptz;
  v_new_id uuid;
begin
  if not public.can_create_invite_kind(p_kind, p_organization_id, p_sector_id, p_life_group_id) then
    raise exception 'Sem permissão para gerar convite do tipo %', p_kind using errcode = '42501';
  end if;

  -- Impede gerar convite para uma organização de outro tenant.
  if not public.same_tenant(p_organization_id) then
    raise exception 'Sem permissão para gerar convite fora do seu tenant' using errcode = '42501';
  end if;

  if p_scope_level in ('nacional', 'estado', 'nucleo') and not public.is_apostle() then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.scope_level in ('nacional', 'estado')
    ) then
      raise exception 'Sem permissão para gerar convite com escopo %', p_scope_level using errcode = '42501';
    end if;
  end if;

  v_expires_at := case p_validity
    when '24h' then now() + interval '24 hours'
    when '7d'  then now() + interval '7 days'
    when '30d' then now() + interval '30 days'
    when '90d' then now() + interval '90 days'
    else null
  end;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.invite_links (
    token, kind, organization_id, district_id, area_id, sector_id, life_group_id,
    ministry_id, target_role, discipler_id, expires_at, max_uses, allowed_ip_cidr,
    scope_level, scope_id, created_by
  ) values (
    v_token, p_kind, p_organization_id, p_district_id, p_area_id, p_sector_id, p_life_group_id,
    p_ministry_id, p_target_role, p_discipler_id, v_expires_at, p_max_uses, p_allowed_ip_cidr,
    p_scope_level, p_scope_id, auth.uid()
  ) returning invite_links.id into v_new_id;

  begin
    perform public.audit_log('insert', 'invite_link', v_new_id, jsonb_build_object('kind', p_kind, 'scope_level', p_scope_level));
  exception when others then null;
  end;

  return query select v_new_id, v_token;
end; $$;
grant execute on function public.create_invite_link(
  invite_link_kind, uuid, uuid, uuid, uuid, uuid, uuid, user_role, uuid, text, int, text, scope_level, uuid
) to authenticated;

-- ============================================================
-- 10) list_invite_links() — p_church_id -> p_organization_id, colunas renomeadas
-- ============================================================
drop function if exists public.list_invite_links(uuid);

create or replace function public.list_invite_links(p_organization_id uuid default null)
returns table (
  id uuid, token text, kind invite_link_kind, status invite_link_status,
  organization_name text, life_group_name text, target_role user_role,
  max_uses int, uses_count int, expires_at timestamptz,
  created_by_name text, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  select
    il.id, il.token, il.kind,
    case
      when il.revoked_at is not null then 'revogado'::invite_link_status
      when il.expires_at is not null and il.expires_at < now() then 'expirado'::invite_link_status
      when il.max_uses is not null and il.uses_count >= il.max_uses then 'esgotado'::invite_link_status
      else 'ativo'::invite_link_status
    end,
    o.name, lg.name, il.target_role,
    il.max_uses, il.uses_count, il.expires_at,
    p.full_name, il.created_at
  from public.invite_links il
  left join public.organizations o on o.id = il.organization_id
  left join public.life_groups lg on lg.id = il.life_group_id
  left join public.profiles p on p.id = il.created_by
  where (il.created_by = auth.uid() or il.organization_id in (select public.accessible_organization_ids()) or (public.is_apostle() and public.same_tenant(il.organization_id)))
    and (p_organization_id is null or il.organization_id = p_organization_id)
  order by il.created_at desc;
end; $$;
grant execute on function public.list_invite_links(uuid) to authenticated;

-- ============================================================
-- 11) can_create_invite_kind() — p_church_id -> p_organization_id
-- ============================================================
drop function if exists public.can_create_invite_kind(invite_link_kind, uuid, uuid, uuid);

create or replace function public.can_create_invite_kind(
  p_kind invite_link_kind,
  p_organization_id uuid,
  p_sector_id uuid default null,
  p_life_group_id uuid default null
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_role user_role;
  v_organization_id uuid;
begin
  select role, organization_id into v_role, v_organization_id from public.profiles where id = auth.uid();

  if v_role is null then return false; end if;

  -- Administrador nacional / apóstolo: pode tudo, dentro do próprio tenant
  if public.is_apostle() and public.same_tenant(p_organization_id) then return true; end if;

  if p_kind = 'administrador' then return false; end if;

  if v_role = 'pastor' and p_organization_id in (select public.accessible_organization_ids()) then
    return true;
  end if;

  if v_role = 'supervisor' and p_organization_id in (select public.accessible_organization_ids())
     and p_kind in ('membro','visitante','lider_lg','lider_jovens','lider_casais','lider_criancas','musico') then
    return true;
  end if;

  if v_role = 'lider' and p_kind in ('membro','visitante') then
    return p_life_group_id is not null
      and exists (select 1 from public.life_groups lg where lg.id = p_life_group_id and lg.leader_id = auth.uid());
  end if;

  return false;
end; $$;
grant execute on function public.can_create_invite_kind(invite_link_kind, uuid, uuid, uuid) to authenticated;

commit;
