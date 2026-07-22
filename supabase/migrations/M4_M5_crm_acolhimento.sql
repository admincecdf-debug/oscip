-- ============================================================
-- CEC FAMILY — M4+M5: CRM Pastoral + Central de Acolhimento
-- Views para os 7 menus da Central de Acolhimento
-- RPC para admin atualizar pipeline com timestamps automaticos
-- Idempotente.
-- ============================================================

-- ---------- 1) Views da Central de Acolhimento ----------
-- Todas filtram visitor_pipeline. Sao SECURITY INVOKER (respeitam RLS).

-- Novos cadastros (stage=novo)
create or replace view public.acolhimento_novos as
  select vp.* from public.visitor_pipeline vp
  where vp.stage = 'novo'
  order by vp.created_at desc;

-- Sem contato (novos OU aguardando_contato sem first_contact_at)
create or replace view public.acolhimento_sem_contato as
  select vp.* from public.visitor_pipeline vp
  where vp.stage in ('novo','aguardando_contato')
    and vp.first_contact_at is null
  order by vp.created_at asc;  -- mais antigos primeiro (mais urgente)

-- Sem Life Group: contatado mas ainda nao convidado pra life group OU sem profile vinculado a celula
create or replace view public.acolhimento_sem_lifegroup as
  select vp.* from public.visitor_pipeline vp
  where vp.stage in ('contato_realizado','convidado_culto','participou')
    and vp.life_group_invite_at is null
  order by vp.created_at asc;

-- Sem discipulador: participou de life group, mas sem discipulado iniciado
create or replace view public.acolhimento_sem_discipulador as
  select vp.* from public.visitor_pipeline vp
  where vp.stage in ('participou','consolidacao')
    and vp.discipleship_started_at is null
  order by vp.created_at asc;

-- Sem batismo: passou da consolidacao mas sem batismo
create or replace view public.acolhimento_sem_batismo as
  select vp.* from public.visitor_pipeline vp
  where vp.stage in ('discipulado','consolidacao')
    and vp.baptism_date is null
  order by vp.created_at asc;

-- Em consolidacao
create or replace view public.acolhimento_em_consolidacao as
  select vp.* from public.visitor_pipeline vp
  where vp.stage = 'consolidacao'
  order by vp.updated_at desc;

-- Integrados (membro+)
create or replace view public.acolhimento_integrados as
  select vp.* from public.visitor_pipeline vp
  where vp.stage in ('batizado','membro','servo','lider')
  order by vp.member_date desc nulls last, vp.created_at desc;

-- ---------- 2) RPC: admin atualiza pipeline com timestamps ----------
-- Quando o admin move pra "contato_realizado" pela primeira vez, marca first_contact_at.
-- Mesma logica para os outros campos derivados.
create or replace function public.pipeline_update_stage(
  p_pipeline_id uuid,
  p_new_stage   pipeline_stage,
  p_notes       text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_prev pipeline_stage; v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  -- Confere se quem chama e admin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select stage into v_prev from public.visitor_pipeline where id = p_pipeline_id;
  if v_prev is null then
    raise exception 'pipeline not found';
  end if;

  update public.visitor_pipeline
     set stage = p_new_stage,
         internal_notes = coalesce(p_notes, internal_notes),
         first_contact_at = case
            when first_contact_at is null
                 and p_new_stage in ('contato_realizado','convidado_culto','convidado_life_group','participou','discipulado','consolidacao','batizado','membro','servo','lider')
            then now()
            else first_contact_at end,
         life_group_invite_at = case
            when life_group_invite_at is null
                 and p_new_stage in ('convidado_life_group','participou','discipulado','consolidacao','batizado','membro','servo','lider')
            then now()
            else life_group_invite_at end,
         discipleship_started_at = case
            when discipleship_started_at is null
                 and p_new_stage in ('discipulado','consolidacao','batizado','membro','servo','lider')
            then now()
            else discipleship_started_at end,
         baptism_date = case
            when baptism_date is null
                 and p_new_stage in ('batizado','membro','servo','lider')
            then current_date
            else baptism_date end,
         member_date = case
            when member_date is null
                 and p_new_stage in ('membro','servo','lider')
            then current_date
            else member_date end
   where id = p_pipeline_id
   returning id into v_id;

  return v_id;
end; $$;

grant execute on function public.pipeline_update_stage(uuid, pipeline_stage, text) to authenticated;

-- ---------- 3) RPC: admin atribui responsavel ----------
create or replace function public.pipeline_assign(
  p_pipeline_id uuid,
  p_assigned_to uuid
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not public.is_admin() then raise exception 'forbidden'; end if;

  update public.visitor_pipeline
     set assigned_to = p_assigned_to
   where id = p_pipeline_id
   returning id into v_id;

  return v_id;
end; $$;

grant execute on function public.pipeline_assign(uuid, uuid) to authenticated;
