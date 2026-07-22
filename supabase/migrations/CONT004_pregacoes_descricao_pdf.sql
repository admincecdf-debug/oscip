-- ============================================================
-- CEC FAMILY — Pregações: adiciona descrição (tema/conteúdo pro
-- usuário) e link de PDF pra download da palavra.
-- church_id já existe na tabela — só confirmando aqui.
-- ============================================================

alter table public.sermons add column if not exists description text;
alter table public.sermons add column if not exists pdf_url text;
