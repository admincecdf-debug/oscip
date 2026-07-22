-- ============================================================
-- CEC FAMILY — CT-002b: Convites com escopo territorial (MEO-001)
-- Permite que um convite de Pastor/Supervisor já defina o nível
-- (Estado/Núcleo/Distrito/Setor/Igreja) que a pessoa vai administrar,
-- aplicado automaticamente ao profile dela quando o cadastro é concluído.
-- Idempotente.
-- ============================================================

alter table public.invite_links add column if not exists scope_level scope_level;
alter table public.invite_links add column if not exists scope_id uuid;

-- ---------- create_invite_link: ganha p_scope_level / p_scope_id ----------
create or replace function public.create_invite_link(
  p_kind invite_link_kind,
  p_church_id uuid,
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
  if not public.can_create_invite_kind(p_kind, p_church_id, p_sector_id, p_life_group_id) then
    raise exception 'Sem permissão para gerar convite do tipo %', p_kind using errcode = '42501';
  end if;

  -- Só apóstolo ou quem já tem escopo Nacional/Estado pode gerar convite com
  -- escopo Nacional/Estado/Núcleo (evita um supervisor de Setor se auto-promover).
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
    token, kind, church_id, district_id, area_id, sector_id, life_group_id,
    ministry_id, target_role, discipler_id, expires_at, max_uses, allowed_ip_cidr,
    scope_level, scope_id, created_by
  ) values (
    v_token, p_kind, p_church_id, p_district_id, p_area_id, p_sector_id, p_life_group_id,
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

-- ---------- validate_invite_token: devolve também o nome do escopo, pra exibir na tela pública ----------
create or replace function public.validate_invite_token(p_token text)
returns table (
  valid boolean, reason text,
  kind invite_link_kind, church_name text, life_group_name text, ministry_name text,
  target_role user_role, scope_level scope_level, scope_name text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_link record;
  v_scope_name text;
begin
  select * into v_link from public.invite_links il where il.token = p_token;

  if v_link.id is null then
    return query select false, 'nao_encontrado', null::invite_link_kind, null::text, null::text, null::text, null::user_role, null::scope_level, null::text;
    return;
  end if;
  if v_link.revoked_at is not null then
    return query select false, 'revogado', v_link.kind, null::text, null::text, null::text, v_link.target_role, null::scope_level, null::text;
    return;
  end if;
  if v_link.expires_at is not null and v_link.expires_at < now() then
    return query select false, 'expirado', v_link.kind, null::text, null::text, null::text, v_link.target_role, null::scope_level, null::text;
    return;
  end if;
  if v_link.max_uses is not null and v_link.uses_count >= v_link.max_uses then
    return query select false, 'esgotado', v_link.kind, null::text, null::text, null::text, v_link.target_role, null::scope_level, null::text;
    return;
  end if;

  v_scope_name := case v_link.scope_level
    when 'estado'   then (select name from public.states where id = v_link.scope_id)
    when 'nucleo'   then (select name from public.nucleos where id = v_link.scope_id)
    when 'distrito' then (select name from public.districts where id = v_link.scope_id)
    when 'setor'    then (select name from public.sectors where id = v_link.scope_id)
    when 'igreja'   then (select name from public.churches where id = v_link.scope_id)
    else null
  end;

  return query
  select true, null::text, v_link.kind,
    (select name from public.churches where id = v_link.church_id),
    (select name from public.life_groups where id = v_link.life_group_id),
    (select name from public.ministries where id = v_link.ministry_id),
    v_link.target_role, v_link.scope_level, v_scope_name;
end; $$;
grant execute on function public.validate_invite_token(text) to anon, authenticated;

-- ---------- consume_invite_link: aplica scope_level/scope_id no profile ----------
-- CORREÇÃO: quando o projeto exige confirmação de e-mail, não existe sessão ativa
-- logo após o signUp() — auth.uid() é null nesse momento. Por isso a função agora
-- aceita p_user_id explícito (o client já recebe esse id na resposta do signUp()),
-- usando coalesce(auth.uid(), p_user_id) em tudo.
create or replace function public.consume_invite_link(
  p_token text, p_ip text default null, p_user_agent text default null,
  p_phone text default null, p_user_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_link record;
  v_uid uuid;
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

  update public.profiles set
    role = v_link.target_role,
    church_id = coalesce(v_link.church_id, church_id),
    phone = coalesce(p_phone, phone),
    scope_level = coalesce(v_link.scope_level, scope_level),
    scope_id = case when v_link.scope_level is not null then v_link.scope_id else scope_id end
  where id = v_uid;

  if not found then
    raise exception 'Perfil do usuário ainda não existe — tente novamente em alguns segundos';
  end if;

  if v_link.life_group_id is not null then
    insert into public.members (profile_id, full_name, life_group_id, church_id, journey_stage, status, joined_at)
    select v_uid, p.full_name, v_link.life_group_id, v_link.church_id, 'novo_convertido', 'ativo', now()
    from public.profiles p where p.id = v_uid
    on conflict do nothing;
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
    perform public.audit_log('insert', 'invite_link_use', v_link.id, jsonb_build_object('target_role', v_link.target_role));
  exception when others then null;
  end;
end; $$;
grant execute on function public.consume_invite_link(text, text, text, text, uuid) to authenticated, anon;
