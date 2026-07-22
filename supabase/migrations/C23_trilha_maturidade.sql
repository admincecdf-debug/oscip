-- ============================================================
-- CEC FAMILY — C23: Trilha de Maturidade (ADR-001, Fase 1)
-- Aditiva sobre C22_pastoral_timeline.sql — não altera nada existente.
-- - Coluna milestone_key: etiqueta canônica pra marcos de maturidade
--   (diferencia "um curso qualquer" de "o CTL especificamente")
-- Idempotente.
-- ============================================================

alter table public.pastoral_timeline
  add column if not exists milestone_key text;

comment on column public.pastoral_timeline.milestone_key is
  'Etiqueta canônica de marco de maturidade (ADR-001 Pilar II). '
  'Valores esperados: batismo, encontro_com_deus, ctl, escola_lideres. '
  'Null para eventos que não são marcos formais da trilha (ex: mudanca_etapa, observacao).';

create index if not exists idx_pt_milestone on public.pastoral_timeline(milestone_key) where milestone_key is not null;
