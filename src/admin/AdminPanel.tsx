"use client";
import { InviteLinksAdmin } from "./InviteLinksAdmin";
import { LeadershipAdmin } from "./LeadershipAdmin";
import { CECmaisOfertasAdmin } from "./CECmaisOfertasAdmin";
import { MdaStructureAdmin } from "./MdaStructureAdmin";
import { EvangelismGroupsAdmin } from "./EvangelismGroupsAdmin";
import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2, Plus, Menu, ChevronUp, ChevronDown, X, Pencil, FileDown } from "lucide-react";
import type { Sermon } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { sermonSchema, eventSchema, serviceTimeSchema, dailyWordSchema,
  type SermonInput, type EventInput, type ServiceTimeInput, type DailyWordInput } from "@/schemas";
import {
  useMyProfile, useSermons, useEvents,
  useDistricts, useAreas, useSectors, useCells,
  useChurches, useAllServiceTimes, useDailyWords,
  usePendingCounts, useMyActiveModules, useDelegations,
} from "@/hooks/use-queries";
import { DELEGATION_TAB_MAP, DELEGATION_MODULE_LABELS } from "@/services/delegations";
import { supabase } from "@/lib/supabase/client";
import { youtubeThumb } from "@/services/content";
import { logAudit } from "@/services/audit";
import { MembersAdmin } from "./MembersAdmin";
import { DiscipleshipAdmin } from "./DiscipleshipAdmin";
import { WeeklyReportsAdmin } from "./WeeklyReportsAdmin";
import { MonthlyReportAdmin } from "./MonthlyReportAdmin";
import { RelmdaSupervisorAdmin } from "./RelmdaSupervisorAdmin";
import { RelmdaConsolidacaoAdmin } from "./RelmdaConsolidacaoAdmin";
import { RelmdaDashboardAdmin } from "./RelmdaDashboardAdmin";
import { RelmdaDeadlineAdmin } from "./RelmdaDeadlineAdmin";
import { AreaConsolidadoAdmin } from "./AreaConsolidadoAdmin";
import { CecIdPortariaAdmin } from "./CecIdPortariaAdmin";
import { FinanceAdmin } from "./FinanceAdmin";
import { NewsAdmin } from "./NewsAdmin";
import { PublicPrayerRequestsAdmin, VisitRequestsAdmin } from "./ContactRequestsAdmin";
import { BannersAdmin } from "./BannersAdmin";
import { CommunitiesAdmin } from "./CommunitiesAdmin";
import { OrgStructureAdmin } from "./OrgStructureAdmin";
import { PermissionsAdmin } from "./PermissionsAdmin";
import { MdaHealthAdmin } from "./MdaHealthAdmin";
import { OrgDashboardAdmin } from "./OrgDashboardAdmin";
import { IntelligenceAdmin } from "./IntelligenceAdmin";
import { ControlTowerAdmin } from "./ControlTowerAdmin";
import { DelegationsAdmin } from "./DelegationsAdmin";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { PendenciasAdmin } from "./PendenciasAdmin";
import { AgendaAdmin } from "./AgendaAdmin";
import { NotificacoesAdmin } from "./NotificacoesAdmin";
import { FormacaoAdmin } from "./FormacaoAdmin";
import { PainelUsuariosAdmin } from "./PainelUsuariosAdmin";
import { MinisterialReportsAdmin } from "./MinisterialReportsAdmin";
import { GenealogyAdmin } from "./GenealogyAdmin";
import { ExpansionMapAdmin } from "./ExpansionMapAdmin";
import { PatrimonyAdmin } from "./PatrimonyAdmin";
import { ExportAdmin } from "./ExportAdmin";
import { GpvAdmin } from "./GpvAdmin";
import { CellsAdmin } from "./CellsAdmin";
import { GlobalSearch } from "./GlobalSearch";
import { SupervisionDashboard } from "./SupervisionDashboard";
import { CrmPipelineAdmin } from "./CrmPipelineAdmin";
import { AcolhimentoAdmin } from "./AcolhimentoAdmin";
import { EvasionAdmin } from "./EvasionAdmin";
import { MinistriesAdmin } from "./MinistriesAdmin";
import { HealthAdmin } from "./HealthAdmin";
import { AdminSidebar, buildGroups, type TabKey, type AdminSidebarProps } from "./AdminSidebar";
import { AuditAdmin } from "./AuditAdmin";
import { MetasPlaceholder } from "./Placeholders";
import { MemberScoreAdmin } from "./MemberScoreAdmin";
import { BirthdaysAdmin } from "./BirthdaysAdmin";

