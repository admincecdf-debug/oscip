-- ============================================================
-- CEC FAMILY — Fix: coluna target_audience ausente em life_groups
-- (migration original M6_lg_suggestion.sql parece nunca ter sido
-- executada neste banco). Idempotente — não afeta nada existente.
-- ============================================================

do $$ begin
  create type lg_target_audience as enum (
    'misto','jovens','casais','mulheres','homens','empresarios','universitarios','outro'
  );
exception when duplicate_object then null; end $$;

alter table public.life_groups
  add column if not exists target_audience lg_target_audience default 'misto';
