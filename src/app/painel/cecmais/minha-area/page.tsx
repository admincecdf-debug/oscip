"use client";
import Link from "next/link";
import { Wrench, GraduationCap, Library, Repeat, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMyProfile, useMyMember, useMemberCard } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { MemberHeader } from "@/components/panel/MemberHeader";
import { CECmaisSubNav } from "@/components/panel/CECmaisSubNav";
import { logAudit } from "@/services/audit";

function SectionCard({ icon, title, description, ctaLabel, href }: {
  icon: React.ReactNode; title: string; description: string; ctaLabel: string; href: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-2 flex items-center gap-2 text-gold">{icon}</div>
        <p className="font-display text-base font-bold text-navy">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <Button asChild variant="outline" size="sm" className="mt-3 gap-1">
          <Link href={href}>{ctaLabel} <ChevronRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function MinhaAreaPage() {
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

      <main className="container max-w-3xl space-y-6 py-8">
        <div>
          <h1 className="font-display text-xl text-navy">Minha Área</h1>
          <p className="text-sm text-muted-foreground">Seus serviços, formação, biblioteca e assinaturas do CECmais.</p>
        </div>

        <CECmaisSubNav />

        <div className="grid gap-4 sm:grid-cols-2">
          <SectionCard
            icon={<Wrench className="h-6 w-6" />}
            title="Meus Serviços"
            description="Você ainda não contratou nenhum serviço ou plano."
            ctaLabel="Explorar mais Proteção"
            href="/painel/cecmais/protecao"
          />
          <SectionCard
            icon={<GraduationCap className="h-6 w-6" />}
            title="Minha Formação"
            description="Você ainda não se matriculou em nenhum curso."
            ctaLabel="Explorar mais Formação"
            href="/painel/cecmais/formacao"
          />
          <SectionCard
            icon={<Library className="h-6 w-6" />}
            title="Minha Biblioteca"
            description="Você ainda não tem livros ou conteúdos digitais."
            ctaLabel="Explorar mais Leitura"
            href="/painel/cecmais/leitura"
          />
          <SectionCard
            icon={<Repeat className="h-6 w-6" />}
            title="Minhas Assinaturas"
            description="Você ainda não possui assinaturas ativas."
            ctaLabel="Explorar mais Saúde"
            href="/painel/cecmais/saude"
          />
        </div>

        <p className="rounded-md border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
          Assim que a contratação online estiver disponível, tudo que você adquirir no CECmais vai
          aparecer automaticamente aqui.
        </p>
      </main>
    </div>
  );
}
