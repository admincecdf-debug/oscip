"use client";
import { useState } from "react";
import { Activity, TrendingUp, TrendingDown, Minus, Users, Calendar, Heart, Sparkles, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAllLgIndicators, useChurches } from "@/hooks/use-queries";
import type { LgIndicators } from "@/types/domain";

type SortKey = "name" | "members" | "growth" | "discipleship" | "multiplication" | "consistency";

export function HealthAdmin() {
  const [churchFilter, setChurchFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);

  const { data: indicators = [], isLoading } = useAllLgIndicators(churchFilter || null);
  const { data: churches = [] } = useChurches();
  const churchMap = new Map(churches.map((c) => [c.id, c]));

  const sorted = [...indicators].sort((a, b) => {
    const f = sortDesc ? -1 : 1;
    switch (sortBy) {
      case "name":           return f * ((a.life_group_name ?? "").localeCompare(b.life_group_name ?? ""));
      case "members":        return f * (a.members_now - b.members_now);
      case "growth":         return f * (a.growth_30d_pct - b.growth_30d_pct);
      case "discipleship":   return f * (a.discipleship_rate_pct - b.discipleship_rate_pct);
      case "multiplication": return f * (a.multiplication_pct - b.multiplication_pct);
      case "consistency":    return f * (a.report_consistency_pct - b.report_consistency_pct);
    }
  });

  function toggleSort(k: SortKey) {
    if (sortBy === k) setSortDesc((d) => !d);
    else { setSortBy(k); setSortDesc(true); }
  }

  // resumo da rede
  const total = indicators.reduce(
    (a, i) => ({
      lgs: a.lgs + 1,
      members: a.members + i.members_now,
      converts: a.converts + i.new_converts_90d,
      decisions: a.decisions + i.decisions_90d,
    }),
    { lgs: 0, members: 0, converts: 0, decisions: 0 }
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-gold" />Painel de Saúde
          </CardTitle>
          <CardDescription>
            Indicadores objetivos calculados em tempo real a partir dos relatórios semanais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {churches.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted">Comunidade</Label>
              <select value={churchFilter} onChange={(e) => setChurchFilter(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:w-72">
                <option value="">Todas as comunidades</option>
                {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Resumo da rede */}
          <div className="grid gap-2 sm:grid-cols-4">
            <Stat icon={Users}    label="Life Groups ativos"  value={total.lgs} />
            <Stat icon={Heart}    label="Membros ativos"       value={total.members} />
            <Stat icon={Sparkles} label="Novos convertidos 90d" value={total.converts} />
            <Stat icon={Building2} label="Decisões 90d"        value={total.decisions} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indicadores por Life Group ({sorted.length})</CardTitle>
          <CardDescription>Clique nos cabeçalhos para ordenar</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading && <p className="px-6 text-sm italic text-muted">Calculando indicadores…</p>}
          {!isLoading && sorted.length === 0 && (
            <p className="px-6 text-sm italic text-muted">Nenhum Life Group ativo nesta seleção.</p>
          )}
          {sorted.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs">
                <thead>
                  <tr className="border-b bg-navy-50 text-navy">
                    <Th onClick={() => toggleSort("name")}           label="Life Group"          active={sortBy === "name"}           desc={sortDesc} />
                    <Th label="Comunidade" />
                    <Th onClick={() => toggleSort("members")}        label="Membros ativos"      active={sortBy === "members"}        desc={sortDesc} align="right" />
                    <Th onClick={() => toggleSort("growth")}         label="Cresc. 30d"          active={sortBy === "growth"}         desc={sortDesc} align="right" />
                    <Th label="Frequência média" align="right" />
                    <Th label="Visitantes / sem" align="right" />
                    <Th onClick={() => toggleSort("discipleship")}   label="% discipulado"       active={sortBy === "discipleship"}   desc={sortDesc} align="right" />
                    <Th label="Convertidos 90d" align="right" />
                    <Th onClick={() => toggleSort("multiplication")} label="% multiplicação"     active={sortBy === "multiplication"} desc={sortDesc} align="right" />
                    <Th onClick={() => toggleSort("consistency")}    label="Consistência relatos" active={sortBy === "consistency"}    desc={sortDesc} align="right" />
                    <Th label="Último relato" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((i) => (
                    <tr key={i.life_group_id} className="border-b hover:bg-navy-50/30">
                      <Td><b className="text-navy">{i.life_group_name ?? "—"}</b></Td>
                      <Td>{i.church_id ? churchMap.get(i.church_id)?.name ?? "—" : "—"}</Td>
                      <Td align="right">{i.members_now}</Td>
                      <Td align="right"><GrowthCell pct={i.growth_30d_pct} /></Td>
                      <Td align="right">{i.attendance_avg_last_4.toFixed(1)}</Td>
                      <Td align="right">{i.visitors_avg_last_4.toFixed(1)}</Td>
                      <Td align="right"><PercentCell pct={i.discipleship_rate_pct} /></Td>
                      <Td align="right">{i.new_converts_90d}</Td>
                      <Td align="right"><PercentCell pct={i.multiplication_pct} /></Td>
                      <Td align="right"><PercentCell pct={i.report_consistency_pct} /></Td>
                      <Td>{i.last_report_date ? new Date(i.last_report_date).toLocaleDateString("pt-BR") : <span className="italic text-muted">nunca</span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] italic text-muted">
        Indicadores calculados em tempo real a partir dos dados existentes. A classificação automática
        de saúde (🟢 / 🟡 / 🔴) será adicionada na próxima sessão (IA-2).
      </p>
    </div>
  );
}

function Stat({ icon: Ico, label, value }: { icon: React.ComponentType<{className?: string}>; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2">
        <Ico className="h-4 w-4 text-gold" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      </div>
      <p className="mt-1 font-display text-2xl text-navy">{value}</p>
    </div>
  );
}

function Th({ label, onClick, active, desc, align }: { label: string; onClick?: () => void; active?: boolean; desc?: boolean; align?: "left" | "right" }) {
  const a = align === "right" ? "text-right" : "text-left";
  return (
    <th className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${a} ${onClick ? "cursor-pointer hover:bg-navy/10" : ""}`} onClick={onClick}>
      {label}{active && (desc ? " ▾" : " ▴")}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  const a = align === "right" ? "text-right" : "text-left";
  return <td className={`px-3 py-2 ${a}`}>{children}</td>;
}

function GrowthCell({ pct }: { pct: number }) {
  const Ico = pct > 1 ? TrendingUp : pct < -1 ? TrendingDown : Minus;
  const cls = pct > 1 ? "text-green-700" : pct < -1 ? "text-red-700" : "text-muted";
  return (
    <span className={`inline-flex items-center gap-1 font-mono font-bold ${cls}`}>
      <Ico className="h-3 w-3" />{pct > 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function PercentCell({ pct }: { pct: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono">
      <span className="text-navy font-bold">{pct.toFixed(0)}%</span>
      <span className="inline-block h-1.5 w-10 overflow-hidden rounded-full bg-border">
        <span className="block h-full rounded-full bg-gold" style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
    </span>
  );
}
