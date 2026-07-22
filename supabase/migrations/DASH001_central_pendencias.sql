-- ============================================================
-- CEC FAMILY — UX-003 Cap. 3 Parte 4: Central de Pendências
--
-- Junta numa lista só tudo que já existia espalhado: pedidos de
-- oração, solicitações de visita, novos contatos do funil,
-- delegações aguardando aprovação, carteirinhas aguardando
-- aprovação e relatórios RELMDA aguardando validação.
-- ============================================================

create or replace function public.central_pendencias()
returns table (
  categoria text, id uuid, titulo text, subtitulo text,
  created_at timestamptz, aba_destino text
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query

  -- Pedidos de oração não respondidos
  (select 'oracao'::text, pr.id, 'Pedido de oração', left(pr.request, 80), pr.created_at, 'prayer-requests'::text
   from public.prayer_requests pr
   left join public.life_groups lg on lg.id = pr.life_group_id
   where pr.is_answered = false
     and (pr.life_group_id is null or lg.church_id in (select public.accessible_church_ids()))
   limit 25)

  union all

  -- Solicitações de visita novas
  (select 'visita'::text, vr.id, 'Solicitação de visita: ' || vr.full_name, coalesce(vr.reason, vr.city, ''), vr.created_at, 'visit-requests'::text
   from public.visit_requests vr
   where vr.status = 'novo'
     and (vr.church_id is null or vr.church_id in (select public.accessible_church_ids()))
   limit 25)

  union all

  -- Novos contatos no funil de evangelismo
  (select 'contato'::text, vp.id, 'Novo contato: ' || vp.full_name, coalesce(vp.source, ''), coalesce(vp.first_contact_at, now()), 'crm'::text
   from public.visitor_pipeline vp
   where vp.stage = 'novo'
     and (vp.community_id is null or vp.community_id in (select public.accessible_church_ids()))
   limit 25)

  union all

  -- Delegações aguardando aprovação
  (select 'delegacao'::text, md.id, 'Delegação pendente: ' || md.module::text, md.scope_name, md.requested_at, 'delegations'::text
   from public.module_delegations md
   where md.status = 'pendente'::delegation_status
   limit 25)

  union all

  -- Carteirinhas aguardando aprovação
  (select 'carteirinha'::text, m.id, 'Carteirinha aguardando aprovação: ' || m.full_name, coalesce(ch.name, ''), m.joined_at::timestamptz, 'members'::text
   from public.members m
   left join public.churches ch on ch.id = m.church_id
   where m.card_status = 'aguardando_aprovacao'
     and (m.church_id is null or m.church_id in (select public.accessible_church_ids()))
   limit 25)

  union all

  -- Relatórios RELMDA aguardando validação
  (select 'relmda'::text, r.id, 'Relatório RELMDA aguardando validação', lg.name, r.created_at, 'relmda-supervisao'::text
   from public.relmda_weekly_reports r
   left join public.life_groups lg on lg.id = r.life_group_id
   where r.status = 'enviado'
     and (lg.church_id is null or lg.church_id in (select public.accessible_church_ids()))
   limit 25)

  order by created_at desc;
end; $$;
grant execute on function public.central_pendencias() to authenticated;
