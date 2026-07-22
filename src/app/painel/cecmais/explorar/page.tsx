"use client";
import Link from "next/link";
import { ArrowLeft, ChevronRight, HeartPulse, ShieldCheck, GraduationCap, BookOpen, Library, Sparkles as SparklesIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMyProfile, useMyMember, useMemberCard } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { MemberHeader } from "@/components/panel/MemberHeader";
import { MaisCategoria } from "@/components/shared/CECmaisBrand";
import { CECmaisSubNav } from "@/components/panel/CECmaisSubNav";
import { CECMAIS_CATEGORIAS } from "@/lib/cecmais-categorias";
import { logAudit } from "@/services/audit";

const ICONS: Record<string, React.ReactNode> = {
  saude: <HeartPulse className="h-6 w-6" />,
  protecao: <ShieldCheck className="h-6 w-6" />,
  formacao: <GraduationCap className="h-6 w-6" />,
  fe: <BookOpen className="h-6 w-6" />,
  leitura: <Library className="h-6 w-6" />,
  vantagens: <SparklesIcon className="h-6 w-6" />,
};

export default function ExplorarPage() {
  const { data: profile } = useMyProfile();
  const { data: member } = useMyMember();
  const { data: card } = useMemberCard(member?.id ?? null);
  const isAdmin = profile?.role && profile.role !== "membro" && profile.role !== "visitante";

  async function signOut() {
    if (profile) await logAudit(supabase, "logout", "auth", profile.id);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-background">
      <MemberHeader active="cecmais" isAdmin={!!isAdmin} cardReady={card?.card_status === "elegivel" || card?.card_status === "emitida"} onSignOut={signOut} />

      <main className="container max-w-4xl space-y-6 py-8">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/painel/cecmais"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="font-display text-xl text-navy">Explorar</h1>
        </div>

        <CECmaisSubNav />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CECMAIS_CATEGORIAS.map((cat) => (
            <Link key={cat.slug} href={`/painel/cecmais/${cat.slug}`}>
              <Card className="h-full transition hover:shadow-md hover:-translate-y-0.5">
                <CardContent className="pt-5">
                  <div className="mb-2 flex items-center gap-2 text-gold">{ICONS[cat.slug]}</div>
                  <MaisCategoria nome={cat.nome} size="sm" />
                  <p className="mt-1.5 text-sm text-muted-foreground">{cat.descricao}</p>
                  <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-gold">
                    Explorar <ChevronRight className="h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
