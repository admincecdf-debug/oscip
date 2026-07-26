"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, hasSupabaseEnv } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/schemas";
import { logAudit } from "@/services/audit";

export default function LoginForm() {
  const envOk = hasSupabaseEnv();
  const [err, setErr] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (!envOk) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/painel";
    });
  }, [envOk]);

  async function onSubmit(values: LoginInput) {
    if (!envOk) { setErr("Configure as variáveis de ambiente do Supabase."); return; }
    setErr("");
    const { error, data } = await supabase.auth.signInWithPassword(values);
    if (error) { setErr(error.message); return; }
    if (data.user) await logAudit(supabase, "login", "auth", data.user.id);
    window.location.href = "/painel";
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-[radial-gradient(circle_at_30%_20%,#16345A,#0E2A47_60%)] p-5">
      <Link href="/" className="absolute left-5 top-5 flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Voltar ao início
      </Link>
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#C9A227]" />
          <h1 className="font-display text-2xl text-[#0E2A47]">Área do membro</h1>
        </div>
        <div className="my-3 h-[3px] w-16 rounded bg-[#C9A227]" />
        <p className="mb-6 text-xs text-muted-foreground">Discipulado, células, núcleos e gestão</p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
          </div>
        </div>
        {err && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
        <Button type="submit" disabled={isSubmitting} className="mt-5 w-full bg-[#0E2A47] text-white hover:bg-[#16345A] hover:text-white">
          {isSubmitting ? "Entrando…" : "Entrar"}
        </Button>
        <div className="mt-3 text-center">
          <Link href="/recuperar-senha" className="text-sm font-semibold text-[#0E2A47] underline underline-offset-2 hover:text-[#C9A227] transition-colors">
            Esqueceu a senha?
          </Link>
        </div>
        <div className="mt-5 border-t border-gray-200 pt-5 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Ainda não tem conta?</p>
          <Link href="/cadastrar">
            <Button type="button" variant="outline" className="w-full border-[#0E2A47] text-[#0E2A47] hover:bg-[#0E2A47] hover:text-white transition-colors">
              Criar conta gratuita
            </Button>
          </Link>
        </div>
      </form>
    </main>
  );
}
