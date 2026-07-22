-- ============================================================
-- CEC FAMILY — UX-003 Cap. 3 Parte 6: Central de Notificações.
--
-- As notificações em si já são computadas dinamicamente a partir
-- de várias fontes (aniversários, alertas da Torre de Controle,
-- metas atrasadas, etc.) — não precisam de tabela própria. O que
-- faltava era PERSISTIR quando alguém marca uma como lida/dispensa,
-- pra não voltar toda vez que recarrega a página.
-- ============================================================

create table if not exists public.notification_dismissals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  notif_key    text not null,   -- ex: "birth-123", "rel-456"
  dismissed_at timestamptz not null default now(),
  unique (user_id, notif_key)
);

alter table public.notification_dismissals enable row level security;

drop policy if exists notification_dismissals_own on public.notification_dismissals;
create policy notification_dismissals_own on public.notification_dismissals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, delete on public.notification_dismissals to authenticated;
