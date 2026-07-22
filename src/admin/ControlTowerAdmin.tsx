"use client";
import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle, ShieldAlert, Bell, Radio, RefreshCw,
  ChevronRight, Clock, Church, Users, FileX, Heart,
  Target, TrendingDown, CheckCircle2, CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useControlTowerAlerts, useControlTowerSummary, useChurches } from "@/hooks/use-queries";
import type { ControlTowerAlert, AlertType, AlertSeverity } from "@/types/domain";
import type { TabKey } from "./AdminSidebar";

// ── Pra onde cada tipo de alerta leva ao clicar (resolver, não só olhar) ──
const ALERT_TARGET_TAB: Record<AlertType, TabKey> = {
  sem_relatorio:     "weekly",
  oracao_urgente:    "prayer-requests",
  visita_pastoral:   "visit-requests",
  score_critico:     "score",
  sem_membros:       "members",
  meta_atrasada:     "metas",
  relmda_atrasado:   "relmda-supervisao",
};

// ── Config visual por tipo de alerta ─────────────────────────
const ALERT_CONFIG: Record<AlertType, {
  icon: React.ReactNode; color: string; bg: string; border: string; label: string;
}> = {
  sem_relatorio: {
    icon: <FileX className="h-4 w-4" />,
    color: "text-red-700", bg: "bg-red-50", border: "border-red-300",
    label: "Sem Relatório",
  },
  oracao_urgente: {
    icon: <Heart className="h-4 w-4" />,
    color: "text-red-700", bg: "bg-red-50", border: "border-red-300",
    label: "Oração Urgente",
  },
  visita_pastoral: {
    icon: <Church className="h-4 w-4" />,
    color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300",
    label: "Visita Pastoral",
  },
  score_critico: {
    icon: <TrendingDown className="h-4 w-4" />,
    color: "text-red-700", bg: "bg-red-50", border: "border-red-300",
    label: "Score Crítico",
  },
  sem_membros: {
    icon: <Users className="h-4 w-4" />,
    color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300",
    label: "Sem Membros",
  },
  meta_atrasada: {
    icon: <Target className="h-4 w-4" />,
    color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300",
    label: "Meta Atrasada",
  },
  relmda_atrasado: {
    icon: <CalendarDays className="h-4 w-4" />,
    color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300",
    label: "RELMDA Atrasado",
  },
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critico: "🔴 Crítico",
  atencao: "🟡 Atenção",
};

