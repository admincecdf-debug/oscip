"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, hasSupabaseEnv } from "@/lib/supabase/client";

const AdminPanel = dynamic(() => import("@/components/admin/AdminPanel"), {
  ssr: false, loading: () => <main className="grid h-screen place-items-center text-muted">Carregando…</main>,
});

// A decisão fina de QUEM pode entrar (apostolo/pastor OU quem tem
// delegação ativa) e QUAIS módulos cada um vê fica dentro do próprio
// AdminPanel — ele já mostra uma tela de "Acesso restrito" quando
// necessário. Aqui só garantimos que existe uma sessão logada.
export default function Page() {
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
  return <AdminPanel />;
}
