"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Share2, ShieldCheck, Calendar, Church, Users2, CalendarCheck,
  User, Heart, FileText, ChevronRight, CheckCircle2, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useMyProfile, useMyMember, useChurches, useCells, useMyMinistries, useMemberCard, useChurchStateName,
} from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { MemberHeader } from "@/components/panel/MemberHeader";
import { CompleteProfileCard } from "@/components/panel/CompleteProfileCard";
import { qrCodeImageUrl, CARD_STATUS_LABELS } from "@/services/cecId";
import { logAudit } from "@/services/audit";
import type { CardStatus } from "@/types/domain";

const DEFAULT_LOGO = "/images/cec-family-logo.png";

function maskDoc(value: string | null | undefined, keepEnd = 2): string {
  if (!value) return "—";
  const trimmed = value.trim();
  const dashIdx = trimmed.lastIndexOf(" - ") >= 0 ? trimmed.lastIndexOf(" - ") : trimmed.lastIndexOf(" – ");
  const main = dashIdx > 0 ? trimmed.slice(0, dashIdx) : trimmed;
  const suffix = dashIdx > 0 ? trimmed.slice(dashIdx) : "";
  if (main.length <= keepEnd) return "*".repeat(main.length) + suffix;
  return "*".repeat(Math.max(main.length - keepEnd, 3)).slice(0, main.length - keepEnd) + main.slice(-keepEnd) + suffix;
}

function situacaoLabel(status: string | undefined, cardStatus: CardStatus | undefined): { label: string; tone: string } {
  if (cardStatus === "suspensa") return { label: "Suspensa", tone: "bg-red-50 text-red-700 border-red-300" };
  if (status === "inativo") return { label: "Inativa", tone: "bg-slate-100 text-slate-600 border-slate-300" };
  if (status === "afastado") return { label: "Transferida", tone: "bg-amber-50 text-amber-700 border-amber-300" };
  return { label: "Ativa", tone: "bg-green-50 text-green-700 border-green-300" };
}
function elegibilidadeLabel(cardStatus: CardStatus | undefined): { label: string; tone: string } {
  switch (cardStatus) {
    case "elegivel": case "emitida": return { label: "Elegível", tone: "bg-green-50 text-green-700 border-green-300" };
    case "aguardando_aprovacao": case "aguardando_validacao": return { label: "Aguardando validação", tone: "bg-purple-50 text-purple-700 border-purple-300" };
    case "aguardando_foto": return { label: "Aguardando foto", tone: "bg-amber-50 text-amber-700 border-amber-300" };
    case "aguardando_documentos": return { label: "Aguardando dados", tone: "bg-amber-50 text-amber-700 border-amber-300" };
    default: return { label: "Não elegível", tone: "bg-slate-100 text-slate-600 border-slate-300" };
  }
}
function carteirinhaLabel(cardStatus: CardStatus | undefined): { label: string; tone: string } {
  switch (cardStatus) {
    case "emitida": case "elegivel": return { label: "Liberada", tone: "bg-blue-50 text-blue-700 border-blue-300" };
    case "suspensa": return { label: "Suspensa", tone: "bg-red-50 text-red-700 border-red-300" };
    case "cancelada": return { label: "Cancelada", tone: "bg-red-100 text-red-800 border-red-400" };
    case "aguardando_aprovacao": case "aguardando_validacao": case "aguardando_documentos": case "aguardando_foto":
      return { label: "Em análise", tone: "bg-purple-50 text-purple-700 border-purple-300" };
    default: return { label: "Não disponível", tone: "bg-slate-100 text-slate-600 border-slate-300" };
  }
}