// ── Card de alerta individual ─────────────────────────────────
function AlertCard({ alert, onNavigate }: { alert: ControlTowerAlert; onNavigate?: (tab: TabKey) => void }) {
  const cfg = ALERT_CONFIG[alert.alert_type];
  const targetTab = ALERT_TARGET_TAB[alert.alert_type];
  const clickable = !!onNavigate && !!targetTab;

  return (
    <div
      onClick={clickable ? () => onNavigate(targetTab) : undefined}
      className={`flex items-start gap-3 rounded-lg border p-3 ${cfg.bg} ${cfg.border} ${clickable ? "transition hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""}`}
    >
      <div className={`mt-0.5 shrink-0 ${cfg.color}`}>{cfg.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold text-sm ${cfg.color}`}>{alert.lg_name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
            {cfg.label}
          </span>
          {alert.severity === "critico" && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-600 text-white font-bold">CRÍTICO</span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${cfg.color} opacity-80`}>{alert.detail}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {alert.church_name && alert.church_name !== "Nacional" && (
            alert.church_id ? (
              <Link href={`/organizacional/comunidades/${alert.church_id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 underline-offset-2 hover:underline">
                <Church className="h-3 w-3" />{alert.church_name}
              </Link>
            ) : (
              <span className="flex items-center gap-1"><Church className="h-3 w-3" />{alert.church_name}</span>
            )
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(alert.alert_date).toLocaleDateString("pt-BR")}
          </span>
        </div>
      </div>
      {clickable && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
    </div>
  );
}

// ── Painel de KPIs no topo ────────────────────────────────────
function TowerKpis({ onFilter }: { onFilter: (type: AlertType | "") => void }) {
  const { data: summary, isLoading, refetch } = useControlTowerSummary();

  if (isLoading) return <p className="py-4 text-center text-sm text-muted-foreground">Verificando alertas…</p>;
  if (!summary) return null;

  const allClear = summary.total_alertas === 0;

  return (
    <div className="space-y-4">
      {/* Status geral */}
      <div className={`flex items-center gap-3 rounded-xl p-4 ${allClear ? "bg-green-50 border border-green-200" : summary.total_criticos > 0 ? "bg-red-50 border border-red-200" : "bg-yellow-50 border border-yellow-200"}`}>
        <div className={`h-3 w-3 rounded-full animate-pulse ${allClear ? "bg-green-500" : summary.total_criticos > 0 ? "bg-red-500" : "bg-yellow-400"}`} />
        <div className="flex-1">
          <p className={`font-bold text-sm ${allClear ? "text-green-800" : summary.total_criticos > 0 ? "text-red-800" : "text-yellow-800"}`}>
            {allClear
              ? "✅ Sistema operando normalmente — nenhum alerta ativo"
              : summary.total_criticos > 0
                ? `🚨 ${summary.total_criticos} alerta(s) crítico(s) requer(em) ação imediata`
                : `⚠️ ${summary.total_atencao} alerta(s) de atenção`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {summary.lgs_afetados} LG(s) afetado(s) · {summary.igrejas_afetadas} comunidade(s) · Atualizado agora
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} className="shrink-0">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* KPI cards clicáveis */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { type: "sem_relatorio" as AlertType,  label: "Sem Relatório",   value: summary.alertas_sem_relatorio,  icon: <FileX className="h-4 w-4" />,       color: "border-l-red-500",    text: "text-red-700"    },
          { type: "oracao_urgente" as AlertType, label: "Oração Urgente",  value: summary.alertas_oracao_urgente,  icon: <Heart className="h-4 w-4" />,        color: "border-l-red-400",    text: "text-red-600"    },
          { type: "visita_pastoral" as AlertType,label: "Visita Pastoral", value: summary.alertas_visita_pastoral, icon: <Church className="h-4 w-4" />,       color: "border-l-yellow-400", text: "text-yellow-700" },
          { type: "score_critico" as AlertType,  label: "Score Crítico",   value: summary.alertas_score_critico,   icon: <TrendingDown className="h-4 w-4" />, color: "border-l-red-500",    text: "text-red-700"    },
          { type: "sem_membros" as AlertType,    label: "Sem Membros",     value: summary.alertas_sem_membros,     icon: <Users className="h-4 w-4" />,        color: "border-l-yellow-500", text: "text-yellow-700" },
          { type: "meta_atrasada" as AlertType,  label: "Meta Atrasada",   value: summary.alertas_meta_atrasada,   icon: <Target className="h-4 w-4" />,       color: "border-l-yellow-400", text: "text-yellow-700" },
          { type: "relmda_atrasado" as AlertType, label: "RELMDA Atrasado", value: summary.alertas_relmda_atrasado, icon: <CalendarDays className="h-4 w-4" />, color: "border-l-yellow-400", text: "text-yellow-700" },
        ].map(k => (
          <button
            key={k.type}
            onClick={() => onFilter(k.value > 0 ? k.type : "")}
            className={`text-left rounded-lg border-l-4 bg-white border border-l-inherit shadow-sm hover:shadow-md transition-shadow p-3 ${k.color} ${k.value === 0 ? "opacity-40" : ""}`}
          >
            <div className={`${k.text}`}>{k.icon}</div>
            <p className="mt-1 text-lg font-bold text-[#0E2A47]">{k.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{k.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Lista de alertas filtrada ─────────────────────────────────
function AlertsList({ churchFilter, typeFilter, severityFilter, onNavigate }: {
  churchFilter: string;
  typeFilter: AlertType | "";
  severityFilter: AlertSeverity | "";
  onNavigate?: (tab: TabKey) => void;
}) {
  const { data: alerts = [], isLoading } = useControlTowerAlerts({
    churchId: churchFilter || undefined,
    alertType: typeFilter || undefined,
    severity: severityFilter || undefined,
  });

  const criticos = alerts.filter(a => a.severity === "critico");
  const atencao  = alerts.filter(a => a.severity === "atencao");

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando alertas…</p>;

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="font-semibold text-[#0E2A47]">Nenhum alerta encontrado</p>
        <p className="text-sm text-muted-foreground">
          {typeFilter || severityFilter || churchFilter
            ? "Nenhum alerta para os filtros selecionados."
            : "Todos os sistemas operando normalmente."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Críticos */}
      {criticos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <h3 className="font-bold text-sm text-red-700">CRÍTICOS ({criticos.length}) — Ação imediata</h3>
          </div>
          {criticos.map((a, i) => <AlertCard key={i} alert={a} onNavigate={onNavigate} />)}
        </div>
      )}

      {/* Atenção */}
      {atencao.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <h3 className="font-bold text-sm text-yellow-700">ATENÇÃO ({atencao.length}) — Monitorar</h3>
          </div>
          {atencao.map((a, i) => <AlertCard key={i} alert={a} onNavigate={onNavigate} />)}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MASTER — ControlTowerAdmin
// ══════════════════════════════════════════════════════════════
export function ControlTowerAdmin({ onNavigate }: { onNavigate?: (tab: TabKey) => void }) {
  const { data: churches = [] } = useChurches();
  const [churchFilter,   setChurchFilter]   = useState("");
  const [typeFilter,     setTypeFilter]     = useState<AlertType | "">("");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "">("");

  const TYPE_OPTIONS: { value: AlertType | ""; label: string }[] = [
    { value: "",                label: "Todos os tipos"     },
    { value: "sem_relatorio",   label: "📋 Sem Relatório"   },
    { value: "oracao_urgente",  label: "🆘 Oração Urgente"  },
    { value: "visita_pastoral", label: "🏠 Visita Pastoral"  },
    { value: "score_critico",   label: "🔴 Score Crítico"    },
    { value: "sem_membros",     label: "👥 Sem Membros"      },
    { value: "meta_atrasada",   label: "🎯 Meta Atrasada"    },
    { value: "relmda_atrasado", label: "🗓️ RELMDA Atrasado"  },
  ];

  return (
    <div className="space-y-5 p-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <Radio className="h-6 w-6 text-red-500 animate-pulse" />
        <div>
          <h2 className="text-xl font-bold text-[#0E2A47]">Torre de Controle</h2>
          <p className="text-xs text-muted-foreground">Monitoramento em tempo real · Alertas atualizados a cada minuto</p>
        </div>
      </div>

      {/* KPIs + status geral */}
      <TowerKpis onFilter={setTypeFilter} />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Comunidade</p>
          <Select value={churchFilter} onValueChange={setChurchFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as comunidades</SelectItem>
              {churches.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Tipo</p>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as AlertType | "")}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Severidade</p>
          <Select value={severityFilter} onValueChange={v => setSeverityFilter(v as AlertSeverity | "")}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="critico">🔴 Crítico</SelectItem>
              <SelectItem value="atencao">🟡 Atenção</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(typeFilter || severityFilter || churchFilter) && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground"
            onClick={() => { setTypeFilter(""); setSeverityFilter(""); setChurchFilter(""); }}>
            Limpar filtros ✕
          </Button>
        )}
      </div>

      {/* Lista de alertas */}
      <AlertsList
        churchFilter={churchFilter}
        typeFilter={typeFilter}
        severityFilter={severityFilter}
        onNavigate={onNavigate}
      />
    </div>
  );
}
