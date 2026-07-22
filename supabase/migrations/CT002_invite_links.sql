-- ============================================================
-- CEC FAMILY — CT-002: Central Inteligente de Convites e Cadastro
-- Tabelas: invite_links, invite_link_uses
-- Funções: create_invite_link, validate_invite_token, consume_invite_link,
--          revoke_invite_link, list_invite_links, invite_links_dashboard
-- Idempotente.
-- ============================================================

-- ---------- 1) Enums ----------
do $$ begin
  create type invite_link_kind as enum (
    'membro','visitante','lider_lg','pastor','diretor_financeiro',
    'secretario','lider_jovens','lider_casais','lider_criancas',
    'musico','administrador'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type invite_link_status as enum ('ativo','expirado','esgotado','revogado');
exception when duplicate_object then null; end $$;

-- ---------- 2) Tabela invite_links ----------
create table if not exists public.invite_links (
  id                uuid primary key default gen_random_uuid(),
  token             text not null unique,               -- token opaco, gerado no servidor (não é o id)
  kind              invite_link_kind not null,

  -- Parâmetros de estrutura (todos opcionais — dependem do kind)
  church_id         uuid references public.churches(id) on delete cascade,
  district_id       uuid references public.districts(id) on delete cascade,
  area_id           uuid references public.areas(id) on delete cascade,
  sector_id         uuid references public.sectors(id) on delete cascade,
  life_group_id     uuid references public.life_groups(id) on delete cascade,
  ministry_id       uuid references public.ministries(id) on delete set null,

  -- Papel/vínculo que a pessoa recebe ao concluir o cadastro
  target_role       user_role not null default 'membro',
  discipler_id      uuid references public.profiles(id) on delete set null,

  -- Validade
  expires_at        timestamptz,                         -- null = permanente
  max_uses          int,                                  -- null = ilimitado
  uses_count         int not null default 0,

  -- Segurança / auditoria de criação
  created_by        uuid not null references public.profiles(id) on delete cascade,
  revoked_at        timestamptz,
  revoked_by        uuid references public.profiles(id),
  allowed_ip_cidr   text,                                 -- opcional: restrição de rede (ex: "200.1.2.0/24")

  created_at        timestamptz not null default now()
);

create index if not exists idx_invite_links_token on public.invite_links(token);
create index if not exists idx_invite_links_created_by on public.invite_links(created_by);
create index if not exists idx_invite_links_church on public.invite_links(church_id);

alter table public.invite_links enable row level security;

-- Leitura: só quem criou o link, ou quem tem escopo hierárquico sobre a igreja do link
drop policy if exists invite_links_read on public.invite_links;
create policy invite_links_read on public.invite_links for select to authenticated
  using (
    created_by = auth.uid()
    or church_id in (select public.accessible_church_ids())
    or public.is_apostle()
  );

-- Nenhum insert/update/delete direto na tabela — tudo passa pelas RPCs abaixo (security definer),
-- que validam a hierarquia de permissão da seção 6 do caderno CT-002.
drop policy if exists invite_links_no_direct_write on public.invite_links;
create policy invite_links_no_direct_write on public.invite_links for all to authenticated
  using (false) with check (false);

