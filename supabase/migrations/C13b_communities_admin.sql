-- ============================================================
-- CEC FAMILY — Ajuste módulo Comunidades + Estrutura Organizacional
-- - Novos campos administrativos em churches
-- - Enum church_status (Ativa / Em Implantação / Inativa)
-- - Função: contagem de dependências (pra validar exclusão)
-- - Função: pode_excluir (boolean)
-- Idempotente.
-- ============================================================

-- ---------- 1) Enum: situação administrativa da comunidade ----------
do $$ begin
  create type church_status as enum ('ativa', 'em_implantacao', 'inativa');
exception when duplicate_object then null; end $$;

-- ---------- 2) Campos novos em churches ----------
alter table public.churches
  add column if not exists phone_primary    text,
  add column if not exists phone_secondary  text,
  add column if not exists email            text,
  add column if not exists cep              text,
  add column if not exists numero           text,
  add column if not exists complemento      text,
  add column if not exists referencia       text,
  add column if not exists founded_at       date,
  add column if not exists status_admin     church_status not null default 'ativa',
  add column if not exists observations     text;

comment on column public.churches.phone_primary is 'Telefone principal da comunidade';
comment on column public.churches.phone_secondary is 'Telefone secundário';
comment on column public.churches.email is 'E-mail oficial';
comment on column public.churches.cep is 'CEP do endereço';
comment on column public.churches.numero is 'Número do endereço';
comment on column public.churches.complemento is 'Complemento (sala, andar etc.)';
comment on column public.churches.referencia is 'Ponto de referência';
comment on column public.churches.founded_at is 'Data de fundação';
comment on column public.churches.status_admin is 'Situação administrativa';
comment on column public.churches.observations is 'Observações livres';

-- Migra is_active → status_admin: linhas com is_active=false viram 'inativa'
update public.churches set status_admin = 'inativa' where is_active = false and status_admin = 'ativa';

-- ---------- 3) Função: contagem de dependências de uma comunidade ----------
-- Retorna JSON com counts por entidade que pode estar vinculada.
-- Usada pra validar exclusão e mostrar feedback no UI.
create or replace function public.church_dependencies(p_church_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_children    int;
  v_life_groups int;
  v_members     int;
  v_reports     int;
begin
  -- Comunidades filhas (núcleos ou locais que apontam pra esta)
  select count(*) into v_children
  from public.churches where parent_id = p_church_id;

  -- Life Groups vinculados diretamente
  select count(*) into v_life_groups
  from public.life_groups where church_id = p_church_id;

  -- Membros vinculados
  select count(*) into v_members
  from public.members where church_id = p_church_id;

  -- Relatórios semanais de qualquer LG da comunidade
  select count(*) into v_reports
  from public.meeting_reports mr
  join public.life_groups lg on lg.id = mr.life_group_id
  where lg.church_id = p_church_id;

  return jsonb_build_object(
    'children', v_children,
    'life_groups', v_life_groups,
    'members', v_members,
    'reports', v_reports,
    'total', v_children + v_life_groups + v_members + v_reports
  );
end; $$;

grant execute on function public.church_dependencies(uuid) to authenticated;

-- ---------- 4) Função: pode excluir? ----------
create or replace function public.can_delete_church(p_church_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select (public.church_dependencies(p_church_id)->>'total')::int = 0;
$$;

grant execute on function public.can_delete_church(uuid) to authenticated;

-- ---------- 5) Função: mover comunidade (troca parent_id com validação) ----------
-- Valida regras hierárquicas:
--   - Sede: pode ter parent NULL ou outra Sede
--   - Núcleo: parent obrigatório → deve ser Sede
--   - Local: parent obrigatório → pode ser Sede ou Núcleo
-- Impede ciclos (comunidade não pode ser pai de si mesma nem dos seus ancestrais)
create or replace function public.move_church(p_church_id uuid, p_new_parent_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_type        church_type;
  v_parent_type church_type;
  v_candidate   uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select type into v_type from public.churches where id = p_church_id;
  if v_type is null then
    raise exception 'church not found';
  end if;

  -- Se for null, é desvincular (válido apenas para sede)
  if p_new_parent_id is null then
    if v_type <> 'sede' then
      raise exception 'Apenas comunidades do tipo Sede podem ficar sem Comunidade Mãe';
    end if;
    update public.churches set parent_id = null where id = p_church_id;
    return;
  end if;

  -- Não pode ser pai de si mesma
  if p_new_parent_id = p_church_id then
    raise exception 'Uma comunidade não pode ser sua própria Comunidade Mãe';
  end if;

  -- Verificar tipo do novo pai
  select type into v_parent_type from public.churches where id = p_new_parent_id;
  if v_parent_type is null then
    raise exception 'Nova Comunidade Mãe não encontrada';
  end if;

  -- Regras de hierarquia
  if v_type = 'nucleo' and v_parent_type <> 'sede' then
    raise exception 'Núcleo só pode ter uma Sede como Comunidade Mãe';
  end if;
  if v_type = 'igreja_local' and v_parent_type not in ('sede', 'nucleo') then
    raise exception 'Igreja Local só pode ter Sede ou Núcleo como Comunidade Mãe';
  end if;
  if v_type = 'sede' and v_parent_type <> 'sede' then
    raise exception 'Sede só pode ter outra Sede como Comunidade Mãe (ou ficar sem)';
  end if;

  -- Detectar ciclo: novo pai não pode ser descendente desta comunidade
  v_candidate := p_new_parent_id;
  while v_candidate is not null loop
    if v_candidate = p_church_id then
      raise exception 'Mover criaria um ciclo na estrutura organizacional';
    end if;
    select parent_id into v_candidate from public.churches where id = v_candidate;
  end loop;

  update public.churches set parent_id = p_new_parent_id where id = p_church_id;
end; $$;

grant execute on function public.move_church(uuid, uuid) to authenticated;
