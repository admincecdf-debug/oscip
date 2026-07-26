"use client";
import { useState, useMemo } from "react";
import {
  Activity, Users, Calendar, AlertTriangle, Sparkles, Heart, TrendingUp, Award,
  CircleDot, Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useScopeMetrics, useLgsWithHealth, useChurches } from "@/hooks/use-queries";
import type { MdaHealth } from "@/types/domain";

const HEALTH_CFG: Record<MdaHealth, { label: string; cls: string; emoji: string; bar: string }> = {
  saudavel:              { label: "Saudável",              cls: "bg-green-50 text-green-700 border-green-200",   emoji: "🟢", bar: "bg-green-500" },
  atencao:               { label: "Atenção",               cls: "bg-yellow-50 text-yellow-700 border-yellow-200", emoji: "🟡", bar: "bg-yellow-500" },
  necessita_intervencao: { label: "Necessita Intervenção", cls: "bg-red-50 text-red-700 border-red-200",         emoji: "🔴", bar: "bg-red-500" },
};

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo", em_formacao: "Em Formação",
  em_multiplicacao: "Em Multiplicação", multiplicado: "Multiplicado", encerrado: "Encerrado",
};

export function SupervisionDashboard() {
  const { data: churches = [] } = useChurches();

  type Scope = { level: "national" | "church_tree" | "church"; id?: string | null; label: string };

  // Constrói opções: Nacional + cada Sede (árvore) + cada igreja específica
  const scopeOptions = useMemo<Scope[]>(() => {
    const opts: Scope[] = [{ level: "national", label: "🇧🇷 Rede Nacional CEC Brasil" }];
    const sedes = churches.filter(c => c.type === "sede");
    sedes.forEach(s => {
      opts.push({ level: "church_tree", id: s.id, label: `🏛️ ${s.name} + descendentes` });
    });
    churches.forEach(c => {
      const prefix = c.type === "sede" ? "🏛️" : c.type === "nucleo" ? "🏘️" : "⛪";
      opts.push({ level: "church", id: c.id, label: `${prefix} ${c.name} (apenas)` });
    });
    return opts;
  }, [churches]);

  const [scopeKey, setScopeKey] = useState<string>("national");
  const currentScope = scopeOptions.find(o => makeKey(o) === scopeKey) ?? scopeOptions[0];

  const { data: metrics, isLoading: loadingMetrics } = useScopeMetrics(currentScope?.level ?? "national", currentScope?.id);
  const { data: lgs = [] } = useLgsWithHealth(currentScope?.level === "national" ? null : currentScope?.id);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-gold" />Supervisão hierárquica</CardTitle>
          <CardDescription>
            Visão consolidada da saúde organizacional por escopo. Classificação automática 🟢🟡🔴 baseada em
            relatórios dos últimos 30 dias, cobertura de liderança e ausência de evasão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted">Escopo de análise</Label>
          <select value={scopeKey} onChange={(e) => setScopeKey(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:max-w-md">
            {scopeOptions.map(o => (
              <option key={makeKey(o)} value={makeKey(o)}>{o.label}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {loadingMetrics ? (
        <p className="py-8 text-center text-sm italic text-muted">Calculando…</p>
      ) : !metrics ? (
        <Card><CardContent className="py-8 text-center text-sm italic text-muted">Sem dados para este escopo.</CardContent></Card>
      ) : (
        <>
          {/* Classificação grande */}
          <HealthHeader metrics={metrics} />

          {/* KPIs principais */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Kpi label="Life Groups ativos" value={`${metrics.active_lgs} / ${metrics.total_lgs}`} icon={<Building2 />} />
            <Kpi label="Membros ativos" value={metrics.members} icon={<Users />} />
            <Kpi label="Visitantes (30d)" value={metrics.visitors_30d} icon={<Sparkles />} accent="gold" />
            <Kpi label="Decisões (30d)" value={metrics.decisions_30d} icon={<Heart />} accent="red" />
          </div>

          {/* Cobertura e taxas */}
          <Card>
            <CardHeader><CardTitle className="text-base">Cobertura operacional</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Bar label="LGs que reportaram últimos 30 dias" pct={metrics.reporting_rate} count={`${metrics.reported_30d} / ${metrics.active_lgs}`} />
              <Bar label="LGs com líder definido" pct={metrics.leader_coverage} count={`${metrics.with_leader} / ${metrics.active_lgs}`} />
              {metrics.evasion_count > 0 && (
                <div className="rounded-md border-l-4 border-l-red-500 bg-red-50 p-3 text-sm">
                  <AlertTriangle className="mr-1 inline h-4 w-4 text-red-600" />
                  <b>{metrics.evasion_count}</b> membro(s) em risco de evasão neste escopo
                </div>
              )}
            </CardContent>
          </Card>

          {/* Distribuição por status */}
          <Card>
            <CardHeader><CardTitle className="text-base">Distribuição por status</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-3">
                <StatusCount label="Em Formação"      value={metrics.in_formation}  cls="bg-yellow-50 text-yellow-700 border-yellow-200" />
                <StatusCount label="Em Multiplicação" value={metrics.multiplicando} cls="bg-gold/15 text-gold border-gold/30" />
                <StatusCount label="Multiplicado"     value={metrics.multiplicado}  cls="bg-purple-50 text-purple-700 border-purple-200" />
              </div>
            </CardContent>
          </Card>

          {/* Lista de LGs com classificação individual */}
          {lgs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Life Groups no escopo ({lgs.length})</CardTitle>
                <CardDescription>Cada LG com sua classificação individual</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {lgs
                    .sort((a, b) => {
                      const o = (h: MdaHealth) => h === "necessita_intervencao" ? 0 : h === "atencao" ? 1 : 2;
                      return o(a.health_class) - o(b.health_class);
                    })
                    .map(lg => <LgRow key={lg.lg_id} lg={lg} />)}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function makeKey(o: { level: string; id?: string | null }) { return `${o.level}:${o.id ?? ""}`; }

function HealthHeader({ metrics }: { metrics: { health_class: MdaHealth; health_score: number } }) {
  const cfg = HEALTH_CFG[metrics.health_class];
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted">Classificação de saúde</p>
            <div className="mt-1 flex items-center gap-3">
              <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-base font-bold ${cfg.cls}`}>
                <span className="text-lg">{cfg.emoji}</span>{cfg.label}
              </span>
              <div className="text-3xl font-display text-navy">{metrics.health_score}<span className="text-base text-muted">/100</span></div>
            </div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
          <div className={`h-full transition-all ${cfg.bar}`} style={{ width: `${metrics.health_score}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, icon, accent }: { label: string; value: number | string; icon: React.ReactNode; accent?: "gold" | "red" }) {
  const cls = accent === "gold" ? "bg-gold/5 border-gold/30" : accent === "red" ? "bg-red-50 border-red-200" : "bg-card";
  return (
    <Card className={cls}>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2">
          <span className="text-gold [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
          <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
        </div>
        <p className="mt-1 font-display text-2xl text-navy">{value}</p>
      </CardContent>
    </Card>
  );
}

function Bar({ label, pct, count }: { label: string; pct: number; count: string }) {
  const cls = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-bold text-navy">{label}</span>
        <span className="font-mono text-muted">{count} · {pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-border">
        <div className={`h-full ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function StatusCount({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function LgRow({ lg }: { lg: { lg_name: string; status_lg: string; members_count: number; last_report_date: string | null; evasion_count: number; health_class: MdaHealth } }) {
  const cfg = HEALTH_CFG[lg.health_class];
  const daysSinceReport = lg.last_report_date
    ? Math.floor((Date.now() - new Date(lg.last_report_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="flex items-center gap-3 rounded-md border bg-card p-2.5">
      <CircleDot className={`h-5 w-5 shrink-0 ${
        lg.health_class === "saudavel" ? "text-green-600" :
        lg.health_class === "atencao" ? "text-yellow-600" : "text-red-600"
      }`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <b className="truncate text-sm text-navy">{lg.lg_name}</b>
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${cfg.cls}`}>
            {cfg.emoji} {cfg.label}
          </span>
          <span className="rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-semibold text-navy">
            {STATUS_LABELS[lg.status_lg] ?? lg.status_lg}
          </span>
        </div>
        <p className="text-[11px] text-muted">
          {lg.members_count} membro(s)
          {daysSinceReport !== null
            ? ` · último relato há ${daysSinceReport} dia(s)`
            : ` · nunca relatou`}
          {lg.evasion_count > 0 && ` · ${lg.evasion_count} em risco de evasão`}
        </p>
      </div>
    </div>
  );
}