-- ---------- 3) Tabela invite_link_uses (auditoria de uso) ----------
create table if not exists public.invite_link_uses (
  id              uuid primary key default gen_random_uuid(),
  invite_link_id  uuid not null references public.invite_links(id) on delete cascade,
  used_by         uuid references public.profiles(id) on delete set null,
  ip              text,
  user_agent      text,
  device          text,
  approx_location text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_invite_link_uses_link on public.invite_link_uses(invite_link_id);

alter table public.invite_link_uses enable row level security;
drop policy if exists invite_link_uses_read on public.invite_link_uses;
create policy invite_link_uses_read on public.invite_link_uses for select to authenticated
  using (
    exists (
      select 1 from public.invite_links il
      where il.id = invite_link_id
        and (il.created_by = auth.uid() or il.church_id in (select public.accessible_church_ids()) or public.is_apostle())
    )
  );

-- ============================================================
-- 4) Função: quem pode gerar qual kind, em qual escopo
--    (implementa a tabela 6 do caderno CT-002)
-- ============================================================
create or replace function public.can_create_invite_kind(
  p_kind invite_link_kind,
  p_church_id uuid,
  p_sector_id uuid default null,
  p_life_group_id uuid default null
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_role user_role;
  v_church_id uuid;
begin
  select role, church_id into v_role, v_church_id from public.profiles where id = auth.uid();

  if v_role is null then return false; end if;

  -- Administrador nacional / apóstolo: pode tudo
  if public.is_apostle() then return true; end if;

  -- Administrador só pode ser convidado pelo Administrador Nacional (já coberto acima)
  if p_kind = 'administrador' then return false; end if;

  -- Pastor da sede: qualquer kind dentro da sua igreja (e subárvore)
  if v_role = 'pastor' and p_church_id in (select public.accessible_church_ids()) then
    return true;
  end if;

  -- Supervisor: kinds operacionais dentro do seu escopo (distrito/área/setor)
  if v_role = 'supervisor' and p_church_id in (select public.accessible_church_ids())
     and p_kind in ('membro','visitante','lider_lg','lider_jovens','lider_casais','lider_criancas','musico') then
    return true;
  end if;

  -- Líder de Life Group: só membro/visitante, e só para o próprio LG
  if v_role = 'lider' and p_kind in ('membro','visitante') then
    return p_life_group_id is not null
      and exists (select 1 from public.life_groups lg where lg.id = p_life_group_id and lg.leader_id = auth.uid());
  end if;

  return false;
end; $$;
grant execute on function public.can_create_invite_kind(invite_link_kind, uuid, uuid, uuid) to authenticated;

-- ============================================================
-- 5) Criar link
-- ============================================================
create or replace function public.create_invite_link(
  p_kind invite_link_kind,
  p_church_id uuid,
  p_district_id uuid default null,
  p_area_id uuid default null,
  p_sector_id uuid default null,
  p_life_group_id uuid default null,
  p_ministry_id uuid default null,
  p_target_role user_role default 'membro',
  p_discipler_id uuid default null,
  p_validity text default 'permanente',   -- 'permanente' | '24h' | '7d' | '30d' | '90d'
  p_max_uses int default null,             -- null = ilimitado; 1 = link único
  p_allowed_ip_cidr text default null
) returns table (id uuid, token text)
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_expires_at timestamptz;
  v_new_id uuid;
begin
  if not public.can_create_invite_kind(p_kind, p_church_id, p_sector_id, p_life_group_id) then
    raise exception 'Sem permissão para gerar convite do tipo %', p_kind using errcode = '42501';
  end if;

  v_expires_at := case p_validity
    when '24h' then now() + interval '24 hours'
    when '7d'  then now() + interval '7 days'
    when '30d' then now() + interval '30 days'
    when '90d' then now() + interval '90 days'
    else null -- permanente
  end;

  -- Token opaco: 22 chars base64url a partir de 16 bytes aleatórios
  v_token := replace(replace(encode(gen_random_bytes(16), 'base64'), '/', '_'), '+', '-');
  v_token := rtrim(v_token, '=');

  insert into public.invite_links (
    token, kind, church_id, district_id, area_id, sector_id, life_group_id,
    ministry_id, target_role, discipler_id, expires_at, max_uses, allowed_ip_cidr, created_by
  ) values (
    v_token, p_kind, p_church_id, p_district_id, p_area_id, p_sector_id, p_life_group_id,
    p_ministry_id, p_target_role, p_discipler_id, v_expires_at, p_max_uses, p_allowed_ip_cidr, auth.uid()
  ) returning invite_links.id into v_new_id;

  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (auth.uid(), 'insert', 'invite_link', v_new_id);

  return query select v_new_id, v_token;
