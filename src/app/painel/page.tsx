"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, hasSupabaseEnv } from "@/lib/supabase/client";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const PanelDashboard = dynamic(() => import("@/components/panel/PanelDashboard"), {
  ssr: false, loading: () => <main className="grid h-screen place-items-center text-muted">Carregando…</main>,
});

function EmailNotVerified({ email, onResend }: { email: string; onResend: () => void }) {
  const [sent, setSent] = useState(false);
  const handleResend = async () => {
    await onResend();
    setSent(true);
    setTimeout(() => setSent(false), 30000);
  };
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_30%_20%,#16345A,#0E2A47_60%)] p-5">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center space-y-4">
        <MailCheck className="mx-auto h-12 w-12 text-[#C9A227]" />
        <h1 className="font-display text-xl text-[#0E2A47] font-bold">Confirme seu e-mail</h1>
        <p className="text-sm text-muted-foreground">
          Enviamos um link de confirmação para <strong>{email}</strong>.<br />
          Clique no link para ativar sua conta e acessar o painel.
        </p>
        <p className="text-xs text-muted-foreground">Não recebeu? Verifique o spam.</p>
        <Button
          onClick={handleResend}
          disabled={sent}
          variant="outline"
          className="w-full"
        >
          {sent ? "E-mail reenviado ✓" : "Reenviar e-mail de confirmação"}
        </Button>
        <Button
          variant="ghost"
          className="w-full text-xs"
          onClick={() => supabase.auth.signOut().then(() => window.location.href = "/entrar")}
        >
          Sair
        </Button>
      </div>
    </main>
  );
}

export default function PanelPage() {
  const envOk = hasSupabaseEnv();
  const [session, setSession] = useState<Session | null | "loading">("loading");

  useEffect(() => {
    if (!envOk) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { window.location.href = "/entrar"; return; }
      setSession(data.session);
    });
  }, [envOk]);

  if (!envOk) return <main className="grid h-screen place-items-center px-4 text-center text-muted">Configure as variáveis de ambiente do Supabase na Vercel.</main>;
  if (session === "loading") return <main className="grid h-screen place-items-center text-muted">Carregando…</main>;
  if (!session) return null;

  // Guarda: e-mail não verificado
  if (!session.user.email_confirmed_at) {
    const resend = async () => {
      await supabase.auth.resend({ type: "signup", email: session.user.email! });
    };
    return <EmailNotVerified email={session.user.email ?? ""} onResend={resend} />;
  }

  return <PanelDashboard />;
}
