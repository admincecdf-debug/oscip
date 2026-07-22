"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRelmdaMonthlyComparison, useRelmdaSupervisorOverview } from "@/hooks/use-queries";
import type { RelmdaMonthlyComparisonRow } from "@/types/domain";

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

type IndicatorKey = "total_members" | "mda_count" | "visitantes_count" | "ge_count" | "offering_total" | "entrega";

const INDICATORS: { key: IndicatorKey; label: string; money?: boolean; percent?: boolean }[] = [
  { key: "total_members", label: "Membros" },
  { key: "mda_count", label: "MDA" },
  { key: "visitantes_count", label: "Visitantes" },
  { key: "ge_count", label: "GE" },
  { key: "offering_total", label: "Oferta total", money: true },
  { key: "entrega", label: "% de entrega", percent: true },
];

function valueOf(row: RelmdaMonthlyComparisonRow, key: IndicatorKey): number {
  if (key === "entrega") return row.esperados ? Math.round((row.enviados / row.esperados) * 100) : 0;
  return row[key] as number;
}

export function RelmdaDashboardAdmin() {
  const today = new Date();
  const [period, setPeriod] = useState({ month: today.getMonth() + 1, year: today.getFullYear() });
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const { data: rows = [], isLoading } = useRelmdaMonthlyComparison(period.month, period.year);
  const { data: weekRows = [], isLoading: loadingWeek } = useRelmdaSupervisorOverview(selectedWeek ?? 1, period.month, period.year);

  function shiftMonth(delta: number) {
    setPeriod((p) => {
      let month = p.month + delta; let year = p.year;
      if (month < 1) { month = 12; year -= 1; }
      if (month > 12) { month = 1; year += 1; }
      return { month, year };
    });
    setSelectedWeek(null);
  }

  const weeksWithData = rows.filter((r) => r.life_groups > 0 || r.esperados > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-navy">Dashboard e Comparativo Mensal</h2>
          <p className="text-sm text-muted-foreground">{MONTH_NAMES[period.month - 1]} de {period.year}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)} className="gap-1"><ChevronLeft className="h-4 w-4" />Mês anterior</Button>
          <Button variant="outline" size="sm" onClick={() => shiftMonth(1)} className="gap-1">Mês seguinte<ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && (
        <div className="grid gap-5 lg:grid-cols-2">
          {INDICATORS.map((ind) => (
            <IndicatorChart key={ind.key} indicator={ind} rows={rows} selectedWeek={selectedWeek} onSelectWeek={setSelectedWeek} />
          ))}
        </div>
      )}

      {rows.length > 0 && rows.every((r) => r.week_number !== 5 || r.esperados === 0) && (
        <p className="text-[11px] text-muted-foreground">A 5ª semana deste mês aparece zerada quando o mês não chega a ter uma 5ª semana de calendário — isso é esperado.</p>
      )}

      <div className="rounded-lg border">
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
          <BarChart3 className="h-4 w-4 text-gold" />
          <p className="text-xs font-bold uppercase tracking-widest text-navy-600">
            Life Groups da {selectedWeek ?? weeksWithData[0]?.week_number ?? 1}ª semana — clique numa barra acima pra trocar
          </p>
        </div>
        {loadingWeek && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
        {!loadingWeek && weekRows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum dado no seu escopo.</p>}
        {!loadingWeek && weekRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase text-muted-foreground">
                  <th className="px-3 py-1.5">Life Group</th><th>Líder</th><th>Igreja</th>
                  <th className="text-center">Membros</th><th className="text-center">MDA</th>
                  <th className="text-center">Visitantes</th><th className="text-center">Oferta</th><th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {weekRows.map((r) => (
                  <tr key={r.life_group_id} className="border-b border-dashed">
                    <td className="px-3 py-1.5 font-medium text-navy">{r.life_group_name}</td>
                    <td className="text-muted-foreground">{r.leader_name ?? "—"}</td>
                    <td className="text-muted-foreground">{r.church_name ?? "—"}</td>
                    <td className="text-center">{r.total_members}</td>
                    <td className="text-center">{r.mda_count}</td>
                    <td className="text-center">{r.visitantes_count}</td>
                    <td className="text-center">R$ {r.offering_total.toFixed(2).replace(".", ",")}</td>
                    <td className="text-center">{!r.report_id ? "Pendente" : r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function IndicatorChart({
  indicator, rows, selectedWeek, onSelectWeek,
}: { indicator: typeof INDICATORS[number]; rows: RelmdaMonthlyComparisonRow[]; selectedWeek: number | null; onSelectWeek: (w: number) => void }) {
  const values = rows.map((r) => valueOf(r, indicator.key));
  const max = Math.max(1, ...values);

  function format(v: number): string {
    if (indicator.money) return `R$ ${v.toFixed(2).replace(".", ",")}`;
    if (indicator.percent) return `${v}%`;
    return `${v}`;
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-navy-600">{indicator.label}</p>
      <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
        {rows.map((r) => {
          const v = valueOf(r, indicator.key);
          const h = Math.round((v / max) * 100);
          const active = selectedWeek === r.week_number;
          return (
            <button
              key={r.week_number}
              onClick={() => onSelectWeek(r.week_number)}
              className="flex flex-1 flex-col items-center justify-end gap-1 group"
              title={`${r.week_number}ª semana: ${format(v)}`}
            >
              <span className="text-[10px] font-bold text-navy opacity-0 transition-opacity group-hover:opacity-100">{format(v)}</span>
              <div
                className={`w-full rounded-t transition-all ${active ? "bg-gold" : "bg-navy/20 group-hover:bg-navy/40"}`}
                style={{ height: `${Math.max(4, h)}%` }}
              />
              <span className={`text-[10px] font-semibold ${active ? "text-gold" : "text-muted-foreground"}`}>{r.week_number}ª</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
