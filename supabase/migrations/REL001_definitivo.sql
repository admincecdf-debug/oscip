-- ============================================================
-- CEC FAMILY — Fix definitivo: Realocação/Transferência de membros
-- (aba Estrutura do editor de membro "não salva os dados
-- selecionados"). A função relocate_member não existe neste
-- repositório — reconstruída aqui de forma completa e idempotente
-- a partir do contrato já usado pelo frontend
-- (src/services/relocations.ts, src/services/members.ts).
-- ============================================================

do $$ begin
  create type relocation_reason as enum (
    'correcao_cadastro','mudanca_endereco','transferencia_ministerial','mudanca_igreja',
    'multiplicacao_lg','reorganizacao_territorial','designacao_pastoral','solicitacao_membro','outro'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.member_relocations (
  id                   uuid primary key default gen_random_uuid(),
  member_id            uuid not null references public.members(id) on delete cascade,
  from_church_id       uuid references public.churches(id) on delete set null,
  from_life_group_id   uuid references public.life_groups(id) on delete set null,
  to_church_id         uuid references public.churches(id) on delete set null,
  to_life_group_id     uuid references public.life_groups(id) on delete set null,
  reason               relocation_reason not null,
  notes                text,
  previous_function    text,
  new_function         text,
  performed_by         uuid references public.profiles(id) on delete set null,
  approved_by          uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now()
);

alter table public.member_relocations add column if not exists from_church_id uuid references public.churches(id) on delete set null;
alter table public.member_relocations add column if not exists from_life_group_id uuid references public.life_groups(id) on delete set null;
alter table public.member_relocations add column if not exists to_church_id uuid references public.churches(id) on delete set null;
alter table public.member_relocations add column if not exists to_life_group_id uuid references public.life_groups(id) on delete set null;
alter table public.member_relocations add column if not exists previous_function text;
alter table public.member_relocations add column if not exists new_function text;
alter table public.member_relocations add column if not exists approved_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_member_relocations_member on public.member_relocations(member_id);

alter table public.member_relocations enable row level security;

drop policy if exists member_relocations_scoped on public.member_relocations;
create policy member_relocations_scoped on public.member_relocations for select to authenticated
  using (
    member_id in (
      select id from public.members
      where church_id in (select public.accessible_church_ids())
    )
  );

grant select on public.member_relocations to authenticated;

-- ============================================================
-- RPC: relocate_member — move o membro pra outra Igreja/Life Group,
-- preservando histórico. Exige abrangência sobre origem E destino.
-- ============================================================
create or replace function public.relocate_member(
  p_member_id uuid, p_to_church_id uuid, p_to_life_group_id uuid default null,
  p_reason relocation_reason default 'correcao_cadastro', p_notes text default null,
  p_previous_function text default null, p_new_function text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  m record;
  v_id uuid;
begin
  select id, church_id, life_group_id into m from public.members where id = p_member_id;
  if m.id is null then raise exception 'Membro não encontrado'; end if;

  if not public.is_apostle() then
    if m.church_id is not null and m.church_id not in (select public.accessible_church_ids()) then
      raise exception 'Sem permissão sobre a unidade de origem do membro' using errcode = '42501';
    end if;
    if p_to_church_id not in (select public.accessible_church_ids()) then
      raise exception 'Sem permissão sobre a unidade de destino' using errcode = '42501';
    end if;
  end if;

  insert into public.member_relocations (
    member_id, from_church_id, from_life_group_id, to_church_id, to_life_group_id,
    reason, notes, previous_function, new_function, performed_by
  ) values (
    p_member_id, m.church_id, m.life_group_id, p_to_church_id, p_to_life_group_id,
    p_reason, p_notes, p_previous_function, p_new_function, auth.uid()
  ) returning id into v_id;

  update public.members set church_id = p_to_church_id, life_group_id = p_to_life_group_id where id = p_member_id;

  begin
    perform public.audit_log('update', 'members', p_member_id, jsonb_build_object('acao', 'realocacao', 'para_igreja', p_to_church_id));
  exception when others then null;
  end;

  return v_id;
end; $$;
grant execute on function public.relocate_member(uuid, uuid, uuid, relocation_reason, text, text, text) to authenticated;

-- ============================================================
-- View: member_relocations_view — histórico com nomes resolvidos
-- ============================================================
create or replace view public.member_relocations_view as
select
  r.id, r.member_id, m.full_name as member_name,
  r.from_church_id, fc.name as from_church_name,
  r.from_life_group_id, flg.name as from_life_group_name,
  r.to_church_id, tc.name as to_church_name,
  r.to_life_group_id, tlg.name as to_life_group_name,
  r.reason, r.notes, r.previous_function, r.new_function,
  r.performed_by, pp.full_name as performed_by_name,
  r.approved_by, ap.full_name as approved_by_name,
  r.created_at
from public.member_relocations r
left join public.members m on m.id = r.member_id
left join public.churches fc on fc.id = r.from_church_id
left join public.life_groups flg on flg.id = r.from_life_group_id
left join public.churches tc on tc.id = r.to_church_id
left join public.life_groups tlg on tlg.id = r.to_life_group_id
left join public.profiles pp on pp.id = r.performed_by
left join public.profiles ap on ap.id = r.approved_by;

grant select on public.member_relocations_view to authenticated;

-- ============================================================
-- RPC: member_structure_names — resolve nomes mesmo quando a
-- igreja/LG atual do membro está fora do escopo territorial de
-- quem está editando (evita mostrar "—" indevidamente).
-- ============================================================
create or replace function public.member_structure_names(p_member_id uuid)
returns table (church_name text, life_group_name text)
language sql stable security definer set search_path = public as $$
  select ch.name, lg.name
  from public.members m
  left join public.churches ch on ch.id = m.church_id
  left join public.life_groups lg on lg.id = m.life_group_id
  where m.id = p_member_id;
$$;
grant execute on function public.member_structure_names(uuid) to authenticated;