export default function AdminPanel() {
  const { data: me, isLoading } = useMyProfile();
  const { data: counts } = usePendingCounts();
  const { data: myModules = [] } = useMyActiveModules();
  const isAdmin = me && (me.role === "apostolo" || myModules.length > 0);

  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab") as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(urlTab ?? "org-dashboard");
  const [previousTab, setPreviousTab] = useState<TabKey | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleNavigate = useCallback((tab: TabKey) => {
    setActiveTab((prev) => {
      setPreviousTab(prev);
      return tab;
    });
  }, []);

  if (isLoading) {
    return (
      <main className="grid h-screen place-items-center text-muted">Carregando…</main>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <Card className="mx-auto max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <h2 className="font-display text-xl text-navy">Acesso restrito</h2>
            <p className="mt-2 text-sm text-muted">
              O painel administrativo exige uma delegação ativa. Fale com o Administrador
              Nacional, Estadual ou o Pastor Principal da sua igreja pra solicitar acesso.
            </p>
            <Button asChild variant="link" className="mt-4">
              <Link href="/painel">← Voltar ao painel</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar (desktop: fixa; mobile: via drawer interno) ── */}
      <AdminSidebar
        activeTab={activeTab}
        onNavigate={handleNavigate}
        counts={{
          prayer_pending: counts?.prayer_pending ?? 0,
          visit_pending: counts?.visit_pending ?? 0,
          pipeline_new: counts?.pipeline_new ?? 0,
        }}
        userName={me?.full_name ?? undefined}
        userRole={me?.role ?? undefined}
        onSearch={() => setSearchOpen(true)}
      />

      {/* ── Área principal ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header — apenas mobile (desktop usa sidebar lateral) */}
        <header className="border-b-[3px] border-gold bg-navy md:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-3 text-white">
              {/* Botão hamburger renderizado pelo AdminSidebar mobileOnly */}
              <AdminSidebar
                activeTab={activeTab}
                onNavigate={handleNavigate}
                counts={{
                  prayer_pending: counts?.prayer_pending ?? 0,
                  visit_pending: counts?.visit_pending ?? 0,
                  pipeline_new: counts?.pipeline_new ?? 0,
                }}
                userName={me?.full_name ?? undefined}
                userRole={me?.role ?? undefined}
                onSearch={() => setSearchOpen(true)}
                mobileOnly
              />
              <span className="font-display text-sm font-semibold text-white/70">CEC Family</span>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/painel">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Painel
              </Link>
            </Button>
          </div>
        </header>

        {/* Busca global — sempre montada para capturar Ctrl+K */}
        <GlobalSearch
          onNavigate={(tab) => {
            handleNavigate(tab as TabKey);
          }}
        />

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto">
          <div className="container py-8">
            {previousTab === "org-dashboard" && activeTab !== "org-dashboard" && (
              <Button
                variant="outline" size="sm"
                className="mb-4 gap-1.5"
                onClick={() => handleNavigate("org-dashboard")}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Dashboard
              </Button>
            )}
            <TabContent activeTab={activeTab} onNavigate={handleNavigate} />
          </div>
        </main>
      </div>

      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={handleNavigate} />
    </div>
  );
}

// ─── Roteador de conteúdo ─────────────────────────────────────────────────────

