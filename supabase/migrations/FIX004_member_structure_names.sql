-- ============================================================
-- FIX004 — Corrige exibição falsa de "sem Life Group" na aba Estrutura
-- ============================================================
-- PROBLEMA: MemberEditDialog.tsx (aba Estrutura) mostra o nome atual
-- da Igreja/Life Group do membro procurando dentro de useCells()/
-- useChurches() — que já vêm filtrados pelo escopo territorial de
-- quem está logado (church_id in accessible_church_ids()).
--
-- Se o Life Group do membro estiver numa Igreja fora do escopo de
-- quem abriu a tela, o .find() não encontra nada e a tela mostra
-- "sem Life Group" — mesmo o membro TENDO um Life Group de verdade.
-- Isso pode levar alguém a achar que falta reatribuir uma célula que
-- já está correta, ou a duplicar uma atribuição.
--
-- Esta função resolve o nome real de Igreja/Life Group do membro,
-- liberando a informação sempre que quem pergunta já tem o direito
-- de ver aquele membro (mesma regra de members_scoped_read: escopo
-- territorial, apóstolo, ou é o próprio membro) — não depende do
-- escopo territorial do Life Group em si.
-- Idempotente.
-- ============================================================

create or replace function public.member_structure_names(p_member_id uuid)
returns table(church_name text, life_group_name text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_church_id uuid;
  v_lg_id uuid;
  v_profile_id uuid;
begin
  select m.church_id, m.life_group_id, m.profile_id
    into v_church_id, v_lg_id, v_profile_id
  from public.members m
  where m.id = p_member_id;

  if not found then
    return;
  end if;

  -- Mesma regra de acesso da policy members_scoped_read
  if not (
    public.is_apostle()
    or v_church_id in (select public.accessible_church_ids())
    or v_profile_id = auth.uid()
  ) then
    return;
  end if;

  return query
  select
    (select ch.name from public.churches ch where ch.id = v_church_id),
    (select lg.name from public.life_groups lg where lg.id = v_lg_id);
end;
$$;
grant execute on function public.member_structure_names(uuid) to authenticated;
