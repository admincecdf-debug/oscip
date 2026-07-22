-- ============================================================
-- CEC FAMILY — UX-003 Cap. 2 Parte 5: Gerenciamento de Sessões
--
-- Registra sessões ativas por dispositivo (não substitui o
-- controle de tokens do Supabase Auth — é um registro paralelo
-- pra dar visibilidade ao usuário e à administração de onde a
-- conta está logada).
-- ============================================================

create table if not exists public.user_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_token text not null,       -- gerado no navegador, persiste em localStorage
  device_label  text not null default 'Dispositivo desconhecido',
  user_agent    text,
  ip            text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  is_active     boolean not null default true,
  unique (user_id, session_token)
);

create index if not exists idx_user_sessions_user on public.user_sessions(user_id) where is_active;

alter table public.user_sessions enable row level security;

drop policy if exists user_sessions_own on public.user_sessions;
create policy user_sessions_own on public.user_sessions for all to authenticated
  using (user_id = auth.uid() or is_apostle())
  with check (user_id = auth.uid() or is_apostle());

grant select, insert, update on public.user_sessions to authenticated;

-- ============================================================
-- RPC: registra/atualiza a sessão atual (chamado a cada login e
-- periodicamente enquanto o app está aberto)
-- ============================================================
create or replace function public.touch_session(p_session_token text, p_device_label text, p_user_agent text, p_ip text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_sessions (user_id, session_token, device_label, user_agent, ip, last_seen_at)
  values (auth.uid(), p_session_token, p_device_label, p_user_agent, p_ip, now())
  on conflict (user_id, session_token)
  do update set last_seen_at = now(), is_active = true, device_label = excluded.device_label;
end; $$;
grant execute on function public.touch_session(text, text, text, text) to authenticated;

-- ============================================================
-- RPC: encerra uma sessão específica (registro próprio ou, se
-- Apóstolo, de qualquer usuário — caso de conta comprometida)
-- ============================================================
create or replace function public.end_session(p_session_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.user_sessions set is_active = false
  where id = p_session_id and (user_id = auth.uid() or is_apostle());
end; $$;
grant execute on function public.end_session(uuid) to authenticated;
