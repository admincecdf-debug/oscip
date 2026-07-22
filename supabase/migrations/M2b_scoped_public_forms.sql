-- ============================================================
-- CEC FAMILY — M2b: Conteudo escopado por comunidade
-- - Adiciona church_id em public_prayer_requests e visit_requests
-- - Politicas RLS para admin ler tudo (filtro feito no front)
-- Idempotente.
-- ============================================================

alter table public.public_prayer_requests
  add column if not exists church_id uuid references public.churches(id) on delete set null;
create index if not exists idx_ppr_church on public.public_prayer_requests(church_id);

alter table public.visit_requests
  add column if not exists church_id uuid references public.churches(id) on delete set null;
create index if not exists idx_vr_church on public.visit_requests(church_id);

-- Garante que anon pode inserir com church_id (a politica ja permitia insert,
-- esse alter so confirma que o RLS continua valido).
drop policy if exists ppr_public_insert on public.public_prayer_requests;
create policy ppr_public_insert on public.public_prayer_requests for insert to anon
  with check (honeypot is null or honeypot = '');

drop policy if exists vr_public_insert on public.visit_requests;
create policy vr_public_insert on public.visit_requests for insert to anon
  with check (honeypot is null or honeypot = '');
