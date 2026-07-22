-- ============================================================
-- CEC FAMILY — UX-003 §6.47: Motor de Regras Ministeriais.
-- Avalia um conjunto de regras pra um membro específico e devolve
-- recomendações — nunca substituem a decisão da liderança (§6.49).
--
-- Regras cobertas (dos 6 exemplos do documento):
--  1. Sugerir Escola de Líderes após concluir o CTL
--  2. Identificar membro sem Life Group
--  3. Alertar ausência de discipulador
--  4. Indicar necessidade de acompanhamento pastoral (pedido de
--     oração pendente há mais de 14 dias, como proxy disponível)
--  5. Alertar excesso de discípulos por discipulador (mais de 7)
--  6. Sugerir ingressar em ministério após concluir formação
--     ministerial, se ainda não está em nenhum
-- ============================================================

create table if not exists public.ministry_rules_config (
  rule_key   text primary key,
  label      text not null,
  is_active  boolean not null default true
);

insert into public.ministry_rules_config (rule_key, label) values
  ('sugerir_escola_lideres', 'Sugerir Escola de Líderes após CTL'),
  ('sem_life_group', 'Identificar membro sem Life Group'),
  ('sem_discipulador', 'Alertar ausência de discipulador'),
  ('acompanhamento_pastoral', 'Indicar necessidade de acompanhamento pastoral'),
  ('excesso_discipulos', 'Alertar excesso de discípulos por discipulador'),
  ('sugerir_ministerio', 'Sugerir ministério após formação')
on conflict (rule_key) do nothing;

alter table public.ministry_rules_config enable row level security;
drop policy if exists ministry_rules_config_read on public.ministry_rules_config;
create policy ministry_rules_config_read on public.ministry_rules_config for select to authenticated using (true);
drop policy if exists ministry_rules_config_write on public.ministry_rules_config;
create policy ministry_rules_config_write on public.ministry_rules_config for all to authenticated
  using (is_apostle()) with check (is_apostle());
grant select on public.ministry_rules_config to authenticated;
grant update on public.ministry_rules_config to authenticated;

create or replace function public.member_recommendations(p_member_id uuid)
returns table (rule_key text, message text, priority text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_member record;
begin
  select * into v_member from public.members where id = p_member_id;
  if v_member.id is null then return; end if;

  if (select coalesce((select is_active from public.ministry_rules_config where rule_key = 'sugerir_escola_lideres'), true))
     and exists (
       select 1 from public.course_enrollments_view cev
       where cev.member_id = p_member_id and cev.status = 'concluido' and cev.course_name ilike '%CTL%'
     )
     and not exists (
       select 1 from public.course_enrollments_view cev
       where cev.member_id = p_member_id and cev.course_name ilike '%Escola de Líderes%'
     )
  then
    return query select 'sugerir_escola_lideres'::text, 'Concluiu o CTL — pode ser hora de sugerir a Escola de Líderes.'::text, 'info'::text;
  end if;

  if (select coalesce((select is_active from public.ministry_rules_config where rule_key = 'sem_life_group'), true))
     and v_member.life_group_id is null and v_member.journey_stage not in ('visitante')
  then
    return query select 'sem_life_group'::text, 'Não está vinculado a nenhum Life Group.'::text, 'atencao'::text;
  end if;

  if (select coalesce((select is_active from public.ministry_rules_config where rule_key = 'sem_discipulador'), true))
     and v_member.journey_stage not in ('visitante')
     and not exists (select 1 from public.discipleship d where d.disciple_id = p_member_id and d.status = 'ativo')
  then
    return query select 'sem_discipulador'::text, 'Não possui discipulador ativo registrado.'::text, 'atencao'::text;
  end if;

  if (select coalesce((select is_active from public.ministry_rules_config where rule_key = 'acompanhamento_pastoral'), true))
     and exists (
       select 1 from public.prayer_requests pr
       where pr.member_id = p_member_id and pr.is_answered = false and pr.created_at < now() - interval '14 days'
     )
  then
    return query select 'acompanhamento_pastoral'::text, 'Tem pedido de oração pendente há mais de 14 dias — pode precisar de acompanhamento pastoral.'::text, 'critico'::text;
  end if;

  if (select coalesce((select is_active from public.ministry_rules_config where rule_key = 'excesso_discipulos'), true))
     and (select count(*) from public.discipleship d where d.discipler_id = p_member_id and d.status = 'ativo') > 7
  then
    return query select 'excesso_discipulos'::text,
      ('Está discipulando ' || (select count(*) from public.discipleship d where d.discipler_id = p_member_id and d.status = 'ativo') || ' pessoas — pode ser hora de distribuir com outros discipuladores.')::text,
      'atencao'::text;
  end if;

  if (select coalesce((select is_active from public.ministry_rules_config where rule_key = 'sugerir_ministerio'), true))
     and exists (
       select 1 from public.course_enrollments_view cev
       where cev.member_id = p_member_id and cev.status = 'concluido' and cev.course_category = 'ministerial'
     )
     and not exists (select 1 from public.ministry_members mm where mm.member_id = p_member_id and mm.is_active)
  then
    return query select 'sugerir_ministerio'::text, 'Concluiu formação ministerial, mas ainda não está em nenhum ministério.'::text, 'info'::text;
  end if;
end; $$;
grant execute on function public.member_recommendations(uuid) to authenticated;