end; $$;
grant execute on function public.create_invite_link(
  invite_link_kind, uuid, uuid, uuid, uuid, uuid, uuid, user_role, uuid, text, int, text
) to authenticated;

-- ============================================================
-- 6) Validar token (chamado pela página pública /convite/[token], sem sessão)
-- ============================================================
create or replace function public.validate_invite_token(p_token text)
returns table (
  valid boolean, reason text,
  kind invite_link_kind, church_name text, life_group_name text, ministry_name text,
  target_role user_role
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_link record;
begin
  select * into v_link from public.invite_links il where il.token = p_token;

  if v_link.id is null then
    return query select false, 'nao_encontrado', null::invite_link_kind, null::text, null::text, null::text, null::user_role;
    return;
  end if;
  if v_link.revoked_at is not null then
    return query select false, 'revogado', v_link.kind, null::text, null::text, null::text, v_link.target_role;
    return;
  end if;
  if v_link.expires_at is not null and v_link.expires_at < now() then
    return query select false, 'expirado', v_link.kind, null::text, null::text, null::text, v_link.target_role;
    return;
  end if;
  if v_link.max_uses is not null and v_link.uses_count >= v_link.max_uses then
    return query select false, 'esgotado', v_link.kind, null::text, null::text, null::text, v_link.target_role;
    return;
  end if;

  return query
  select true, null::text, v_link.kind,
    (select name from public.churches where id = v_link.church_id),
    (select name from public.life_groups where id = v_link.life_group_id),
    (select name from public.ministries where id = v_link.ministry_id),
    v_link.target_role;
end; $$;
-- Executável por anon: a página de convite roda antes do login
grant execute on function public.validate_invite_token(text) to anon, authenticated;

-- ============================================================
-- 7) Consumir link (chamado logo após supabase.auth.signUp() no fluxo de convite)
-- ============================================================
create or replace function public.consume_invite_link(
  p_token text, p_ip text default null, p_user_agent text default null, p_phone text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_link record;
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

  if v_link.life_group_id is not null then
    insert into public.members (profile_id, full_name, life_group_id, church_id, journey_stage, status, joined_at)
    select auth.uid(), p.full_name, v_link.life_group_id, v_link.church_id, 'novo_convertido', 'ativo', now()
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

-- ============================================================
-- 8) Revogar link
-- ============================================================
create or replace function public.revoke_invite_link(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.invite_links set revoked_at = now(), revoked_by = auth.uid()
  where id = p_id and (created_by = auth.uid() or public.is_apostle());

  if not found then
    raise exception 'Link não encontrado ou sem permissão';
  end if;
end; $$;
grant execute on function public.revoke_invite_link(uuid) to authenticated;

-- ============================================================
-- 9) Dashboard: listar links + status computado + conversão
-- ============================================================
create or replace function public.list_invite_links(p_church_id uuid default null)
returns table (
  id uuid, token text, kind invite_link_kind, status invite_link_status,
  church_name text, life_group_name text, target_role user_role,
  max_uses int, uses_count int, expires_at timestamptz,
  created_by_name text, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  select
    il.id, il.token, il.kind,
    case
      when il.revoked_at is not null then 'revogado'::invite_link_status
      when il.expires_at is not null and il.expires_at < now() then 'expirado'::invite_link_status
      when il.max_uses is not null and il.uses_count >= il.max_uses then 'esgotado'::invite_link_status
      else 'ativo'::invite_link_status
    end,
    ch.name, lg.name, il.target_role,
    il.max_uses, il.uses_count, il.expires_at,
    p.full_name, il.created_at
  from public.invite_links il
  left join public.churches ch on ch.id = il.church_id
  left join public.life_groups lg on lg.id = il.life_group_id
  left join public.profiles p on p.id = il.created_by
  where (il.created_by = auth.uid() or il.church_id in (select public.accessible_church_ids()) or public.is_apostle())
    and (p_church_id is null or il.church_id = p_church_id)
  order by il.created_at desc;
end; $$;
grant execute on function public.list_invite_links(uuid) to authenticated;
