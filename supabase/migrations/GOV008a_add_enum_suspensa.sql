-- ============================================================
-- GOV-002 §17.1: Suspensão de delegações. Passo 1/2 — precisa
-- rodar sozinho primeiro (Postgres não deixa usar um valor de enum
-- novo na mesma transação que o cria).
-- ============================================================
do $$ begin
  alter type delegation_status add value if not exists 'suspensa';
exception when duplicate_object then null; end $$;
