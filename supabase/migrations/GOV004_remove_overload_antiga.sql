-- ============================================================
-- CEC FAMILY — Fix: existiam DUAS versões de has_module_access
-- coexistindo (sobrecarga de função) — uma antiga com parâmetro
-- "text" (de antes desta sessão) e a nova com "delegation_module".
-- Isso causava "operator does not exist: delegation_module = text"
-- porque a versão antiga comparava a coluna (agora enum) direto
-- com texto solto.
-- ============================================================

drop function if exists public.has_module_access(uuid, text);

-- Garante que só a versão correta (com o enum) existe
create or replace function public.has_module_access(p_profile_id uuid, p_module delegation_module)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_is_apostle boolean;
begin
  select role = 'apostolo' into v_is_apostle from public.profiles where id = p_profile_id;
  if v_is_apostle then return true; end if;

  if exists (
    select 1 from public.module_delegations
    where profile_id = p_profile_id and module = p_module and status = 'ativo'::delegation_status
      and (expires_at is null or expires_at > now())
  ) then return true; end if;

  if exists (
    select 1 from public.active_emergency_access
    where profile_id = p_profile_id and module = p_module
  ) then return true; end if;

  if exists (
    select 1 from public.role_delegations rd
    join public.profiles p on p.id = p_profile_id
    where rd.role_name = p.role::text and rd.module = p_module and rd.is_active
  ) then return true; end if;

  return false;
end; $$;
grant execute on function public.has_module_access(uuid, delegation_module) to authenticated;
