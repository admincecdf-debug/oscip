-- ============================================================
-- CEC FAMILY — Aba Liderança (script de melhoria, Seção 6)
-- Log de designações ministeriais com histórico preservado —
-- diferente de profiles.role (que só guarda o cargo atual), essa
-- tabela guarda CADA designação com início/fim, permitindo consultar
-- "quem foi Pastor Principal de Manaus antes do atual".
-- Idempotente.
-- ============================================================

do $$ begin
  create type leadership_function as enum (
    'apostolo','pastor_principal','pastor_auxiliar','pastor_distrito',
    'supervisor_distrito','supervisor_area','supervisor_setor',
    'lider_lg','lider_auxiliar','diacono','lider_ministerio',
    'lider_louvor','lider_jovens','lider_casais','lider_infantil',
    'lider_evangelismo','lider_missoes','outro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type leadership_status as enum ('ativo','encerrado');
exception when duplicate_object then null; end $$;

create table if not exists public.leadership_assignments (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  function_type   leadership_function not null,
  scope_level     scope_level,
  scope_id        uuid,
  church_id       uuid references public.churches(id) on delete set null,
  ministry_id     uuid references public.ministries(id) on delete set null,
  life_group_id   uuid references public.life_groups(id) on delete set null,
  started_at      date not null default current_date,
  ended_at        date,
  status          leadership_status not null default 'ativo',
  assigned_by     uuid references public.profiles(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);
comment on table public.leadership_assignments is 'Histórico de designações ministeriais (Seção 6 do script de melhoria) — preserva quem ocupou cada função, quando.';

create index if not exists idx_leadership_profile on public.leadership_assignments(profile_id);
create index if not exists idx_leadership_church on public.leadership_assignments(church_id) where church_id is not null;
create index if not exists idx_leadership_active on public.leadership_assignments(church_id, function_type) where status = 'ativo';

-- Regra: só pode existir 1 Pastor Principal ATIVO por igreja
create unique index if not exists uq_one_active_pastor_principal_per_church
  on public.leadership_assignments(church_id)
  where status = 'ativo' and function_type = 'pastor_principal' and church_id is not null;

alter table public.leadership_assignments enable row level security;

drop policy if exists leadership_read on public.leadership_assignments;
create policy leadership_read on public.leadership_assignments for select to authenticated
  using (
    public.is_apostle()
    or church_id in (select public.accessible_church_ids())
    or profile_id = auth.uid()
  );

drop policy if exists leadership_write on public.leadership_assignments;
create policy leadership_write on public.leadership_assignments for all to authenticated
  using (public.is_apostle() or church_id in (select public.accessible_church_ids()))
  with check (public.is_apostle() or church_id in (select public.accessible_church_ids()));

-- ============================================================
-- RPC: designar liderança — encerra automaticamente o Pastor Principal
-- anterior daquela igreja (se houver e for esse o tipo), preservando histórico.
-- ============================================================
create or replace function public.assign_leadership(
  p_profile_id uuid,
  p_function_type leadership_function,
  p_church_id uuid default null,
  p_scope_level scope_level default null,
  p_scope_id uuid default null,
  p_ministry_id uuid default null,
  p_life_group_id uuid default null,
  p_started_at date default current_date,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_new_id uuid;
begin
  if p_function_type = 'pastor_principal' and p_church_id is not null then
    update public.leadership_assignments
    set status = 'encerrado', ended_at = p_started_at - interval '1 day'
    where church_id = p_church_id and function_type = 'pastor_principal' and status = 'ativo';
  end if;

  insert into public.leadership_assignments (
    profile_id, function_type, church_id, scope_level, scope_id,
    ministry_id, life_group_id, started_at, status, assigned_by, notes
  ) values (
    p_profile_id, p_function_type, p_church_id, p_scope_level, p_scope_id,
    p_ministry_id, p_life_group_id, p_started_at, 'ativo', auth.uid(), p_notes
  ) returning id into v_new_id;

  begin
    perform public.audit_log('insert', 'leadership_assignments', v_new_id,
      jsonb_build_object('profile_id', p_profile_id, 'function_type', p_function_type));
  exception when others then null;
  end;

  return v_new_id;
end; $$;
grant execute on function public.assign_leadership(
  uuid, leadership_function, uuid, scope_level, uuid, uuid, uuid, date, text
) to authenticated;

-- ============================================================
-- RPC: remanejamento — encerra a designação atual e cria a nova, atômico
-- (Seção 6.6 do script: "Pastor Auxiliar — Manaus/AM → Pastor Principal — Cascavel/PR")
-- ============================================================
create or replace function public.remanejar_lideranca(
  p_current_assignment_id uuid,
  p_new_function_type leadership_function,
  p_new_church_id uuid default null,
  p_new_scope_level scope_level default null,
  p_new_scope_id uuid default null,
  p_new_ministry_id uuid default null,
  p_new_life_group_id uuid default null,
  p_effective_date date default current_date,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_profile_id uuid;
  v_new_id uuid;
begin
  select profile_id into v_profile_id from public.leadership_assignments where id = p_current_assignment_id;
  if v_profile_id is null then raise exception 'Designação atual não encontrada'; end if;

  update public.leadership_assignments
  set status = 'encerrado', ended_at = p_effective_date
  where id = p_current_assignment_id;

  v_new_id := public.assign_leadership(
    v_profile_id, p_new_function_type, p_new_church_id, p_new_scope_level, p_new_scope_id,
    p_new_ministry_id, p_new_life_group_id, p_effective_date, p_notes
  );

  -- Mantém profiles.role/church_id em sincronia com a nova designação, quando fizer sentido
  if p_new_church_id is not null then
    update public.profiles set church_id = p_new_church_id where id = v_profile_id;
  end if;

  begin
    perform public.audit_log('update', 'leadership_assignments', v_new_id,
      jsonb_build_object('remanejado_de', p_current_assignment_id));
  exception when others then null;
  end;

  return v_new_id;
end; $$;
grant execute on function public.remanejar_lideranca(
  uuid, leadership_function, uuid, scope_level, uuid, uuid, uuid, date, text
) to authenticated;

-- ============================================================
-- View de leitura, já com nomes resolvidos (evita N+1 no front)
-- ============================================================
create or replace view public.leadership_assignments_view as
select
  la.id, la.function_type, la.status, la.started_at, la.ended_at, la.notes,
  la.profile_id, p.full_name as profile_name, p.email as profile_email,
  la.church_id, ch.name as church_name,
  la.ministry_id, mi.name as ministry_name,
  la.life_group_id, lg.name as life_group_name,
  la.scope_level, la.scope_id,
  la.assigned_by, ab.full_name as assigned_by_name,
  la.created_at
from public.leadership_assignments la
join public.profiles p on p.id = la.profile_id
left join public.churches ch on ch.id = la.church_id
left join public.ministries mi on mi.id = la.ministry_id
left join public.life_groups lg on lg.id = la.life_group_id
left join public.profiles ab on ab.id = la.assigned_by;

grant select on public.leadership_assignments_view to authenticated;
