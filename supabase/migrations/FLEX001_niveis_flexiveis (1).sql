-- ============================================================
-- CEC FAMILY — Níveis Territoriais Flexíveis
-- Troca FK fixa (districts.nucleo_id obrigatório, sectors.district_id
-- obrigatório, churches.sector_id obrigatório) por pai flexível:
-- cada entidade pode "pular" níveis, igual os 3 exemplos do script
-- de melhoria (Sede→Distrito→Setor→LG / Sede→Distrito→Área→Setor→LG /
-- Igreja→LG direto).
--
-- Padrão reaproveitado de profiles.scope_level/scope_id.
-- Idempotente. Mantém as colunas antigas (nucleo_id/district_id/sector_id)
-- só pra não perder dado histórico — o sistema passa a usar
-- parent_level/parent_id como fonte da verdade.
-- ============================================================

-- ---------- 1) Colunas novas ----------
do $$ begin
  create type district_parent_level as enum ('estado','nucleo');
exception when duplicate_object then null; end $$;
do $$ begin
  create type sector_parent_level as enum ('nucleo','distrito');
exception when duplicate_object then null; end $$;
do $$ begin
  create type church_parent_level as enum ('nucleo','distrito','setor');
exception when duplicate_object then null; end $$;

alter table public.districts add column if not exists parent_level district_parent_level;
alter table public.districts add column if not exists parent_id uuid;

alter table public.sectors add column if not exists parent_level sector_parent_level;
alter table public.sectors add column if not exists parent_id uuid;

alter table public.churches add column if not exists parent_level church_parent_level;
alter table public.churches add column if not exists parent_territorial_id uuid;
-- (nome parent_territorial_id pra não colidir com o parent_id antigo de churches,
--  que já existia com outro significado — sede/núcleo autorreferenciado legado)

-- ---------- 2) Backfill: dado existente vira o caminho completo (não pula nada) ----------
update public.districts set parent_level = 'nucleo', parent_id = nucleo_id
where parent_level is null and nucleo_id is not null;

update public.sectors set parent_level = 'distrito', parent_id = district_id
where parent_level is null and district_id is not null;

update public.churches set parent_level = 'setor', parent_territorial_id = sector_id
where parent_level is null and sector_id is not null;

-- ---------- 3) Resolução recursiva de ancestralidade ----------
-- A partir de qualquer nível (distrito/setor), sobe a árvore até achar
-- Núcleo ou Estado, preenchendo o que passar no caminho. Níveis pulados
-- ficam null (é esperado — significa "não existe esse nível aqui").
create or replace function public.resolve_territorial_ancestry(p_level text, p_id uuid)
returns table(out_state_id uuid, out_nucleo_id uuid, out_district_id uuid, out_sector_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  cur_level text := p_level;
  cur_id uuid := p_id;
  v_state uuid; v_nucleo uuid; v_district uuid; v_sector uuid;
  v_next_level text; v_next_id uuid;
  i int := 0;
begin
  while cur_level is not null and cur_id is not null and i < 10 loop
    i := i + 1;
    if cur_level = 'estado' then
      v_state := cur_id; cur_level := null;
    elsif cur_level = 'nucleo' then
      v_nucleo := cur_id;
      select state_id into v_state from public.nucleos where id = cur_id;
      cur_level := null;
    elsif cur_level = 'distrito' then
      v_district := cur_id;
      select parent_level::text, parent_id into v_next_level, v_next_id from public.districts where id = cur_id;
      cur_level := v_next_level; cur_id := v_next_id;
    elsif cur_level = 'setor' then
      v_sector := cur_id;
      select parent_level::text, parent_id into v_next_level, v_next_id from public.sectors where id = cur_id;
      cur_level := v_next_level; cur_id := v_next_id;
    else
      cur_level := null;
    end if;
  end loop;
  return query select v_state, v_nucleo, v_district, v_sector;
end; $$;
grant execute on function public.resolve_territorial_ancestry(text, uuid) to authenticated;

create or replace function public.resolve_church_ancestry(p_church_id uuid)
returns table(state_id uuid, nucleo_id uuid, district_id uuid, sector_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_parent_level text; v_parent_id uuid;
begin
  select parent_level::text, parent_territorial_id into v_parent_level, v_parent_id
  from public.churches where id = p_church_id;
  return query select * from public.resolve_territorial_ancestry(v_parent_level, v_parent_id);
end; $$;
grant execute on function public.resolve_church_ancestry(uuid) to authenticated;

-- View com a ancestralidade de TODAS as igrejas já resolvida (evita recalcular
-- a recursão a cada policy/consulta — usada por accessible_church_ids e pela
-- view de saúde do dashboard).
create or replace view public.church_ancestry as
select ch.id as church_id, anc.state_id as state_id, anc.nucleo_id as nucleo_id,
       anc.district_id as district_id, anc.sector_id as sector_id
from public.churches ch
cross join lateral public.resolve_church_ancestry(ch.id) anc;

grant select on public.church_ancestry to authenticated;

-- ---------- 4) accessible_church_ids() — reescrita pra árvore flexível ----------
create or replace function public.accessible_church_ids()
returns setof uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_scope_level scope_level;
  v_scope_id uuid;
  v_church uuid;
begin
  select role::text, scope_level, scope_id, church_id
    into v_role, v_scope_level, v_scope_id, v_church
  from public.profiles where id = auth.uid();

  if v_role = 'apostolo' or v_scope_level = 'nacional' or (v_scope_level is null and v_church is null) then
    return query select id from public.churches;
    return;
  end if;

  if v_scope_level = 'estado' then
    return query select church_id from public.church_ancestry where state_id = v_scope_id;
    return;
  end if;

  if v_scope_level = 'nucleo' then
    return query select church_id from public.church_ancestry where nucleo_id = v_scope_id;
    return;
  end if;

  if v_scope_level = 'distrito' then
    return query select church_id from public.church_ancestry where district_id = v_scope_id;
    return;
  end if;

  if v_scope_level = 'setor' then
    return query select church_id from public.church_ancestry where sector_id = v_scope_id;
    return;
  end if;

  -- 'igreja' (ou legado via church_id): só a própria igreja
  return query select coalesce(v_scope_id, v_church) where coalesce(v_scope_id, v_church) is not null;
end; $$;
grant execute on function public.accessible_church_ids() to authenticated;
