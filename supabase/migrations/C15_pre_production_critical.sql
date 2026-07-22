-- ============================================================
-- CEC FAMILY — Caderno 15: Pré-produção críticos
-- Idempotente.
-- ============================================================

-- 1) Telefone único em members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'members_phone_unique' AND conrelid = 'public.members'::regclass
  ) THEN
    -- Primeiro limpar duplicatas (mantém o mais recente)
    DELETE FROM public.members m1
    USING public.members m2
    WHERE m1.phone = m2.phone
      AND m1.phone IS NOT NULL
      AND m1.created_at < m2.created_at;

    ALTER TABLE public.members ADD CONSTRAINT members_phone_unique UNIQUE (phone);
  END IF;
END $$;

-- 2) Coluna lgpd_accepted_at em members (registro do momento do aceite)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS lgpd_accepted_at TIMESTAMPTZ DEFAULT NULL;

-- 3) Coluna lgpd_accepted_at em visitor_pipeline (visitantes também aceitam)
ALTER TABLE public.visitor_pipeline
  ADD COLUMN IF NOT EXISTS lgpd_accepted_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- INSTRUÇÕES DE CONFIGURAÇÃO NO SUPABASE DASHBOARD
-- (não executar como SQL — são passos manuais)
-- ============================================================
-- A) SMTP (Authentication > Settings > Email):
--    Configurar servidor SMTP externo (ex: SendGrid, Resend, Brevo)
--    Site URL: https://seu-dominio.vercel.app
--    Redirect URLs: https://seu-dominio.vercel.app/nova-senha
--
-- B) Verificação de e-mail (Authentication > Settings > Email):
--    Habilitar "Confirm email" = ON
--
-- C) Captcha (Authentication > Settings > Bot and abuse protection):
--    Habilitar Turnstile
--    Inserir Secret Key do Cloudflare Turnstile
--    No Vercel: NEXT_PUBLIC_TURNSTILE_SITE_KEY = <site key>
-- ============================================================
