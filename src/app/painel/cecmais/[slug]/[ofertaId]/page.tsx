"use client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, GraduationCap, Repeat, Package, FileDown, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMyProfile, useMyMember, useCecmaisOferta, useMemberCard } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { MemberHeader } from "@/components/panel/MemberHeader";
import { getCategoria } from "@/lib/cecmais-categorias";
import { OFERTA_TIPO_LABELS, OFERTA_CTA_LABELS } from "@/services/cecmaisOfertas";
import { logAudit } from "@/services/audit";

export default function OfertaPage({ params }: { params: { slug: string; ofertaId: string } }) {
  const { slug, ofertaId } = params;
  const categoria = getCategoria(slug);
  const { data: oferta, isLoading } = useCecmaisOferta(ofertaId);

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

      <main className="container max-w-2xl space-y-5 py-8">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href={`/painel/cecmais/${slug}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="font-display text-lg text-navy">{categoria.nome}</h1>
        </div>

        {isLoading ? (
          <p className="text-sm italic text-muted-foreground">Carregando…</p>
        ) : !oferta ? (
          notFound()
        ) : (
          <>
            {oferta.imagem_url && (
              <img src={oferta.imagem_url} alt={oferta.nome} className="h-52 w-full rounded-xl object-cover" />
            )}

            <div>
              <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-bold uppercase text-gold">
                {OFERTA_TIPO_LABELS[oferta.tipo]}
              </span>
              <h2 className="mt-2 font-display text-2xl font-bold text-navy">{oferta.nome}</h2>
              {oferta.parceiro_nome && <p className="mt-0.5 text-sm text-muted-foreground">Oferecido por {oferta.parceiro_nome}</p>}
              {oferta.descricao_curta && <p className="mt-1 text-sm text-muted-foreground">{oferta.descricao_curta}</p>}
            </div>

            {oferta.descricao_completa && (
              <Card>
                <CardContent className="pt-4">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy"><Info className="h-3.5 w-3.5" /> Sobre</p>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{oferta.descricao_completa}</p>
                </CardContent>
              </Card>
            )}

            {/* Detalhes específicos por tipo */}
            <Card>
              <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
                {(oferta.tipo === "produto" || oferta.tipo === "conteudo_digital") && oferta.preco != null && (
                  <Detail icon={<Package className="h-3.5 w-3.5" />} label="Preço" value={`R$ ${Number(oferta.preco).toFixed(2)}`} />
                )}
                {oferta.tipo === "produto" && oferta.estoque != null && (
                  <Detail icon={<Package className="h-3.5 w-3.5" />} label="Estoque" value={`${oferta.estoque} unidade(s)`} />
                )}
                {oferta.tipo === "conteudo_digital" && oferta.arquivo_url && (
                  <Detail icon={<FileDown className="h-3.5 w-3.5" />} label="Formato" value="Digital (biblioteca)" />
                )}
                {oferta.tipo === "curso" && (
                  <>
                    {oferta.carga_horaria_horas != null && <Detail icon={<GraduationCap className="h-3.5 w-3.5" />} label="Carga horária" value={`${oferta.carga_horaria_horas}h`} />}
                    {oferta.numero_modulos != null && <Detail icon={<GraduationCap className="h-3.5 w-3.5" />} label="Módulos" value={`${oferta.numero_modulos}`} />}
                    <Detail icon={<GraduationCap className="h-3.5 w-3.5" />} label="Certificado" value={oferta.emite_certificado ? "Emite certificado" : "Sem certificado"} />
                  </>
                )}
                {(oferta.tipo === "assinatura" || oferta.tipo === "servico_plano") && (
                  <>
                    {oferta.preco_recorrente != null && (
                      <Detail icon={<Repeat className="h-3.5 w-3.5" />} label="Valor" value={`R$ ${Number(oferta.preco_recorrente).toFixed(2)}${oferta.periodicidade ? ` / ${oferta.periodicidade}` : ""}`} />
                    )}
                    <Detail icon={<Percent className="h-3.5 w-3.5" />} label="Dependentes" value={oferta.permite_dependentes ? "Permite incluir dependentes" : "Somente titular"} />
                    {oferta.carencia_dias != null && oferta.carencia_dias > 0 && (
                      <Detail icon={<Info className="h-3.5 w-3.5" />} label="Carência" value={`${oferta.carencia_dias} dia(s)`} />
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Button disabled className="w-full gap-1.5" size="lg">
              {OFERTA_CTA_LABELS[oferta.tipo]}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              A contratação online ainda está sendo preparada. Em breve você poderá {OFERTA_CTA_LABELS[oferta.tipo].toLowerCase()} direto por aqui.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">{icon} {label}</p>
      <p className="text-sm font-semibold text-navy">{value}</p>
    </div>
  );
}
