-- ============================================================
-- CEC FAMILY — Identidade da comunidade no primeiro acesso
-- Acrescenta logo_url da igreja e o nome da unidade organizacional
-- (Setor/Distrito/Núcleo, o que houver de mais específico) ao
-- retorno de validate_invite_token, pra exibir no card de convite.
-- Idempotente.
-- ============================================================

drop function if exists public.validate_invite_token(text);
create or replace function public.validate_invite_token(p_token text)
returns table (
  valid boolean, reason text,
  kind invite_link_kind, church_name text, life_group_name text, ministry_name text,
  target_role user_role, scope_level scope_level, scope_name text,
  church_logo_url text, org_unit_name text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_link record;
  v_scope_name text;
  v_church_logo text;
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
    when 'igreja'   then (select name from public.churches where id = v_link.scope_id)
    else null
  end;

  select logo_url into v_church_logo from public.churches where id = v_link.church_id;

  -- Unidade organizacional: a mais específica disponível no convite
  v_org_unit := coalesce(
    (select name from public.life_groups where id = v_link.life_group_id),
    (select name from public.sectors where id = v_link.sector_id),
    (select name from public.districts where id = v_link.district_id),
    v_scope_name
  );

  return query
  select true, null::text, v_link.kind,
    (select name from public.churches where id = v_link.church_id),
    (select name from public.life_groups where id = v_link.life_group_id),
    (select name from public.ministries where id = v_link.ministry_id),
    v_link.target_role, v_link.scope_level, v_scope_name,
    v_church_logo, v_org_unit;
end; $$;
grant execute on function public.validate_invite_token(text) to anon, authenticated;
