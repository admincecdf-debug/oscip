-- ============================================================
-- CECID002 — Leitor de QR na Portaria (Fase 2 do CEC ID)
-- ============================================================
-- Reaproveita o que já existe (members_card_view, validate_cec_id,
-- qr_token) — só acrescenta o registro de entrada e a busca manual
-- por CEC ID (pra quando o membro não conseguir mostrar o QR).
-- Idempotente.
-- ============================================================

create table if not exists public.cec_id_checkins (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  cec_id       text,
  event_label  text not null,
  method       text not null default 'manual', -- 'qr' | 'manual'
  checked_by   uuid references public.profiles(id),
  church_id    uuid references public.churches(id),
  checked_at   timestamptz not null default now()
);
create index if not exists idx_cec_checkins_member     on public.cec_id_checkins(member_id);
create index if not exists idx_cec_checkins_event      on public.cec_id_checkins(event_label);
create index if not exists idx_cec_checkins_checked_at on public.cec_id_checkins(checked_at desc);
comment on table public.cec_id_checkins is 'CEC ID Fase 2 — registro de entradas via leitor de QR/portaria.';

alter table public.cec_id_checkins enable row level security;

drop policy if exists cec_checkins_rw on public.cec_id_checkins;
create policy cec_checkins_rw on public.cec_id_checkins for all to authenticated
using (
  public.is_apostle()
  or church_id in (select public.accessible_church_ids())
)
with check (
  public.is_apostle()
  or church_id in (select public.accessible_church_ids())
);

-- ---------- Busca manual por CEC ID (staff autenticado) ----------
create or replace function public.checkin_lookup_by_cec_id(p_cec_id text)
returns table(
  member_id uuid, cec_id text, full_name text, photo_url text,
  categoria text, church_name text, church_id uuid, card_status text
)
language sql stable security definer set search_path = public as $$
  select
    mcv.member_id, mcv.cec_id, m.full_name, m.photo_url,
    mcv.categoria, ch.name, m.church_id, mcv.card_status::text
  from public.members_card_view mcv
  join public.members m on m.id = mcv.member_id
  left join public.churches ch on ch.id = m.church_id
  where mcv.cec_id = p_cec_id;
$$;
grant execute on function public.checkin_lookup_by_cec_id(text) to authenticated;

-- ---------- Busca por qr_token (quando vem do QR escaneado) ----------
create or replace function public.checkin_lookup_by_token(p_token text)
returns table(
  member_id uuid, cec_id text, full_name text, photo_url text,
  categoria text, church_name text, church_id uuid, card_status text
)
language sql stable security definer set search_path = public as $$
  select
    mcv.member_id, mcv.cec_id, m.full_name, m.photo_url,
    mcv.categoria, ch.name, m.church_id, mcv.card_status::text
  from public.members_card_view mcv
  join public.members m on m.id = mcv.member_id
  left join public.churches ch on ch.id = m.church_id
  where mcv.qr_token::text = p_token;
$$;
grant execute on function public.checkin_lookup_by_token(text) to authenticated;

-- ---------- Registrar entrada ----------
create or replace function public.register_checkin(
  p_member_id uuid, p_event_label text, p_method text default 'manual'
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

  insert into public.cec_id_checkins (member_id, cec_id, event_label, method, checked_by, church_id)
  values (p_member_id, v_cec_id, p_event_label, coalesce(p_method, 'manual'), auth.uid(), v_church_id)
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.register_checkin(uuid, text, text) to authenticated;
