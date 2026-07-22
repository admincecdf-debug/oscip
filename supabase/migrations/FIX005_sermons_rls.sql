-- ============================================================
-- CEC FAMILY — Fix: "new row violates row-level security policy
-- for table sermons" ao cadastrar uma Pregação.
--
-- Causa: a policy de escrita exigia is_admin() E in_my_network(church_id)
-- — mas in_my_network() só retorna true quando church_id NÃO é nulo.
-- Ou seja: pregações sem igreja vinculada (conteúdo nacional/geral)
-- eram sempre bloqueadas, mesmo pra quem é administrador.
-- ============================================================

drop policy if exists sermons_write on public.sermons;
create policy sermons_write on public.sermons for all to authenticated
  using (is_admin() and (church_id is null or in_my_network(church_id)))
  with check (is_admin() and (church_id is null or in_my_network(church_id)));

-- Mesmo problema encontrado em events (agenda) — mesma correção
drop policy if exists events_write on public.events;
create policy events_write on public.events for all to authenticated
  using (is_admin() and (church_id is null or in_my_network(church_id)))
  with check (is_admin() and (church_id is null or in_my_network(church_id)));
