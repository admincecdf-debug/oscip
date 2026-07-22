-- ============================================================
-- CEC FAMILY — Governança: ativa o travamento real do painel.
--
-- A partir de agora, só o Apóstolo (Administrador Nacional) vê o
-- painel administrativo inteiro por padrão. Qualquer outra pessoa
-- (incluindo Pastor) só vê os módulos que tiverem uma delegação
-- ativa — concedida pelo Administrador Nacional, Estadual, ou por
-- quem tiver delegação de tipo "administrativo" no escopo dela.
-- ============================================================

create or replace function public.my_active_modules()
returns delegation_module[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct module), array[]::delegation_module[])
  from public.module_delegations
  where profile_id = auth.uid()
    and status = 'ativo'
    and (expires_at is null or expires_at > now());
$$;
grant execute on function public.my_active_modules() to authenticated;
