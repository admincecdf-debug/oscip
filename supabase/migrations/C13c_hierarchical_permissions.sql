-- ============================================================
-- CEC FAMILY — Permissões hierárquicas refinadas
-- - profiles.church_id (escopo do pastor)
-- - Função accessible_church_ids() com CTE recursiva
-- - RLS reescrita em 10 tabelas principais
-- Idempotente. Modo legado seguro:
--   - Apóstolo: vê tudo (não muda)
--   - Pastor COM church_id: vê só sua árvore (Sede → descendentes)
--   - Pastor SEM church_id: vê tudo (legado, até apóstolo atribuir)
-- ============================================================

-- ---------- 1) Garante profiles.church_id ----------
alter table public.profiles
  add column if not exists church_id uuid references public.churches(id) on delete set null;

comment on column public.profiles.church_id is 'Escopo do usuário. Pastor: comunidade que administra. Apóstolo: ignorado.';

create index if not exists idx_profiles_church on public.profiles(church_id);

-- ---------- 2) Função: is_apostle() ----------
create or replace function public.is_apostle()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'apostolo');
$$;
grant execute on function public.is_apostle() to authenticated;

-- ---------- 3) Função: accessible_church_ids() ----------
-- Retorna lista de church_ids que o usuário logado pode acessar.
-- - Apóstolo: TODAS as comunidades
-- - Pastor sem church_id: TODAS (modo legado)
-- - Pastor com church_id: sua igreja + TODOS os descendentes na árvore
-- - Outros (líder, membro): só a igreja do profile
create or replace function public.accessible_church_ids()
returns setof uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_church uuid;
begin
  select role::text, church_id into v_role, v_church
  from public.profiles where id = auth.uid();

  -- Apóstolo: vê tudo
  if v_role = 'apostolo' then
    return query select id from public.churches;
    return;
  end if;

  -- Pastor sem church_id: modo legado, vê tudo
  if v_role = 'pastor' and v_church is null then
    return query select id from public.churches;
    return;
  end if;

  -- Pastor com church_id: sua árvore (CTE recursiva descendente)
  if v_role = 'pastor' and v_church is not null then
    return query
    with recursive descendants as (
      select id, parent_id from public.churches where id = v_church
      union all
      select c.id, c.parent_id
      from public.churches c
      inner join descendants d on c.parent_id = d.id
    )
    select id from descendants;
    return;
  end if;

  -- Líder ou membro: só a igreja do profile (se tiver)
  if v_church is not null then
    return query select v_church;
    return;
  end if;

  return;
end; $$;
grant execute on function public.accessible_church_ids() to authenticated;

-- ---------- 4) Função: count de pastores sem escopo (pra banner do apóstolo) ----------
create or replace function public.pastors_without_scope_count()
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.profiles
  where role::text = 'pastor' and church_id is null;
$$;
grant execute on function public.pastors_without_scope_count() to authenticated;

-- ---------- 5) RLS — churches ----------
-- Apóstolo: tudo. Demais: apenas as comunidades acessíveis.
drop policy if exists churches_admin_write on public.churches;
drop policy if exists churches_authenticated_read on public.churches;

create policy churches_scoped_read on public.churches for select to authenticated
  using (id in (select public.accessible_church_ids()));

create policy churches_scoped_write on public.churches for all to authenticated
  using (
    public.is_apostle()
    or id in (select public.accessible_church_ids())
  )
  with check (
    public.is_apostle()
    or id in (select public.accessible_church_ids())
  );

-- ---------- 6) RLS — life_groups ----------
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'life_groups' and schemaname = 'public' loop
    execute format('drop policy if exists %I on public.life_groups', pol.policyname);
  end loop;
end $$;

create policy life_groups_scoped_read on public.life_groups for select to authenticated
  using (church_id in (select public.accessible_church_ids()) or church_id is null);

create policy life_groups_scoped_write on public.life_groups for all to authenticated
  using (church_id in (select public.accessible_church_ids()) or church_id is null)
  with check (church_id in (select public.accessible_church_ids()) or church_id is null);

-- LG leitura também precisa ser pública pro mapa (anon) — restaura policy do M1
create policy life_groups_public_read on public.life_groups for select to anon
  using (is_active);

-- ---------- 7) RLS — members ----------
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'members' and schemaname = 'public' loop
    execute format('drop policy if exists %I on public.members', pol.policyname);
  end loop;
end $$;

create policy members_scoped_read on public.members for select to authenticated
  using (church_id in (select public.accessible_church_ids()) or profile_id = auth.uid());

create policy members_scoped_write on public.members for all to authenticated
  using (church_id in (select public.accessible_church_ids()))
  with check (church_id in (select public.accessible_church_ids()));

-- ---------- 8) RLS — meeting_reports + report_attendance + report_visits ----------
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'meeting_reports' and schemaname = 'public' loop
    execute format('drop policy if exists %I on public.meeting_reports', pol.policyname);
  end loop;
end $$;

create policy meeting_reports_scoped on public.meeting_reports for all to authenticated
  using (
    life_group_id in (
      select id from public.life_groups where church_id in (select public.accessible_church_ids())
    )
  )
  with check (
    life_group_id in (
      select id from public.life_groups where church_id in (select public.accessible_church_ids())
    )
  );

-- report_attendance herda do report
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'report_attendance' and schemaname = 'public' loop
    execute format('drop policy if exists %I on public.report_attendance', pol.policyname);
  end loop;
end $$;