// ─── Meu Painel — dashboard personalizado pra quem não é Apóstolo ────────────
function MeuPainel({ profile, allowedTabKeys, counts, onNavigate }: {
  profile: { id: string; full_name: string; role: string } | null | undefined;
  allowedTabKeys: Set<string>;
  counts: AdminSidebarProps["counts"];
  onNavigate: (tab: TabKey) => void;
}) {
  const { data: myDelegations = [] } = useDelegations({ profile_id: profile?.id, status: "ativo" });
  const shortcuts = buildGroups(counts).flatMap((g) => g.items).filter((i) => allowedTabKeys.has(i.key as TabKey));

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Meu Painel</p>
        <h1 className="font-display text-2xl text-navy">Olá, {profile?.full_name?.split(" ")[0] ?? "!"}</h1>
      </div>

      {myDelegations.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Suas delegações ativas</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {myDelegations.map((d) => (
              <Card key={d.id} className="border-l-4 border-l-gold">
                <CardContent className="py-3">
                  <p className="text-sm font-semibold text-navy">{DELEGATION_MODULE_LABELS[d.module] ?? d.module}</p>
                  <p className="text-xs text-muted-foreground">{d.scope_name || "—"}</p>
                  {d.expires_at && (
                    <p className="mt-0.5 text-[11px] text-amber-700">Válida até {new Date(d.expires_at).toLocaleDateString("pt-BR")}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Acesso rápido</p>
        {shortcuts.length === 0 ? (
          <Card className="mx-auto max-w-md text-center">
            <CardContent className="pt-8 pb-8">
              <h3 className="font-display text-lg text-navy">Nenhuma delegação ativa</h3>
              <p className="mt-2 text-sm text-muted">
                Fale com o Administrador Nacional, Estadual ou o Pastor Principal da sua igreja
                pra solicitar acesso a um módulo.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shortcuts.map((item) => (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key as TabKey)}
                className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span className="text-navy">{item.icon}</span>
                <span className="text-sm font-semibold text-navy">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabContent({ activeTab, onNavigate }: { activeTab: TabKey; onNavigate: (tab: TabKey) => void }) {
  const { data: profile } = useMyProfile();
  const { data: activeModules = [] } = useMyActiveModules();
  const { data: counts } = usePendingCounts();
  const isApostolo = profile?.role === "apostolo";

  if (!isApostolo) {
    const allowedTabKeys = new Set(activeModules.flatMap((m) => DELEGATION_TAB_MAP[m] ?? []));
    if (!allowedTabKeys.has(activeTab)) {
      return <MeuPainel profile={profile} allowedTabKeys={allowedTabKeys} counts={counts} onNavigate={onNavigate} />;
    }
  }

  switch (activeTab) {
    case "usuarios-painel":      return <PainelUsuariosAdmin onNavigate={onNavigate} />;
    case "formacao":             return <FormacaoAdmin />;
    case "notificacoes":         return <NotificacoesAdmin />;
    case "agenda":               return <AgendaAdmin onNavigate={onNavigate} />;
    case "pendencias":          return <PendenciasAdmin onNavigate={onNavigate} />;
    case "delegations":         return <DelegationsAdmin />;
    case "invites":             return <InviteLinksAdmin />;
    case "audit":               return <AuditView />;
    case "org-dashboard":       return <OrgDashboardAdmin onNavigate={onNavigate} />;
    case "supervision":         return <SupervisionDashboard />;
    case "control-tower":       return <ControlTowerAdmin onNavigate={onNavigate} />;
    case "intelligence":        return <IntelligenceAdmin />;
    case "ministerial-reports": return <MinisterialReportsAdmin />;
    case "metas":               return <MetasPlaceholder />;
    case "members":             return <MembersAdmin />;
    case "leadership":          return <LeadershipAdmin />;
    case "cecmais-ofertas":     return <CECmaisOfertasAdmin />;
    case "score":                return <MemberScoreAdmin />;
    case "birthdays":            return <BirthdaysAdmin />;
    case "discipleship":        return <DiscipleshipAdmin />;
    case "acolhimento":         return <AcolhimentoAdmin />;
    case "evasao":              return <EvasionAdmin />;
    case "crm":                 return <CrmPipelineAdmin />;
    case "prayer-requests":     return <PublicPrayerRequestsAdmin />;
    case "visit-requests":      return <VisitRequestsAdmin />;
    case "communities":         return <CommunitiesAdmin />;
    case "structure":           return <OrgStructureAdmin />;
    case "genealogy":           return <GenealogyAdmin />;
    case "expansion-map":       return <ExpansionMapAdmin />;
    case "ministerios":         return <MinistriesAdmin />;
    case "life-groups":         return <CellsAdmin />;
    case "mda-health":          return <MdaHealthAdmin />;
    case "saude":               return <HealthAdmin />;
    case "mda":                 return <MdaStructureAdmin />;
    case "evangelism-groups":   return <EvangelismGroupsAdmin />;
    case "permissions":         return <PermissionsAdmin />;
    case "weekly":              return <WeeklyReportsAdmin />;
    case "monthly":             return <MonthlyReportAdmin />;
    case "relmda-supervisao":   return <RelmdaSupervisorAdmin />;
    case "relmda-consolidacao": return <RelmdaConsolidacaoAdmin />;
    case "relmda-dashboard":    return <RelmdaDashboardAdmin />;
    case "relmda-prazos":       return <RelmdaDeadlineAdmin />;
    case "relmda-area":         return <AreaConsolidadoAdmin />;
    case "cec-id-portaria":     return <CecIdPortariaAdmin />;
    case "news":                return <NewsAdmin />;
    case "banners":             return <BannersAdmin />;
    case "sermons":             return <SermonsAdmin />;
    case "events":              return <EventsAdmin />;
    case "services":            return <ServiceTimesAdmin />;
    case "word":                return <DailyWordsAdmin />;
    case "finance":             return <FinanceAdmin />;
    case "patrimony":           return <PatrimonyAdmin />;
    case "gpv":                 return <GpvAdmin />;
    case "export":              return <ExportAdmin />;
    default:                    return null;
  }
}

// ─── Placeholders para módulos novos ─────────────────────────────────────────

// MetasPlaceholder foi extraído para Placeholders.tsx (reutilizado também em /executivo).

// Score e Aniversários agora são módulos separados: MemberScoreAdmin.tsx e BirthdaysAdmin.tsx.

// RH substituído pelo GPV — ver GpvAdmin.tsx

// ─── Subcomponentes internos (mantidos 100% intactos) ─────────────────────────

function SermonsAdmin() {
  const { data: sermons = [] } = useSermons();
  const { data: churches = [] } = useChurches();
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<Sermon | null>(null);
  const [churchId, setChurchId] = useState<string>("");
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } =
    useForm<SermonInput>({ resolver: zodResolver(sermonSchema), defaultValues: { is_featured: false, published_at: new Date().toISOString().slice(0, 10) } });
  const urlWatch = watch("youtube_url");

  function startEdit(s: Sermon) {
    setEditing(s); setErr(""); setChurchId(s.church_id ?? "");
    reset({
      title: s.title, youtube_url: s.youtube_url, reference: s.reference ?? "", speaker: s.speaker ?? "",
      category: s.category ?? "", duration: s.duration ?? "", description: s.description ?? "", pdf_url: s.pdf_url ?? "",
      published_at: s.published_at ? s.published_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      is_featured: s.is_featured,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() { setEditing(null); setChurchId(""); reset({ is_featured: false, published_at: new Date().toISOString().slice(0, 10) }); }

  async function onSubmit(v: SermonInput) {
    setErr("");
    const payload = {
      title: v.title, youtube_url: v.youtube_url, reference: v.reference || null, speaker: v.speaker || null,
      category: v.category || null, duration: v.duration || null,
      description: v.description || null, pdf_url: v.pdf_url || null,
      church_id: churchId || null,
      published_at: v.published_at ? new Date(v.published_at).toISOString() : new Date().toISOString(),
      is_featured: v.is_featured,
      thumbnail_url: youtubeThumb(v.youtube_url),
    };
    if (editing) {
      const { error } = await supabase.from("sermons").update(payload).eq("id", editing.id);
      if (error) { setErr(error.message); return; }
      await logAudit(supabase, "update", "sermons", editing.id, { title: v.title });
      setEditing(null);
    } else {
      const next_order = sermons.length > 0 ? Math.max(...sermons.map((s) => s.sort_order)) + 1 : 0;
      const { data, error } = await supabase.from("sermons").insert({ ...payload, sort_order: next_order }).select().single();
      if (error) { setErr(error.message); return; }
      await logAudit(supabase, "insert", "sermons", data.id, { title: v.title });
    }
    reset({ is_featured: false, published_at: new Date().toISOString().slice(0, 10) });
    setChurchId("");
    qc.invalidateQueries({ queryKey: ["sermons"] });
    qc.invalidateQueries({ queryKey: ["public-sermons"] });
  }
  async function remove(id: string, title: string) {
    if (!confirm("Remover esta pregação?")) return;
    const { error } = await supabase.from("sermons").delete().eq("id", id);
    if (!error) {
      await logAudit(supabase, "delete", "sermons", id, { title });
      qc.invalidateQueries({ queryKey: ["sermons"] });
      qc.invalidateQueries({ queryKey: ["public-sermons"] });
    }
  }
  async function move(s: Sermon, sortedList: Sermon[], dir: "up" | "down") {
    const idx = sortedList.findIndex((x) => x.id === s.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedList.length) return;
    const a = sortedList[idx], b = sortedList[swapIdx];
    const { error: e1 } = await supabase.from("sermons").update({ sort_order: b.sort_order }).eq("id", a.id);
    const { error: e2 } = await supabase.from("sermons").update({ sort_order: a.sort_order }).eq("id", b.id);
    if (!e1 && !e2) {
      qc.invalidateQueries({ queryKey: ["sermons"] });
      qc.invalidateQueries({ queryKey: ["public-sermons"] });
    }
  }

  const sorted = [...sermons].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{editing ? "Editar pregação" : "Adicionar pregação (YouTube)"}</CardTitle>
            {editing && <Button onClick={cancelEdit} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Cancelar</Button>}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="Título" error={errors.title?.message}><Input {...register("title")} placeholder="Ex: O Bezerro de Ouro" /></Field>
            <Field label="Link do YouTube" error={errors.youtube_url?.message}><Input {...register("youtube_url")} placeholder="https://youtube.com/watch?v=..." /></Field>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Referência"><Input {...register("reference")} placeholder="Ex 32:1-14" /></Field>
              <Field label="Pregador"><Input {...register("speaker")} placeholder="Pra. Anne" /></Field>
              <Field label="Categoria"><Input {...register("category")} placeholder="Série" /></Field>
              <Field label="Duração"><Input {...register("duration")} placeholder="Ex: 42:15" /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data da pregação"><Input type="date" {...register("published_at")} /></Field>
              <Field label="Igreja">
                <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Todas / Nacional —</option>
                  {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Tema / Descrição (aparece pro usuário)">
              <textarea {...register("description")} rows={3} className="w-full rounded-md border bg-background p-3 text-sm" placeholder="Contexto, tema, resumo da mensagem…" />
            </Field>
            <Field label="Link do PDF da palavra (opcional)"><Input {...register("pdf_url")} placeholder="https://..." /></Field>
            {urlWatch && youtubeThumb(urlWatch) && <img src={youtubeThumb(urlWatch)!} alt="" className="h-24 rounded-md border" />}
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={isSubmitting} className="gap-2"><Plus className="h-4 w-4" /> {editing ? "Salvar alterações" : "Adicionar pregação"}</Button>
          </form>
        </CardContent>
      </Card>
      <h3 className="font-display text-lg text-navy">Pregações publicadas ({sermons.length})</h3>
      <div className="space-y-3">
        {sorted.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => move(s, sorted, "up")} disabled={idx === 0} className="text-muted-foreground hover:text-navy disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
              <button onClick={() => move(s, sorted, "down")} disabled={idx === sorted.length - 1} className="text-muted-foreground hover:text-navy disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
            </div>
            <img src={s.thumbnail_url || youtubeThumb(s.youtube_url) || ""} alt="" className="h-14 w-24 rounded object-cover" />
            <div className="flex-1">
              <b className="text-navy">{s.title}</b>
              <p className="text-xs text-muted">{[s.reference, s.speaker, s.category, churches.find((c) => c.id === s.church_id)?.name].filter(Boolean).join(" · ")}</p>
              <p className="text-[11px] text-muted-foreground">Pregado em {new Date(s.published_at).toLocaleDateString("pt-BR")}</p>
            </div>
            <Button asChild variant="outline" size="sm"><a href={s.youtube_url} target="_blank" rel="noreferrer">Abrir</a></Button>
            {s.pdf_url && (
              <Button asChild variant="outline" size="sm" title="Baixar PDF da palavra"><a href={s.pdf_url} target="_blank" rel="noreferrer"><FileDown className="h-3.5 w-3.5" /></a></Button>
            )}
            <Button onClick={() => startEdit(s)} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
            <Button onClick={() => remove(s.id, s.title)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsAdmin() {
  const { data: events = [] } = useEvents();
  const { data: churchesList = [] } = useChurches();
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [churchId, setChurchId] = useState<string>("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<EventInput>({ resolver: zodResolver(eventSchema), defaultValues: { status: "abertas", event_type: "outro" } });

  async function onSubmit(v: EventInput) {
    setErr("");
    const { data, error } = await supabase.from("events").insert({
      title: v.title, starts_at: new Date(v.starts_at).toISOString(),
      location: v.location || null, status: v.status, event_type: v.event_type,
      registration_url: v.registration_url || null,
      church_id: churchId || null,
    }).select().single();
    if (error) { setErr(error.message); return; }
    await logAudit(supabase, "insert", "events", data.id, { title: v.title });
    reset();
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["public-events"] });
  }
  async function remove(id: string, title: string) {
    if (!confirm("Remover este evento?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (!error) {
      await logAudit(supabase, "delete", "events", id, { title });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["public-events"] });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Adicionar evento</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="Para qual comunidade?">
              <select value={churchId} onChange={(e) => setChurchId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Global (todas as comunidades) —</option>
                {churchesList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Título" error={errors.title?.message}><Input {...register("title")} placeholder="Ex: Curso de Noivos" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data e hora" error={errors.starts_at?.message}><Input type="datetime-local" {...register("starts_at")} /></Field>
              <Field label="Local"><Input {...register("location")} placeholder="Templo Sede" /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo">
                <select {...register("event_type")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="culto">Culto</option>
                  <option value="congresso">Congresso</option>
                  <option value="conferencia">Conferência</option>
                  <option value="encontro">Encontro</option>
                  <option value="ebd">Escola Bíblica</option>
                  <option value="outro">Outro</option>
                </select>
              </Field>
              <Field label="Status">
                <select {...register("status")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="abertas">Inscrições abertas</option>
                  <option value="encerradas">Encerradas</option>
                  <option value="esgotado">Esgotado</option>
                  <option value="em_breve">Em breve</option>
                </select>
              </Field>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={isSubmitting} className="gap-2"><Plus className="h-4 w-4" /> Adicionar evento</Button>
          </form>
        </CardContent>
      </Card>
      <h3 className="font-display text-lg text-navy">Próximos eventos ({events.length})</h3>
      <div className="space-y-3">
        {events.map((ev) => (
          <div key={ev.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <div className="flex-1">
              <b className="text-navy">{ev.title}</b>
              <p className="text-xs text-muted">{new Date(ev.starts_at).toLocaleString("pt-BR")}{ev.location ? ` · ${ev.location}` : ""}</p>
            </div>
            <span className="rounded-full border border-gold px-2 py-1 text-[11px] font-bold text-gold">{ev.status}</span>
            <Button onClick={() => remove(ev.id, ev.title)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// MdaStructure() antiga (somente-leitura) foi removida — substituída pelo componente
// MdaStructureAdmin (CRUD completo), importado de "./MdaStructureAdmin".

// AuditView foi extraído para AuditAdmin.tsx (reutilizado também em /governanca).
function AuditView() {
  return <AuditAdmin />;
}

function ServiceTimesAdmin() {
  const { data: churches = [] } = useChurches();
  const { data: services = [] } = useAllServiceTimes();
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const sede = churches.find((c) => c.type === "sede") ?? churches[0] ?? null;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<ServiceTimeInput>({
      resolver: zodResolver(serviceTimeSchema),
      defaultValues: { church_id: sede?.id, weekday: "domingo", sort_order: 0 },
    });

  async function onSubmit(v: ServiceTimeInput) {
    setErr("");
    const { data, error } = await supabase.from("church_info").insert({
      church_id: v.church_id, weekday: v.weekday, time: v.time,
      description: v.description || null, sort_order: v.sort_order, is_active: true,
    }).select().single();
    if (error) { setErr(error.message); return; }
    await logAudit(supabase, "insert", "church_info", data.id, { description: v.description });
    reset({ church_id: sede?.id, weekday: "domingo", sort_order: 0 });
    qc.invalidateQueries({ queryKey: ["service-times-all"] });
    qc.invalidateQueries({ queryKey: ["service-times", v.church_id] });
  }
  async function remove(id: string) {
    if (!confirm("Remover este culto?")) return;
    const { error } = await supabase.from("church_info").delete().eq("id", id);
    if (!error) {
      await logAudit(supabase, "delete", "church_info", id);
      qc.invalidateQueries({ queryKey: ["service-times-all"] });
    }
  }

  const WEEKDAY_OPTS = [
    ["domingo","Domingo"],["segunda","Segunda"],["terca","Terça"],
    ["quarta","Quarta"],["quinta","Quinta"],["sexta","Sexta"],["sabado","Sábado"],
  ] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar horário de culto</CardTitle>
          <CardDescription>Cultos cadastrados aqui aparecem na aba "Cultos" da página pública.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="Igreja" error={errors.church_id?.message}>
              <select {...register("church_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Dia da semana" error={errors.weekday?.message}>
                <select {...register("weekday")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {WEEKDAY_OPTS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Hora (HH:MM)" error={errors.time?.message}><Input type="time" {...register("time")} /></Field>
            </div>
            <Field label="Descrição" error={errors.description?.message}>
              <Input {...register("description")} placeholder="Ex: Culto da manhã" />
            </Field>
            <Field label="Ordem (menor aparece primeiro)" error={errors.sort_order?.message}>
              <Input type="number" min="0" {...register("sort_order")} />
            </Field>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={isSubmitting} className="gap-2"><Plus className="h-4 w-4" /> Adicionar culto</Button>
          </form>
        </CardContent>
      </Card>
      <h3 className="font-display text-lg text-navy">Cultos cadastrados ({services.length})</h3>
      <div className="space-y-2">
        {services.length === 0 && <p className="text-sm italic text-muted">Nenhum culto cadastrado. A página pública usará os horários padrão.</p>}
        {services.map((s) => {
          const church = churches.find((c) => c.id === s.church_id);
          return (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <div className="text-center">
                <b className="block font-display text-lg text-navy">{s.time.slice(0,5)}</b>
                <span className="text-[10px] font-bold uppercase text-muted">{s.weekday}</span>
              </div>
              <div className="flex-1 border-l border-border pl-3">
                <b className="text-navy">{s.description ?? "Culto"}</b>
                <p className="text-xs text-muted">{church?.name ?? "Igreja"}</p>
              </div>
              <Button onClick={() => remove(s.id)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DailyWordsAdmin() {
  const { data: words = [] } = useDailyWords();
  const { data: dwChurches = [] } = useChurches();
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [churchId, setChurchId] = useState<string>("");
  const today = new Date().toISOString().slice(0,10);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<DailyWordInput>({
      resolver: zodResolver(dailyWordSchema),
      defaultValues: { date: today, title: "Palavra do dia" },
    });

  async function onSubmit(v: DailyWordInput) {
    setErr("");
    const { data, error } = await supabase.from("daily_words").insert({
      date: v.date, title: v.title,
      verse_ref: v.verse_ref || null, verse_text: v.verse_text || null,
      reflection: v.reflection || null,
      prayer: v.prayer || null,
      is_active: true,
      church_id: churchId || null,
    }).select().single();
    if (error) { setErr(error.message); return; }
    await logAudit(supabase, "insert", "daily_words", data.id, { title: v.title });
    reset({ date: today, title: "Palavra do dia" });
    qc.invalidateQueries({ queryKey: ["daily-words"] });
    qc.invalidateQueries({ queryKey: ["todays-word"] });
  }
  async function remove(id: string, title: string) {
    if (!confirm("Remover esta palavra?")) return;
    const { error } = await supabase.from("daily_words").delete().eq("id", id);
    if (!error) {
      await logAudit(supabase, "delete", "daily_words", id, { title });
      qc.invalidateQueries({ queryKey: ["daily-words"] });
      qc.invalidateQueries({ queryKey: ["todays-word"] });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar Palavra do dia</CardTitle>
          <CardDescription>A palavra mais recente (com data ≤ hoje) aparece na página pública.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="Para qual comunidade?">
              <select value={churchId} onChange={(e) => setChurchId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Global (todas as comunidades) —</option>
                {dwChurches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data" error={errors.date?.message}><Input type="date" {...register("date")} /></Field>
              <Field label="Título" error={errors.title?.message}><Input {...register("title")} placeholder="Palavra do dia" /></Field>
            </div>
            <Field label="Referência bíblica" error={errors.verse_ref?.message}>
              <Input {...register("verse_ref")} placeholder="Ex: Salmos 23:1" />
            </Field>
            <Field label="Texto do versículo" error={errors.verse_text?.message}>
              <textarea {...register("verse_text")} rows={2} className="w-full rounded-md border bg-background p-3 text-sm" placeholder="Texto bíblico" />
            </Field>
            <Field label="Reflexão" error={errors.reflection?.message}>
              <textarea {...register("reflection")} rows={3} className="w-full rounded-md border bg-background p-3 text-sm" placeholder="Reflexão pastoral" />
            </Field>
            <Field label="Oração" error={errors.prayer?.message}>
              <textarea {...register("prayer")} rows={3} className="w-full rounded-md border bg-background p-3 text-sm" placeholder="Oração inspirada no texto (opcional)" />
            </Field>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={isSubmitting} className="gap-2"><Plus className="h-4 w-4" /> Cadastrar palavra</Button>
          </form>
        </CardContent>
      </Card>
      <h3 className="font-display text-lg text-navy">Palavras cadastradas ({words.length})</h3>
      <div className="space-y-2">
        {words.length === 0 && <p className="text-sm italic text-muted">Nenhuma palavra cadastrada. A página pública usará o conteúdo padrão.</p>}
        {words.map((w) => (
          <div key={w.id} className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <div className="text-center">
              <b className="block font-display text-sm text-gold">{new Date(w.date).toLocaleDateString("pt-BR", {day:"2-digit",month:"short"}).replace(".","")}</b>
            </div>
            <div className="flex-1 border-l border-border pl-3">
              <b className="text-navy">{w.title}</b>
              {w.verse_ref && <p className="text-xs font-semibold text-gold">{w.verse_ref}</p>}
              {w.verse_text && <p className="mt-1 font-display italic text-sm text-ink">"{w.verse_text}"</p>}
              {w.reflection && <p className="mt-1 text-xs text-muted">{w.reflection}</p>}
              {w.prayer && <p className="mt-1 rounded bg-gold/5 p-2 text-xs italic text-ink">🙏 {w.prayer}</p>}
            </div>
            <Button onClick={() => remove(w.id, w.title)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function MdaCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <p className="font-display text-2xl font-semibold text-gold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
