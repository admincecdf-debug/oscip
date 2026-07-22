-- ============================================================
-- CEC FAMILY — Fix definitivo: convite de Pastor (ou qualquer
-- outro cargo) ficava com profiles.role = 'membro' em vez do
-- cargo definido no convite.
--
-- Esse arquivo consolida TODAS as correções já feitas em
-- consume_invite_link ao longo do projeto (algumas rodaram direto
-- no SQL Editor sem serem commitadas no GitHub, o que deixou
-- incerto qual versão estava realmente ativa). A partir de agora
-- essa é a versão única e definitiva.
--
-- O que ela garante:
--  1. profiles.role = target_role do convite (o bug relatado)
--  2. e-mail/telefone da conta ficam gravados no cadastro de membro
--  3. Situação Ministerial mapeada pelo tipo de convite (não fixa
--     em "novo_convertido")
--  4. Designação automática de Liderança quando o convite implica
--     uma função de liderança formal (se assign_leadership não
--     existir ainda, ignora sem quebrar o cadastro)
--  5. Funciona mesmo sem sessão ativa (projeto exige confirmação de
--     e-mail) — usa p_user_id explícito
-- ============================================================

create or replace function public.consume_invite_link(
  p_token text, p_ip text default null, p_user_agent text default null,
  p_phone text default null, p_user_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_link record;
  v_uid uuid;
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

  -- 1) Aplica o cargo (role) definido no convite — ESSE É O FIX PRINCIPAL
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

  -- 3) Cria/atualiza o registro de membro, já com e-mail e telefone da conta
  if v_link.church_id is not null then
    insert into public.members (profile_id, full_name, email, phone, life_group_id, church_id, journey_stage, status, joined_at)
    select v_uid, p.full_name, p.email, coalesce(p_phone, p.phone), v_link.life_group_id, v_link.church_id, v_journey_stage::journey_stage, 'ativo', now()
    from public.profiles p where p.id = v_uid
    on conflict do nothing;
  end if;

  -- 4) Designação automática de Liderança (se a função existir; nunca quebra o cadastro se não existir)
  v_leadership_function := case v_link.kind
    when 'pastor'         then 'pastor_auxiliar'
    when 'lider_lg'       then 'lider_lg'
    when 'lider_jovens'   then 'lider_jovens'
    when 'lider_casais'   then 'lider_casais'
    when 'lider_criancas' then 'lider_infantil'
    when 'musico'         then 'lider_louvor'
    else null
  end;

  if v_leadership_function is not null and v_link.church_id is not null then
    begin
      perform public.assign_leadership(
        v_uid, v_leadership_function::leadership_function, v_link.church_id,
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
-- Backfill: corrige quem já se cadastrou com o bug (role ficou
-- 'membro' mesmo tendo convite de outro cargo). Busca pelo
-- target_role do convite que a pessoa efetivamente usou.
-- ============================================================
update public.profiles p
set role = sub.target_role
from (
  select distinct on (u.used_by) u.used_by, il.target_role
  from public.invite_link_uses u
  join public.invite_links il on il.id = u.invite_link_id
  order by u.used_by, u.created_at desc
) sub
where p.id = sub.used_by
  and p.role = 'membro'
  and sub.target_role <> 'membro';
