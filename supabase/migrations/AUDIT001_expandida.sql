-- ============================================================
-- AUDIT001 — Auditoria expandida (IP + before/after + justificativa)
-- ============================================================
-- A tabela public.audit_logs já tinha as colunas `ip` e `details`
-- (jsonb) desde antes deste projeto, mas:
--   1) `ip` nunca era preenchido — a função audit_log() não tinha
--      parâmetro pra receber isso, então a coluna sempre ficava NULL.
--   2) `details` já é flexível o bastante pra guardar valor
--      anterior/posterior e justificativa — não precisa de coluna nova,
--      só de um formato padronizado ({ before, after, justificativa }),
--      que é responsabilidade do código da aplicação, não do banco.
--
-- Esta migration só ACRESCENTA um parâmetro novo (p_ip) com valor
-- padrão nulo, no FINAL da lista de parâmetros — os 5 parâmetros
-- originais continuam idênticos em nome/tipo/ordem/padrão, então
-- todas as dezenas de chamadas já existentes no app continuam
-- funcionando exatamente como antes (ip fica nulo pra elas, igual já era).
-- Idempotente.
-- ============================================================

create or replace function public.audit_log(
  p_action audit_action, p_entity text, p_entity_id uuid default null::uuid,
  p_details jsonb default null::jsonb, p_church_id uuid default null::uuid,
  p_ip text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_id uuid; v_email text;
begin
  select email into v_email from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, church_id, details, ip)
  values (auth.uid(), v_email, p_action, p_entity, p_entity_id, p_church_id, p_details, p_ip)
  returning id into v_id;
  return v_id;
end;
$function$;
