"use client";
import { useState } from "react";
import { Laptop, Smartphone, LogOut, ShieldCheck, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMyProfile, useMySessions } from "@/hooks/use-queries";
import { changeMyPassword, signOutEverywhere, endSession, getCurrentSessionToken } from "@/services/security";
import { MemberHeader } from "@/components/panel/MemberHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SegurancaPage() {
  const { data: profile } = useMyProfile();
  const { data: sessions = [], refetch } = useMySessions();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function handleChangePassword() {
    setErr(""); setMsg("");
    if (pw1.length < 6) { setErr("A senha precisa ter ao menos 6 caracteres."); return; }
    if (pw1 !== pw2) { setErr("As senhas não conferem."); return; }
    setBusy(true);
    try {
      await changeMyPassword(supabase, pw1);
      setMsg("Senha alterada com sucesso!");
      setPw1(""); setPw2("");
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Erro ao alterar a senha.");
    } finally { setBusy(false); }
  }

  async function handleSignOutEverywhere() {
    if (!confirm("Isso vai encerrar sua sessão em TODOS os dispositivos, incluindo este. Continuar?")) return;
    await signOutEverywhere(supabase);
    window.location.href = "/entrar";
  }

  async function handleEndSession(id: string) {
    await endSession(supabase, id);
    refetch();
  }

  const currentToken = getCurrentSessionToken();

  return (
    <div className="min-h-screen bg-background">
      <MemberHeader active="dashboard" isAdmin={false} onSignOut={signOut} />
      <div className="container max-w-2xl space-y-6 py-8">
        <div>
          <h1 className="font-display text-2xl text-navy">Segurança e senha</h1>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-gold" />Alterar senha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Nova senha</Label><Input type="password" placeholder="Mínimo 6 caracteres" value={pw1} onChange={(e) => setPw1(e.target.value)} /></div>
            <div><Label>Confirme a nova senha</Label><Input type="password" placeholder="Repita a senha" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            {msg && <p className="text-sm text-green-600">{msg}</p>}
            <Button onClick={handleChangePassword} disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-gold" />Sessões ativas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sessão registrada ainda.</p>}
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex items-center gap-2.5">
                  {s.device_label.includes("Android") || s.device_label.includes("iOS") ? <Smartphone className="h-4 w-4 text-muted-foreground" /> : <Laptop className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium text-navy">
                      {s.device_label}{" "}
                      {currentToken && s.id && <span className="text-xs font-normal text-muted-foreground">· último acesso {new Date(s.last_seen_at).toLocaleString("pt-BR")}</span>}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleEndSession(s.id)}>Encerrar</Button>
              </div>
            ))}
            <div className="pt-2">
              <Button variant="outline" className="gap-2 text-red-600 border-red-300" onClick={handleSignOutEverywhere}>
                <LogOut className="h-4 w-4" /> Sair de todos os dispositivos
              </Button>
              <p className="mt-1.5 text-xs text-muted-foreground">Isso encerra de verdade o acesso em qualquer aparelho logado com sua conta.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
