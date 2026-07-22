"use client";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMyProfile, useMyMember, useMemberCard } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { MemberHeader } from "@/components/panel/MemberHeader";
import { CECmaisLogo, Mais } from "@/components/shared/CECmaisBrand";
import { CECMAIS_CATEGORIAS } from "@/lib/cecmais-categorias";
import { logAudit } from "@/services/audit";

const CATEGORIES = CECMAIS_CATEGORIAS;

export default function CECmaisPage() {
  const { data: profile } = useMyProfile();
  const { data: member } = useMyMember();
  const { data: card } = useMemberCard(member?.id ?? null);
  const isAdmin = profile?.role && profile.role !== "membro" && profile.role !== "visitante";
  const firstName = (member?.full_name ?? profile?.full_name ?? "").split(" ")[0];

  async function signOut() {
    if (profile) await logAudit(supabase, "logout", "auth", profile.id);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-background">
      <MemberHeader active="cecmais" isAdmin={!!isAdmin} cardReady={card?.card_status === "elegivel" || card?.card_status === "emitida"} onSignOut={signOut} />

      <main className="container max-w-3xl space-y-8 py-12 text-center">
        <CECmaisLogo size="lg" className="justify-center" />

        <div>
          <p className="text-lg text-muted-foreground">Olá, {firstName || "membro"}.</p>
          <p className="mt-2 font-display text-2xl leading-snug text-navy">
            <Mais className="text-2xl" /> cuidado.<br />
            <Mais className="text-2xl" /> conhecimento.<br />
            <Mais className="text-2xl" /> oportunidades para você e sua família.
          </p>
        </div>

        <div className="relative mx-auto max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar no CECmais…" className="h-12 pl-9 text-sm" disabled />
        </div>

        <div className="rounded-xl border border-dashed border-gold/40 bg-gold/5 p-6">
          <p className="text-sm text-muted-foreground">
            Conheça <Mais className="text-base" /> Saúde, <Mais className="text-base" /> Proteção,{" "}
            <Mais className="text-base" /> Formação, <Mais className="text-base" /> Fé,{" "}
            <Mais className="text-base" /> Leitura e <Mais className="text-base" /> Vantagens —
            serviços, formação, conteúdos e oportunidades para você e sua família.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/painel/cecmais/${c.slug}`}
                className="rounded-full border border-navy/10 bg-white px-3 py-1 text-xs font-semibold text-navy/70 transition hover:border-gold/50 hover:bg-gold/5"
              >
                <Mais className="text-xs" /> {c.nome}
              </Link>
            ))}
          </div>
          <div className="mt-5">
            <Button asChild className="gap-1.5">
              <Link href="/painel/cecmais/explorar">Explorar tudo <ChevronRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