create policy report_attendance_scoped on public.report_attendance for all to authenticated
  using (
    report_id in (
      select mr.id from public.meeting_reports mr
      join public.life_groups lg on lg.id = mr.life_group_id
      where lg.church_id in (select public.accessible_church_ids())
    )
  )
  with check (
    report_id in (
      select mr.id from public.meeting_reports mr
      join public.life_groups lg on lg.id = mr.life_group_id
      where lg.church_id in (select public.accessible_church_ids())
    )
  );

-- report_visits idem
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'report_visits' and schemaname = 'public' loop
    execute format('drop policy if exists %I on public.report_visits', pol.policyname);
  end loop;
end $$;

create policy report_visits_scoped on public.report_visits for all to authenticated
  using (
    report_id in (
      select mr.id from public.meeting_reports mr
      join public.life_groups lg on lg.id = mr.life_group_id
      where lg.church_id in (select public.accessible_church_ids())
    )
  )
  with check (
    report_id in (
      select mr.id from public.meeting_reports mr
      join public.life_groups lg on lg.id = mr.life_group_id
      where lg.church_id in (select public.accessible_church_ids())
    )
  );

-- ---------- 9) RLS — monthly_reports ----------
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'monthly_reports' and schemaname = 'public' loop
    execute format('drop policy if exists %I on public.monthly_reports', pol.policyname);
  end loop;
end $$;

create policy monthly_reports_scoped on public.monthly_reports for all to authenticated
  using (
    life_group_id in (
      select id from public.life_groups where church_id in (select public.accessible_church_ids())
    )
  )
  with check (
    life_group_id in (
      select id from public.life_groups where church_id in (select public.accessible_church_ids())
    )
  );

-- ---------- 10) RLS — visitor_pipeline ----------
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'visitor_pipeline' and schemaname = 'public' loop
    execute format('drop policy if exists %I on public.visitor_pipeline', pol.policyname);
  end loop;
end $$;

create policy visitor_pipeline_scoped on public.visitor_pipeline for all to authenticated
  using (community_id in (select public.accessible_church_ids()) or community_id is null)
  with check (community_id in (select public.accessible_church_ids()) or community_id is null);

-- ---------- 11) RLS — news ----------
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'news' and schemaname = 'public' loop
    execute format('drop policy if exists %I on public.news', pol.policyname);
  end loop;
end $$;

-- Anon vê apenas publicadas
create policy news_public_read on public.news for select to anon
  using (is_published);

-- Autenticado: lê publicadas + as da sua árvore
create policy news_scoped_read on public.news for select to authenticated
  using (
    is_published
    or church_id in (select public.accessible_church_ids())
    or church_id is null
  );

create policy news_scoped_write on public.news for all to authenticated
  using (church_id in (select public.accessible_church_ids()) or church_id is null)
  with check (church_id in (select public.accessible_church_ids()) or church_id is null);

-- ---------- 12) RLS — ministries + ministry_members + ministry_posts ----------
do $$
declare pol record;
begin
  for pol in select policyname, tablename from pg_policies where tablename in ('ministries','ministry_members','ministry_posts') and schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- ministries
create policy ministries_public_read on public.ministries for select to anon
  using (is_active);

create policy ministries_scoped_read on public.ministries for select to authenticated
  using (church_id in (select public.accessible_church_ids()));

create policy ministries_scoped_write on public.ministries for all to authenticated
  using (church_id in (select public.accessible_church_ids()))
  with check (church_id in (select public.accessible_church_ids()));

-- ministry_members
create policy ministry_members_scoped on public.ministry_members for all to authenticated
  using (
    ministry_id in (
      select id from public.ministries where church_id in (select public.accessible_church_ids())
    )
    or member_id in (select id from public.members where profile_id = auth.uid())
  )
  with check (
    ministry_id in (
      select id from public.ministries where church_id in (select public.accessible_church_ids())
    )
  );

-- ministry_posts
create policy ministry_posts_member_read on public.ministry_posts for select to authenticated
  using (
    ministry_id in (
      select mm.ministry_id from public.ministry_members mm
      join public.members m on m.id = mm.member_id
      where m.profile_id = auth.uid() and mm.is_active
    )
    or ministry_id in (
      select id from public.ministries where church_id in (select public.accessible_church_ids())
    )
  );

create policy ministry_posts_scoped_write on public.ministry_posts for all to authenticated
  using (
    ministry_id in (
      select id from public.ministries where church_id in (select public.accessible_church_ids())
    )
  )
  with check (
    ministry_id in (
      select id from public.ministries where church_id in (select public.accessible_church_ids())
    )
  );

-- ---------- 13) RLS — prayer_requests ----------
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'prayer_requests' and schemaname = 'public' loop
    execute format('drop policy if exists %I on public.prayer_requests', pol.policyname);
  end loop;
end $$;

create policy prayer_requests_scoped on public.prayer_requests for all to authenticated
  using (
    member_id in (select id from public.members where profile_id = auth.uid())
    or member_id in (
      select m.id from public.members m
      where m.church_id in (select public.accessible_church_ids())
    )
  )
  with check (
    member_id in (select id from public.members where profile_id = auth.uid())
    or member_id in (
      select m.id from public.members m
      where m.church_id in (select public.accessible_church_ids())
    )
  );

-- ============================================================
-- FIM. Apóstolo continua vendo tudo.
-- Pastor sem escopo vê tudo (legado).
-- Pastor COM escopo vê apenas sua árvore.
-- ============================================================
