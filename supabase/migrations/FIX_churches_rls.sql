-- ============================================================
-- CEC FAMILY — Fix: RLS de WRITE em churches
-- Garante que apóstolos/pastores podem INSERIR/EDITAR/APAGAR comunidades.
-- Idempotente (seguro rodar várias vezes).
-- ============================================================

-- ---------- 1) Garante que RLS está habilitado ----------
alter table public.churches enable row level security;

-- ---------- 2) Policy de leitura (anon e autenticado) ----------
drop policy if exists churches_public_read on public.churches;
create policy churches_public_read on public.churches for select to anon
  using (is_active);

drop policy if exists churches_authenticated_read on public.churches;
create policy churches_authenticated_read on public.churches for select to authenticated
  using (true);

-- ---------- 3) Policy de escrita: apenas apostolo/pastor ----------
-- Esta era a policy que provavelmente estava faltando.
drop policy if exists churches_admin_write on public.churches;
create policy churches_admin_write on public.churches for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('apostolo', 'pastor')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('apostolo', 'pastor')
    )
  );

-- ---------- 4) Diagnóstico (apenas exibe info útil para você verificar) ----------
-- Após rodar este SQL, rode no SQL Editor:
--
-- a) Ver todas as policies de churches:
--    select policyname, cmd, qual, with_check from pg_policies where tablename = 'churches';
--
-- b) Verificar se sua conta tem role correto:
--    select id, full_name, role from public.profiles where id = auth.uid();
--
-- c) Verificar se a função is_admin() funciona:
--    select public.is_admin();
--
-- Se (b) retornar role = 'apostolo' ou 'pastor', e (c) retornar TRUE,
-- a criação de comunidade vai funcionar com este SQL aplicado.
