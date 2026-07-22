-- ============================================================
-- CEC FAMILY — Especificação de Melhorias §1.1: Últimos Vídeos.
-- Adiciona campo de duração às pregações (opcional, preenchido
-- manualmente — ex: "42:15").
-- ============================================================

alter table public.sermons add column if not exists duration text;
