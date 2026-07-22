-- ============================================================
-- EVT001 — Módulo de Eventos com Inscrição (sem pagamento por enquanto)
-- ============================================================
-- ATENÇÃO: já existe uma tabela `public.events` — é a "Agenda" simples
-- (título, data, link EXTERNO de inscrição). Este módulo é outra coisa:
-- eventos com inscrição de verdade dentro do sistema, capacidade, lista
-- de espera e check-in. Por isso a tabela aqui chama `registration_events`,
-- não `events` — evita qualquer colisão com o que já existe.
--
-- Decisões confirmadas:
--   - Inscrição aberta a todos (logados ou visitantes/convidados, sem
--     precisar ter conta — só preencher nome/e-mail/telefone).
--   - Aprovação sempre automática (sem etapa manual de aprovação).
--   - Capacidade com lista de espera (promove automaticamente o
--     próximo da fila quando uma vaga confirmada é cancelada).
--   - Pagamento: is_free sempre true por enquanto — campo já existe
--     pra não precisar de outra migration quando pagamento chegar.
-- Idempotente.
-- ============================================================

do $$ begin
  create type registration_event_status as enum ('rascunho', 'publicado', 'encerrado', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_signup_status as enum ('confirmada', 'lista_espera', 'cancelada');
exception when duplicate_object then null; end $$;

-- ---------- 1) Tabela de eventos (com inscrição) ----------
create table if not exists public.registration_events (
  id                       uuid primary key default gen_random_uuid(),
  church_id                uuid references public.churches(id), -- null = evento nacional/rede
  slug                     text not null unique,
  name                     text not null,
  description              text,
  banner_url               text,
  location                 text,
  is_online                boolean not null default false,
  online_url               text,
  start_at                 timestamptz not null,
  end_at                   timestamptz,
  registration_opens_at    timestamptz,
  registration_closes_at   timestamptz,
  capacity                 int, -- null = ilimitado
  is_free                  boolean not null default true, -- pagamento fica pra depois
  status                   registration_event_status not null default 'rascunho',
  created_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
comment on table public.registration_events is
  'Eventos com inscrição própria (capacidade/lista de espera/check-in). Diferente de public.events (Agenda simples). is_free sempre true por enquanto.';

create index if not exists idx_regevents_church  on public.registration_events(church_id);
create index if not exists idx_regevents_status  on public.registration_events(status);
create index if not exists idx_regevents_start    on public.registration_events(start_at);

drop trigger if exists trg_regevents_updated_at on public.registration_events;
create trigger trg_regevents_updated_at before update on public.registration_events
  for each row execute function public.set_updated_at();

-- ---------- 2) Tabela de inscrições ----------
create table if not exists public.event_registrations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.registration_events(id) on delete cascade,
  member_id     uuid references public.members(id),
  full_name     text not null,
  email         text,
  phone         text,
  status        event_signup_status not null default 'confirmada',
  registered_at timestamptz not null default now(),
  cancelled_at  timestamptz
);
comment on table public.event_registrations is 'Inscrições em registration_events — aprovação sempre automática.';

create index if not exists idx_evtreg_event  on public.event_registrations(event_id);
create index if not exists idx_evtreg_status on public.event_registrations(event_id, status);
create index if not exists idx_evtreg_member on public.event_registrations(member_id);

create unique index if not exists uq_evtreg_member_event
  on public.event_registrations(event_id, member_id)
  where member_id is not null and status <> 'cancelada';

-- ---------- 3) RLS ----------
alter table public.registration_events enable row level security;
alter table public.event_registrations enable row level security;

drop policy if exists regevents_public_read on public.registration_events;
create policy regevents_public_read on public.registration_events for select to anon, authenticated
  using (status = 'publicado');

drop policy if exists regevents_staff_read on public.registration_events;
create policy regevents_staff_read on public.registration_events for select to authenticated
  using (
    public.is_apostle()
    or church_id is null
    or church_id in (select public.accessible_church_ids())
  );

drop policy if exists regevents_staff_write on public.registration_events;
create policy regevents_staff_write on public.registration_events for all to authenticated
  using (
    public.is_apostle()
    or church_id is null
    or church_id in (select public.accessible_church_ids())
  )
  with check (
    public.is_apostle()
    or church_id is null
    or church_id in (select public.accessible_church_ids())
  );

drop policy if exists evtreg_staff_read on public.event_registrations;
create policy evtreg_staff_read on public.event_registrations for select to authenticated
  using (
    public.is_apostle()
    or exists (
      select 1 from public.registration_events e
      where e.id = event_id and (e.church_id is null or e.church_id in (select public.accessible_church_ids()))
    )
    or member_id in (select m.id from public.members m where m.profile_id = auth.uid())
  );

drop policy if exists evtreg_staff_write on public.event_registrations;
create policy evtreg_staff_write on public.event_registrations for update to authenticated
  using (
    public.is_apostle()
    or exists (
      select 1 from public.registration_events e
      where e.id = event_id and (e.church_id is null or e.church_id in (select public.accessible_church_ids()))
    )
  );

