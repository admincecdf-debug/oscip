-- ============================================================
-- CEC FAMILY — M3 patch: campo life_group_id em visitor_pipeline
-- Permite que o wizard publico capture qual LG o visitante escolheu.
-- Idempotente.
-- ============================================================

-- ---------- 1) Coluna nova ----------
alter table public.visitor_pipeline
  add column if not exists life_group_id uuid references public.life_groups(id) on delete set null;
create index if not exists idx_vp_lg on public.visitor_pipeline(life_group_id);

-- ---------- 2) Atualiza a RPC visitor_pipeline_create ----------
-- Drop antes pra trocar a assinatura (parametro novo p_life_group_id)
drop function if exists public.visitor_pipeline_create(uuid, pipeline_intent, text, text, text, text, text, text);

create or replace function public.visitor_pipeline_create(
  p_community_id  uuid,
  p_intent        pipeline_intent,
  p_full_name     text,
  p_phone         text,
  p_email         text default null,
  p_state         text default null,
  p_city          text default null,
  p_cep           text default null,
  p_life_group_id uuid default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select id into v_profile_id from public.profiles where id = auth.uid();

  insert into public.visitor_pipeline (
    user_id, profile_id, community_id, life_group_id,
    full_name, phone, email, state, city, cep,
    intent, stage, source
  ) values (
    auth.uid(), v_profile_id, p_community_id, p_life_group_id,
    p_full_name, p_phone, p_email, p_state, p_city, p_cep,
    p_intent, 'novo', 'site_publico'
  ) returning id into v_id;

  return v_id;
end; $$;

grant execute on function public.visitor_pipeline_create(uuid, pipeline_intent, text, text, text, text, text, text, uuid)
  to authenticated;

-- ---------- 3) Leitura publica dos LGs (anonymous SELECT) ----------
-- Pra o wizard publico (anon) conseguir listar LGs antes de signup
drop policy if exists life_groups_public_read on public.life_groups;
create policy life_groups_public_read on public.life_groups for select to anon
  using (is_active);
