-- ============================================================
-- FIX002 — Corrige members.church_id ausente
-- ============================================================
-- PROBLEMA ENCONTRADO:
-- A rota /api/admin/create-member cria o registro em `members` com
-- `life_group_id`, mas NUNCA preenche `church_id`. As políticas de RLS
-- (members_scoped_read / members_scoped_write, ver C13c) exigem
-- `church_id in (select accessible_church_ids())`. Como NULL nunca
-- satisfaz esse "in", isso causa dois sintomas:
--   1) O membro criado não aparece pra ninguém (nem pra quem criou).
--   2) DELETE em membros com church_id nulo falha SILENCIOSAMENTE
--      (RLS bloqueia a linha, o Supabase não retorna erro, só não
--      apaga nada — por isso a confirmação aparece mas nada some).
--
-- Esta migration:
--   1) Backfill: preenche church_id de membros existentes que têm
--      life_group_id mas church_id nulo, usando o church_id do
--      Life Group.
--   2) Trigger de segurança: qualquer INSERT/UPDATE futuro em members
--      que tenha life_group_id definido terá church_id sincronizado
--      automaticamente a partir do Life Group (defesa em profundidade,
--      além do fix no código da aplicação).
-- Idempotente.
-- ============================================================

-- ---------- 1) Backfill dos registros já quebrados ----------
update public.members m
set church_id = lg.church_id
from public.life_groups lg
where m.life_group_id = lg.id
  and m.church_id is null
  and lg.church_id is not null;

-- ---------- 2) Função + trigger: mantém church_id sincronizado ----------
create or replace function public.sync_member_church_from_lg()
returns trigger
language plpgsql as $$
declare
  v_church_id uuid;
begin
  if new.life_group_id is not null then
    select church_id into v_church_id from public.life_groups where id = new.life_group_id;
    if v_church_id is not null then
      new.church_id := v_church_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_members_sync_church on public.members;
create trigger trg_members_sync_church
  before insert or update of life_group_id on public.members
  for each row execute function public.sync_member_church_from_lg();

-- ---------- 3) Relatório de conferência (aparece no log da migration) ----------
do $$
declare
  v_ainda_sem_church int;
begin
  select count(*) into v_ainda_sem_church
  from public.members
  where church_id is null;

  if v_ainda_sem_church > 0 then
    raise notice 'ATENÇÃO: ainda existem % membro(s) sem church_id e sem life_group_id que permita deduzir (verifique manualmente em Pessoas → Membros).', v_ainda_sem_church;
  end if;
end $$;
