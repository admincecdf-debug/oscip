-- ============================================================
-- CEC FAMILY — CEC ID Fases 2-3: Check-in por QR/CEC ID em
-- eventos, portaria, CTL/TADEL — genérico por "evento/local"
-- (event_label), já que o front-end (CecIdPortariaAdmin.tsx)
-- funciona pra qualquer contexto sem precisar de tabela própria
-- por tipo de evento.
-- ============================================================

create table if not exists public.cec_id_checkins (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  cec_id       text,
  event_label  text not null,
  method       text not null check (method in ('qr','manual')),
  checked_by   uuid references public.profiles(id) on delete set null,
  church_id    uuid references public.churches(id) on delete set null,
  checked_at   timestamptz not null default now()
);

create index if not exists idx_cec_id_checkins_event on public.cec_id_checkins(event_label, checked_at desc);
create index if not exists idx_cec_id_checkins_member on public.cec_id_checkins(member_id);

alter table public.cec_id_checkins enable row level security;

drop policy if exists cec_id_checkins_read on public.cec_id_checkins;
create policy cec_id_checkins_read on public.cec_id_checkins for select to authenticated
  using (church_id is null or church_id in (select public.accessible_church_ids()));

drop policy if exists cec_id_checkins_write on public.cec_id_checkins;
create policy cec_id_checkins_write on public.cec_id_checkins for insert to authenticated
  with check (is_admin());

grant select on public.cec_id_checkins to authenticated;
grant insert on public.cec_id_checkins to authenticated;

-- ============================================================
-- RPC: busca pra check-in a partir do token do QR
-- ============================================================
create or replace function public.checkin_lookup_by_token(p_token text)
returns table (
  member_id uuid, cec_id text, full_name text, photo_url text,
  categoria text, church_name text, church_id uuid, card_status text
)
language sql stable security definer set search_path = public as $$
  select m.id, m.cec_id, m.full_name, m.photo_url,
         public.member_category(m.id), ch.name, m.church_id, m.card_status::text
  from public.members m
  left join public.churches ch on ch.id = m.church_id
  where m.qr_token = p_token
  limit 1;
$$;
grant execute on function public.checkin_lookup_by_token(text) to authenticated;

-- ============================================================
-- RPC: busca manual pra check-in por CEC ID digitado
-- ============================================================
create or replace function public.checkin_lookup_by_cec_id(p_cec_id text)
returns table (
  member_id uuid, cec_id text, full_name text, photo_url text,
  categoria text, church_name text, church_id uuid, card_status text
)
language sql stable security definer set search_path = public as $$
  select m.id, m.cec_id, m.full_name, m.photo_url,
         public.member_category(m.id), ch.name, m.church_id, m.card_status::text
  from public.members m
  left join public.churches ch on ch.id = m.church_id
  where upper(m.cec_id) = upper(p_cec_id)
  limit 1;
$$;
grant execute on function public.checkin_lookup_by_cec_id(text) to authenticated;

-- ============================================================
-- RPC: registra a entrada
-- ============================================================
create or replace function public.register_checkin(p_member_id uuid, p_event_label text, p_method text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_cec_id text;
  v_church_id uuid;
begin
  select cec_id, church_id into v_cec_id, v_church_id from public.members where id = p_member_id;

  insert into public.cec_id_checkins (member_id, cec_id, event_label, method, checked_by, church_id)
  values (p_member_id, v_cec_id, p_event_label, p_method, auth.uid(), v_church_id)
  returning id into v_id;

  begin
    perform public.audit_log('insert', 'cec_id_checkins', v_id, jsonb_build_object('event_label', p_event_label, 'method', p_method));
  exception when others then null;
  end;

  return v_id;
end; $$;
grant execute on function public.register_checkin(uuid, text, text) to authenticated;