-- ---------- 4) Inscrição (aberta a anônimo e autenticado) ----------
create or replace function public.register_for_event(
  p_event_id uuid, p_full_name text, p_email text default null, p_phone text default null
) returns table(registration_id uuid, reg_status text, queue_position int)
language plpgsql security definer set search_path = public as $$
declare
  v_event record;
  v_confirmed_count int;
  v_member_id uuid;
  v_status text;
  v_id uuid;
  v_queue_pos int;
begin
  select * into v_event from public.registration_events where id = p_event_id;
  if v_event.id is null then raise exception 'Evento não encontrado'; end if;
  if v_event.status <> 'publicado' then raise exception 'Inscrições não estão abertas para este evento'; end if;
  if v_event.registration_opens_at is not null and now() < v_event.registration_opens_at then
    raise exception 'Inscrições ainda não abriram para este evento';
  end if;
  if v_event.registration_closes_at is not null and now() > v_event.registration_closes_at then
    raise exception 'Inscrições encerradas para este evento';
  end if;
  if trim(coalesce(p_full_name, '')) = '' then
    raise exception 'Informe o nome completo';
  end if;

  select m.id into v_member_id from public.members m where m.profile_id = auth.uid() limit 1;

  if v_member_id is not null and exists (
    select 1 from public.event_registrations er
    where er.event_id = p_event_id and er.member_id = v_member_id and er.status <> 'cancelada'
  ) then
    raise exception 'Você já está inscrito neste evento';
  end if;

  select count(*) into v_confirmed_count from public.event_registrations
  where event_id = p_event_id and status = 'confirmada';

  if v_event.capacity is not null and v_confirmed_count >= v_event.capacity then
    v_status := 'lista_espera';
  else
    v_status := 'confirmada';
  end if;

  insert into public.event_registrations (event_id, member_id, full_name, email, phone, status)
  values (p_event_id, v_member_id, p_full_name, p_email, p_phone, v_status::event_signup_status)
  returning id into v_id;

  if v_status = 'lista_espera' then
    select count(*) into v_queue_pos from public.event_registrations
    where event_id = p_event_id and status = 'lista_espera' and registered_at <= (select registered_at from public.event_registrations where id = v_id);
  else
    v_queue_pos := null;
  end if;

  return query select v_id, v_status, v_queue_pos;
end;
$$;
grant execute on function public.register_for_event(uuid, text, text, text) to anon, authenticated;

-- ---------- 5) Cancelamento (promove o próximo da lista de espera) ----------
create or replace function public.cancel_event_registration(p_registration_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid; v_status text; v_member_id uuid;
begin
  select event_id, status::text, member_id into v_event_id, v_status, v_member_id
  from public.event_registrations where id = p_registration_id;

  if v_event_id is null then raise exception 'Inscrição não encontrada'; end if;

  if not (
    public.is_apostle()
    or exists (
      select 1 from public.registration_events e
      where e.id = v_event_id and (e.church_id is null or e.church_id in (select public.accessible_church_ids()))
    )
    or (v_member_id is not null and exists (select 1 from public.members m where m.id = v_member_id and m.profile_id = auth.uid()))
  ) then
    raise exception 'Sem permissão para cancelar esta inscrição';
  end if;

  update public.event_registrations set status = 'cancelada', cancelled_at = now() where id = p_registration_id;

  if v_status = 'confirmada' then
    update public.event_registrations
    set status = 'confirmada'
    where id = (
      select id from public.event_registrations
      where event_id = v_event_id and status = 'lista_espera'
      order by registered_at asc limit 1
    );
  end if;
end;
$$;
grant execute on function public.cancel_event_registration(uuid) to authenticated;

-- ---------- 6) Resumo de inscrições (pra tela do admin) ----------
create or replace function public.event_registration_summary(p_event_id uuid)
returns table(confirmadas int, lista_espera int, canceladas int, capacidade int)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where status = 'confirmada')::int,
    count(*) filter (where status = 'lista_espera')::int,
    count(*) filter (where status = 'cancelada')::int,
    (select capacity from public.registration_events where id = p_event_id)
  from public.event_registrations
  where event_id = p_event_id;
$$;
grant execute on function public.event_registration_summary(uuid) to authenticated;

-- ---------- 7) Liga o Leitor de Portaria a um evento formal (opcional) ----------
alter table public.cec_id_checkins add column if not exists event_id uuid references public.registration_events(id);
create index if not exists idx_cec_checkins_event_id on public.cec_id_checkins(event_id);

create or replace function public.register_checkin(
  p_member_id uuid, p_event_label text, p_method text default 'manual', p_event_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_church_id uuid;
  v_cec_id text;
  v_id uuid;
begin
  select mcv.card_status::text, mcv.cec_id, m.church_id
    into v_status, v_cec_id, v_church_id
  from public.members_card_view mcv
  join public.members m on m.id = mcv.member_id
  where mcv.member_id = p_member_id;

  if v_status is null then
    raise exception 'Membro sem Carteira CEC ID.';
  end if;

  if v_status in ('suspensa', 'cancelada') then
    raise exception 'Carteira % — entrada não liberada.', v_status;
  end if;

  insert into public.cec_id_checkins (member_id, cec_id, event_label, method, checked_by, church_id, event_id)
  values (p_member_id, v_cec_id, p_event_label, coalesce(p_method, 'manual'), auth.uid(), v_church_id, p_event_id)
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.register_checkin(uuid, text, text, uuid) to authenticated;