export default function CarteiraPage() {
  const { data: profile } = useMyProfile();
  const { data: member } = useMyMember();
  const { data: churches = [] } = useChurches();
  const { data: cells = [] } = useCells();
  const { data: ministries = [] } = useMyMinistries();
  const { data: card } = useMemberCard(member?.id ?? null);
  const [shared, setShared] = useState(false);

  const isAdmin = profile?.role && profile.role !== "membro" && profile.role !== "visitante";
  const church = churches.find((c) => c.id === member?.church_id);
  const { data: territorialStateName } = useChurchStateName(member?.church_id ?? null);
  const lg = cells.find((c) => c.id === member?.life_group_id);

  async function signOut() {
    if (profile) await logAudit(supabase, "logout", "auth", profile.id);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function share() {
    const url = card ? `${window.location.origin}/cec-id/${card.qr_token}` : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Minha Carteira CEC ID", text: `${member?.full_name} — ${card?.categoria ?? ""}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true); setTimeout(() => setShared(false), 2000);
      }
    } catch { /* usuário cancelou o compartilhamento */ }
  }

  if (!member || !card) {
    return (
      <div className="min-h-screen bg-background">
        <MemberHeader active="carteira" isAdmin={!!isAdmin} cardReady={card?.card_status === "elegivel" || card?.card_status === "emitida"} onSignOut={signOut} />
        <main className="container py-8"><p className="text-sm text-muted-foreground">Carregando…</p></main>
      </div>
    );
  }

  const isReady = card.card_status === "elegivel" || card.card_status === "emitida";
  const situacao = situacaoLabel(member.status, card.card_status);
  const elegibilidade = elegibilidadeLabel(card.card_status);
  const carteirinha = carteirinhaLabel(card.card_status);
  const logoUrl = church?.logo_url || DEFAULT_LOGO;

  return (
    <div className="min-h-screen bg-background">
      <MemberHeader active="carteira" isAdmin={!!isAdmin} cardReady={card?.card_status === "elegivel" || card?.card_status === "emitida"} onSignOut={signOut} />

      <main className="container max-w-5xl space-y-6 py-8">
        {/* Cabeçalho da página */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link href="/painel"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <h1 className="font-display text-xl text-navy">Carteira de Membro</h1>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${situacao.tone}`}>{situacao.label.toUpperCase()}</span>
          </div>
          <Button onClick={share} variant="outline" size="sm" className="gap-1.5">
            <Share2 className="h-3.5 w-3.5" /> {shared ? "Link copiado!" : "Compartilhar"}
          </Button>
        </div>

        {!isReady && <CompleteProfileCard member={member} />}

        {/* Card principal */}
        <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_15%_10%,#1a3d66,#0E2A47_65%)] p-6 text-white shadow-xl sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-gold/10" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-white/5" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex flex-col items-center sm:items-start">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-gold bg-white/10 sm:h-32 sm:w-32">
                {member.photo_url ? (
                  <img src={member.photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-3xl font-bold text-white/60">
                    {member.full_name.charAt(0)}
                  </div>
                )}
              </div>
              <span className="mt-2 flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90">
                <CheckCircle2 className="h-3 w-3 text-green-400" /> {situacao.label === "Ativa" ? "Vínculo ativo" : situacao.label}
              </span>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2.5">
                <img src={logoUrl} alt="Logo" className="h-9 w-9 object-contain" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Comunidade Evangélica Cristã</p>
                  <p className="font-display text-base font-bold text-gold">{church?.name ?? "—"}</p>
                  {territorialStateName && <p className="text-[11px] uppercase tracking-wide text-white/60">{territorialStateName}</p>}
                </div>
              </div>

              <h2 className="mt-4 font-display text-2xl font-bold">{member.full_name}</h2>
              <p className="text-sm font-bold uppercase tracking-wide text-gold">{card.categoria}</p>

              <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white/60">CEC ID</p>
              <p className="rounded-md bg-white/10 px-3 py-1.5 font-mono text-sm tracking-wide text-white inline-block">{card.cec_id ?? "—"}</p>
            </div>

            <div className="flex flex-col items-center gap-1.5 self-center">
              <div className="rounded-lg bg-white p-2">
                {isReady ? (
                  <img src={qrCodeImageUrl(card.qr_token)} alt="QR Code" className="h-28 w-28" />
                ) : (
                  <div className="grid h-28 w-28 place-items-center text-center text-[10px] text-slate-400">QR indisponível</div>
                )}
              </div>
              <p className="flex items-center gap-1 text-[10px] text-white/70"><ShieldCheck className="h-3 w-3" /> Verificar autenticidade</p>
              <p className="text-[10px] text-white/50">Escaneie o QR Code</p>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-4 sm:grid-cols-4">
            <div>
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/60"><Calendar className="h-3 w-3" /> Membro desde</p>
              <p className="text-sm font-semibold">{member.member_since ? new Date(member.member_since).toLocaleDateString("pt-BR") : "—"}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/60"><Church className="h-3 w-3" /> Igreja</p>
              <p className="text-sm font-semibold">{church?.name ?? "—"}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/60"><Users2 className="h-3 w-3" /> Life Group</p>
              <p className="text-sm font-semibold">{lg?.name ?? "Aguardando alocação"}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/60"><CalendarCheck className="h-3 w-3" /> Emissão</p>
              <p className="text-sm font-semibold">{card.card_issued_at ? new Date(card.card_issued_at).toLocaleDateString("pt-BR") : "—"}</p>
            </div>
          </div>
        </div>

        {/* 3 cards de detalhe */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy"><User className="h-3.5 w-3.5" /> Informações pessoais</p>
              <dl className="space-y-1.5 text-sm">
                <div><dt className="text-[11px] text-muted-foreground">Data de nascimento</dt><dd>{member.birth_date ? new Date(member.birth_date).toLocaleDateString("pt-BR") : "—"}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">E-mail</dt><dd className="truncate">{member.email ?? "—"}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Telefone</dt><dd>{member.phone ?? "—"}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Estado civil</dt><dd className="capitalize">{member.marital_status ?? "—"}</dd></div>
              </dl>
              <Link href="/painel?tab=perfil" className="mt-2 flex items-center gap-1 text-xs font-semibold text-gold hover:underline">
                Ver mais detalhes <ChevronRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy"><Heart className="h-3.5 w-3.5" /> Ministério</p>
              {ministries.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">Nenhum ministério ativo</p>
              ) : (
                <dl className="space-y-1.5 text-sm">
                  <div><dt className="text-[11px] text-muted-foreground">Participa de</dt><dd>{ministries[0].name}</dd></div>
                  {ministries.length > 1 && <div><dt className="text-[11px] text-muted-foreground">e mais</dt><dd>{ministries.length - 1} ministério(s)</dd></div>}
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy"><FileText className="h-3.5 w-3.5" /> Documentos</p>
              <dl className="space-y-1.5 text-sm">
                <div><dt className="text-[11px] text-muted-foreground">CPF</dt><dd className="font-mono">{maskDoc(member.cpf)}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">RG</dt><dd className="font-mono">{maskDoc(member.rg)}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">CNH</dt><dd className="font-mono">{maskDoc(member.cnh)}</dd></div>
              </dl>
              <Link href="/painel?tab=perfil" className="mt-2 flex items-center gap-1 text-xs font-semibold text-gold hover:underline">
                Ver mais detalhes <ChevronRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Situação e elegibilidade */}
        <Card>
          <CardContent className="pt-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy"><ShieldCheck className="h-3.5 w-3.5" /> Situação e elegibilidade</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Situação</p>
                <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${situacao.tone}`}>{situacao.label.toUpperCase()}</span>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Elegibilidade</p>
                <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${elegibilidade.tone}`}>{elegibilidade.label.toUpperCase()}</span>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Carteirinha</p>
                <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${carteirinha.tone}`}>{carteirinha.label.toUpperCase()}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {isReady
                ? "Seu cadastro está completo e validado pela liderança."
                : `Status atual: ${CARD_STATUS_LABELS[card.card_status]}.`}
            </p>
          </CardContent>
        </Card>

        {/* Ações rápidas */}
        <Card>
          <CardContent className="pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-navy">Ações rápidas</p>
            <div className="flex flex-wrap gap-4 text-xs">
              {[
                { icon: <User className="h-4 w-4" />, label: "Meus dados", href: "/painel?tab=perfil" },
                { icon: <FileText className="h-4 w-4" />, label: "Discipulado", href: "/painel?tab=discipulado" },
                { icon: <Heart className="h-4 w-4" />, label: "Ministérios", href: "/painel?tab=ministerio" },
              ].map((a) => (
                <Link key={a.label} href={a.href} className="flex flex-col items-center gap-1 rounded-md px-3 py-2 text-navy hover:bg-muted/40">
                  {a.icon} {a.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="rounded-md border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
          <b className="text-navy">Esta é a sua Carteirinha Digital CEC ID.</b><br />
          Apresente o QR Code para identificação em congressos, eventos e serviços da Igreja.
        </p>
      </main>
    </div>
  );
}
