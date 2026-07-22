"use client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMyProfile, useMyMember, useCecmaisOfertas, useMemberCard } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { MemberHeader } from "@/components/panel/MemberHeader";
import { MaisCategoria } from "@/components/shared/CECmaisBrand";
import { getCategoria } from "@/lib/cecmais-categorias";
import { OFERTA_TIPO_LABELS } from "@/services/cecmaisOfertas";
import { logAudit } from "@/services/audit";
import type { CECmaisCategoriaSlug } from "@/types/domain";

export default function CategoriaPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const categoria = getCategoria(slug);
  const { data: ofertas = [], isLoading } = useCecmaisOfertas(slug as CECmaisCategoriaSlug);

  const { data: profile } = useMyProfile();
  const { data: member } = useMyMember();
  const { data: card } = useMemberCard(member?.id ?? null);
  const isAdmin = profile?.role && profile.role !== "membro" && profile.role !== "visitante";

  async function signOut() {
    if (profile) await logAudit(supabase, "logout", "auth", profile.id);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (!categoria) return notFound();

  return (
    <div className="min-h-screen bg-background">
      <MemberHeader active="cecmais" isAdmin={!!isAdmin} cardReady={card?.card_status === "elegivel" || card?.card_status === "emitida"} onSignOut={signOut} />

      <main className="container max-w-3xl space-y-6 py-8">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/painel/cecmais/explorar"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <MaisCategoria nome={categoria.nome} size="md" />
        </div>

        <p className="text-muted-foreground">{categoria.descricao}</p>

        {isLoading ? (
          <p className="text-sm italic text-muted-foreground">Carregando…</p>
        ) : ofertas.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {ofertas.map((o) => (
              <Link key={o.id} href={`/painel/cecmais/${slug}/${o.id}`}>
                <Card className="h-full overflow-hidden transition hover:shadow-md hover:-translate-y-0.5">
                  {o.imagem_url && <img src={o.imagem_url} alt={o.nome} className="h-32 w-full object-cover" />}
                  <CardContent className="pt-3">
                    <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">
                      {OFERTA_TIPO_LABELS[o.tipo]}
                    </span>
                    <p className="mt-1.5 font-semibold text-navy">{o.nome}</p>
                    {o.descricao_curta && <p className="mt-0.5 text-xs text-muted-foreground">{o.descricao_curta}</p>}
                    <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-gold">
                      Conhecer <ChevronRight className="h-3 w-3" />
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="pt-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-navy">O que vem por aí</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {categoria.ofertas.map((oferta) => (
                    <div key={oferta} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                      <span>{oferta}</span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        <Clock className="h-3 w-3" /> Em breve
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <p className="rounded-md border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
              Essas ofertas ainda estão sendo preparadas. Assim que estiverem disponíveis, você poderá
              conhecer, contratar ou se matricular direto por aqui.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
