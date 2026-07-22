-- ============================================================
-- CEC FAMILY — Fix: Estado não aparecia nos dados do membro nem na
-- Carteira de Membro.
--
-- Causa raiz: a Carteira usava churches.state, um campo de texto
-- solto (endereço da igreja, digitado manualmente e geralmente
-- vazio) — sem nenhuma relação com a árvore territorial de verdade
-- (Estado → Núcleo → Distrito → Setor → Igreja) que já existe no
-- sistema. Como essa árvore respeita níveis flexíveis (pode pular
-- Núcleo/Distrito/Setor), a resolução precisa subir pela cadeia
-- real, não um campo fixo.
--
-- Esse arquivo reconstrói a função de resolução de forma completa
-- e independente (não presume que peças de outra migration não
-- commitada já existam), e é usada tanto no cadastro do membro
-- quanto na Carteira.
-- ============================================================

drop function if exists public.resolve_church_ancestry(uuid) cascade;
create or replace function public.resolve_church_ancestry(p_church_id uuid)
returns table (
  state_id uuid, state_name text, state_uf text,
  nucleo_id uuid, nucleo_name text,
  district_id uuid, district_name text,
  sector_id uuid, sector_name text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_church record;
  v_sector_id uuid;
  v_district_id uuid;
  v_nucleo_id uuid;
  v_state_id uuid;
  v_sector record;
  v_district record;
begin
  select * into v_church from public.churches where id = p_church_id;
  if v_church.id is null then return; end if;

  -- 1) Igreja → resolve o Setor (direto, ou pulando pro Distrito/Núcleo)
  if v_church.parent_level = 'setor' then
    v_sector_id := v_church.parent_territorial_id;
  elsif v_church.parent_level = 'distrito' then
    v_district_id := v_church.parent_territorial_id;
  elsif v_church.parent_level = 'nucleo' then
    v_nucleo_id := v_church.parent_territorial_id;
  elsif v_church.sector_id is not null then
    v_sector_id := v_church.sector_id;
  end if;

  -- 2) Setor → resolve o Distrito (direto, ou pulando pro Núcleo)
  if v_sector_id is not null then
    select * into v_sector from public.sectors where id = v_sector_id;
    if v_sector.parent_level = 'nucleo' then
      v_nucleo_id := v_sector.parent_id;
    else
      v_district_id := v_sector.parent_id;
    end if;
  end if;

  -- 3) Distrito → resolve o Núcleo (direto, ou pulando pro Estado)
  if v_district_id is not null and v_nucleo_id is null then
    select * into v_district from public.districts where id = v_district_id;
    if v_district.parent_level = 'estado' then
      v_state_id := v_district.parent_id;
    else
      v_nucleo_id := v_district.parent_id;
    end if;
  end if;

  -- 4) Núcleo → Estado (sempre direto)
  if v_nucleo_id is not null and v_state_id is null then
    select ns.state_id into v_state_id from public.nucleos ns where ns.id = v_nucleo_id;
  end if;

  return query
  select
    s.id, s.name, s.uf,
    n.id, n.name,
    d.id, d.name,
    se.id, se.name
  from (select v_state_id as id) x
  left join public.states s on s.id = v_state_id
  left join public.nucleos n on n.id = v_nucleo_id
  left join public.districts d on d.id = v_district_id
  left join public.sectors se on se.id = v_sector_id;
end; $$;
grant execute on function public.resolve_church_ancestry(uuid) to authenticated, anon;

-- ============================================================
-- View de conveniência (usada pelos filtros territoriais do admin)
-- ============================================================
create or replace view public.church_ancestry as
select
  c.id as church_id,
  a.state_id, a.state_name, a.state_uf,
  a.nucleo_id, a.nucleo_name,
  a.district_id, a.district_name,
  a.sector_id, a.sector_name
from public.churches c
cross join lateral public.resolve_church_ancestry(c.id) a;

grant select on public.church_ancestry to authenticated;

-- ============================================================
-- RPC leve especificamente pro nome do Estado (usado na Carteira)
-- ============================================================
create or replace function public.church_state_name(p_church_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select state_name from public.resolve_church_ancestry(p_church_id) limit 1;
$$;
grant execute on function public.church_state_name(uuid) to authenticated, anon;

-- ============================================================
-- Fix relacionado: "Data de Emissão" deve ser o momento em que o
-- ADMINISTRADOR aprova a carteirinha — não quando o membro abre a
-- tela pela primeira vez (como estava, via issue_member_card
-- chamado só na visualização). Agora aprovação já emite na hora.
-- ============================================================
create or replace function public.approve_member_card(p_member_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  m record;
  v_completion int;
begin
  select * into m from public.members where id = p_member_id;
  if m.id is null then raise exception 'Membro não encontrado'; end if;

  if not public.is_apostle() and m.church_id not in (select public.accessible_church_ids()) then
    raise exception 'Sem permissão sobre este membro' using errcode = '42501';
  end if;

  v_completion := public.member_completion_percent(p_member_id);
  if v_completion < 100 then
    raise exception 'Cadastro ainda incompleto (% de 100) — não é possível aprovar.', v_completion;
  end if;

  update public.members set
    card_approved_by = auth.uid(), card_approved_at = now(),
    card_status = 'emitida', card_issued_at = coalesce(card_issued_at, now())
  where id = p_member_id;

  begin
    perform public.audit_log('update', 'members', p_member_id, jsonb_build_object('acao', 'aprovacao_carteirinha'));
  exception when others then null;
  end;
end; $$;
grant execute on function public.approve_member_card(uuid) to authenticated;

-- View precisa expor card_issued_at pra tela conseguir mostrar a data real
create or replace view public.members_card_view as
select m.id as member_id, m.cec_id, m.card_status, m.card_approved_at, m.qr_token,
       public.member_category(m.id) as categoria,
       public.member_completion_percent(m.id) as completion_percent,
       m.card_issued_at
from public.members m;

grant select on public.members_card_view to authenticated;
