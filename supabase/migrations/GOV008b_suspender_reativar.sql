-- ============================================================
-- GOV-002 §17.1: Suspensão de delegações. Passo 2/2 — precisa
-- rodar depois do GOV008a.
--
-- Diferença pra Revogação: suspender interrompe o acesso
-- temporariamente SEM apagar a delegação nem perder o histórico —
-- pode ser reativada depois, voltando exatamente pro que era antes.
-- ============================================================

create or replace function public.suspend_delegation(p_delegation_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_apostle() or exists (select 1 from public.council_members cm where cm.profile_id = auth.uid() and cm.is_active)) then
    raise exception 'Sem permissão para suspender delegações' using errcode = '42501';
  end if;

  update public.module_delegations
  set status = 'suspensa'::delegation_status, review_notes = coalesce(p_reason, review_notes)
  where id = p_delegation_id and status = 'ativo'::delegation_status;

  begin
    perform public.audit_log('update', 'module_delegations', p_delegation_id, jsonb_build_object('acao', 'suspensao', 'motivo', p_reason));
  exception when others then null;
  end;
end; $$;
grant execute on function public.suspend_delegation(uuid, text) to authenticated;

create or replace function public.reactivate_delegation(p_delegation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_apostle() or exists (select 1 from public.council_members cm where cm.profile_id = auth.uid() and cm.is_active)) then
    raise exception 'Sem permissão para reativar delegações' using errcode = '42501';
  end if;

  update public.module_delegations
  set status = 'ativo'::delegation_status
  where id = p_delegation_id and status = 'suspensa'::delegation_status
    and (expires_at is null or expires_at > now());

  begin
    perform public.audit_log('update', 'module_delegations', p_delegation_id, jsonb_build_object('acao', 'reativacao'));
  exception when others then null;
  end;
end; $$;
grant execute on function public.reactivate_delegation(uuid) to authenticated;

-- has_module_access e has_permission já filtram por status = 'ativo',
-- então uma delegação suspensa automaticamente perde o acesso sem
-- precisar de nenhuma mudança nessas funções.
