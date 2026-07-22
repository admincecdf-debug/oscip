-- ============================================================
-- FIX003 — Apóstolo consegue corrigir/remover membros órfãos
--          + Convite sem Life Group volta a criar o registro de membro
-- ============================================================
-- PROBLEMA 1: members_scoped_write (RLS) exige
--   church_id in (select accessible_church_ids())
-- Como NULL nunca satisfaz esse "in" (nem pra apóstolo), um membro
-- com church_id nulo fica IMPOSSÍVEL de editar ou excluir pelo app,
-- pra qualquer perfil — vira um registro "preso" que só dá pra
-- consertar direto no banco. Corrigido: apóstolo agora sempre pode
-- escrever, independente do church_id da linha.
--
-- PROBLEMA 2: consume_invite_link() só criava o registro em `members`
-- quando o link de convite já tinha um life_group_id definido. Convites
-- de "cadastro simples" (só Igreja, sem Life Group ainda — cenário
-- previsto no PILOTO-001, seção 8.2 "membro sem Life Group") faziam
-- a pessoa criar conta e logar, mas NUNCA aparecer em Pessoas → Membros,
-- porque a linha em `members` simplesmente não era criada.
-- Corrigido: cria o registro sempre que houver church_id OU
-- life_group_id no convite (deduzindo o church_id do LG quando faltar).
-- Idempotente.
-- ============================================================

-- ---------- 1) RLS — apóstolo sempre pode escrever em members ----------
drop policy if exists members_scoped_write on public.members;
create policy members_scoped_write on public.members for all to authenticated
  using (public.is_apostle() or church_id in (select public.accessible_church_ids()))
  with check (public.is_apostle() or church_id in (select public.accessible_church_ids()));

-- ---------- 2) consume_invite_link — cria membro mesmo sem Life Group ----------
create or replace function public.consume_invite_link(
  p_token text, p_ip text default null, p_user_agent text default null, p_phone text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_link record;
  v_church_id uuid;
begin
  select * into v_link from public.invite_links il where il.token = p_token for update;
  if v_link.id is null then raise exception 'Convite inválido'; end if;
  if v_link.revoked_at is not null then raise exception 'Convite revogado'; end if;
  if v_link.expires_at is not null and v_link.expires_at < now() then raise exception 'Convite expirado'; end if;
  if v_link.max_uses is not null and v_link.uses_count >= v_link.max_uses then raise exception 'Convite esgotado'; end if;

  -- Vincula o profile recém-criado (trigger on_auth_user_created já rodou) à estrutura do link
  update public.profiles set
    role = v_link.target_role,
    church_id = coalesce(v_link.church_id, church_id),
    phone = coalesce(p_phone, phone)
  where id = auth.uid();

  -- Resolve church_id: o do link, ou deduzido do Life Group do link
  v_church_id := v_link.church_id;
  if v_church_id is null and v_link.life_group_id is not null then
    select church_id into v_church_id from public.life_groups where id = v_link.life_group_id;
  end if;

  -- Cria o registro de membro sempre que houver Igreja OU Life Group no convite
  -- (antes só criava quando life_group_id não era nulo — convite "só Igreja" ficava sem membro)
  if v_church_id is not null or v_link.life_group_id is not null then
    insert into public.members (profile_id, full_name, life_group_id, church_id, journey_stage, status, joined_at)
    select auth.uid(), p.full_name, v_link.life_group_id, v_church_id, 'novo_convertido', 'ativo', now()
    from public.profiles p where p.id = auth.uid()
    on conflict do nothing;
  end if;

  if v_link.discipler_id is not null then
    insert into public.discipleship (discipler_id, disciple_id, status, started_on)
    values (v_link.discipler_id, auth.uid(), 'ativo', current_date)
    on conflict do nothing;
  end if;

  if v_link.ministry_id is not null then
    insert into public.ministry_members (ministry_id, profile_id, role)
    values (v_link.ministry_id, auth.uid(), 'membro')
    on conflict do nothing;
  end if;

  update public.invite_links set uses_count = uses_count + 1 where id = v_link.id;

  insert into public.invite_link_uses (invite_link_id, used_by, ip, user_agent)
  values (v_link.id, auth.uid(), p_ip, p_user_agent);

  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (auth.uid(), 'insert', 'invite_link_use', v_link.id);
end; $$;
grant execute on function public.consume_invite_link(text, text, text, text) to authenticated;
