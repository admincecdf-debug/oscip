"use client";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Network, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRelmdaSupervisorOverview, useChurches, useSectors } from "@/hooks/use-queries";
import { exportToExcel, RELMDA_SECTOR_COLUMNS } from "@/lib/export";
import type { RelmdaSupervisorOverviewRow } from "@/types/domain";

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const SEM_SETOR = "__sem_setor__";

function weekNumberOfMonth(date: Date): number { return Math.min(5, Math.ceil(date.getDate() / 7)); }

interface SectorAgg {
  sectorId: string; sectorName: string;
  lifeGroups: number; membros: number; comDiscipulador: number; mda: number; ge: number;
  visitantes: number; ofertaTotal: number; kgAmor: number; tadel: number; emp: number;
  enviados: number; esperados: number;
  rows: RelmdaSupervisorOverviewRow[];
}

export function RelmdaConsolidacaoAdmin() {
  const today = new Date();
  const [period, setPeriod] = useState({ week: weekNumberOfMonth(today), month: today.getMonth() + 1, year: today.getFullYear() });
  const [openSector, setOpenSector] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useRelmdaSupervisorOverview(period.week, period.month, period.year);
  const { data: churches = [] } = useChurches();
  const { data: sectors = [] } = useSectors();

  function shiftWeek(delta: number) {
    setPeriod((p) => {
      let week = p.week + delta; let month = p.month; let year = p.year;
      if (week < 1) { week = 5; month -= 1; if (month < 1) { month = 12; year -= 1; } }
      if (week > 5) { week = 1; month += 1; if (month > 12) { month = 1; year += 1; } }
      return { week, month, year };
    });
  }

  const churchToSector = useMemo(() => {
    const map = new Map<string, { id: string; name: string } | null>();
    churches.forEach((c) => {
      const sec = c.sector_id ? sectors.find((s) => s.id === c.sector_id) : null;
      map.set(c.id, sec ? { id: sec.id, name: sec.name } : null);
    });
    return map;
  }, [churches, sectors]);

  const bySector = useMemo(() => {
    const agg = new Map<string, SectorAgg>();
    rows.forEach((r) => {
      const sec = r.church_id ? churchToSector.get(r.church_id) : null;
      const key = sec?.id ?? SEM_SETOR;
      const name = sec?.name ?? "Sem Setor definido / vínculo direto";
      if (!agg.has(key)) {
        agg.set(key, { sectorId: key, sectorName: name, lifeGroups: 0, membros: 0, comDiscipulador: 0, mda: 0, ge: 0, visitantes: 0, ofertaTotal: 0, kgAmor: 0, tadel: 0, emp: 0, enviados: 0, esperados: 0, rows: [] });
      }
      const a = agg.get(key) as SectorAgg;
      a.lifeGroups += 1;
      a.membros += r.total_members;
      a.mda += r.mda_count;
      a.ge += r.ge_count;
      a.visitantes += r.visitantes_count;
      a.ofertaTotal += r.offering_total;
      a.kgAmor += r.kg_amor;
      a.tadel += r.tadel_count;
      a.emp += r.emp_participants;
      a.esperados += 1;
      if (r.report_id && r.status !== "rascunho") a.enviados += 1;
      a.rows.push(r);
    });
    return Array.from(agg.values()).sort((a, b) => a.sectorName.localeCompare(b.sectorName));
  }, [rows, churchToSector]);

  const totals = useMemo(() => bySector.reduce((acc, s) => ({
    lifeGroups: acc.lifeGroups + s.lifeGroups, membros: acc.membros + s.membros, mda: acc.mda + s.mda,
    ge: acc.ge + s.ge, visitantes: acc.visitantes + s.visitantes, ofertaTotal: acc.ofertaTotal + s.ofertaTotal,
    kgAmor: acc.kgAmor + s.kgAmor, tadel: acc.tadel + s.tadel, emp: acc.emp + s.emp,
    enviados: acc.enviados + s.enviados, esperados: acc.esperados + s.esperados,
  }), { lifeGroups: 0, membros: 0, mda: 0, ge: 0, visitantes: 0, ofertaTotal: 0, kgAmor: 0, tadel: 0, emp: 0, enviados: 0, esperados: 0 }), [bySector]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-navy">Consolidação da Rede</h2>
          <p className="text-sm text-muted-foreground">Semana {period.week} de {MONTH_NAMES[period.month - 1]} de {period.year}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)} className="gap-1"><ChevronLeft className="h-4 w-4" />Semana anterior</Button>
          <Button variant="outline" size="sm" onClick={() => shiftWeek(1)} className="gap-1">Semana seguinte<ChevronRight className="h-4 w-4" /></Button>
          <Button
            variant="outline" size="sm" className="gap-1" disabled={bySector.length === 0}
            onClick={() => exportToExcel(bySector as unknown as Record<string, unknown>[], RELMDA_SECTOR_COLUMNS, `relmda_consolidacao_setor_semana${period.week}_${period.month}_${period.year}`, "Consolidação")}
          >
            <FileSpreadsheet className="h-4 w-4" />Excel
          </Button>
        </div>
      </div>

      {/* Cards da Rede */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Card label="Setores" value={bySector.length} />
        <Card label="Life Groups" value={totals.lifeGroups} />
        <Card label="Membros" value={totals.membros} />
        <Card label="Visitantes" value={totals.visitantes} />
        <Card label="MDA" value={totals.mda} />
        <Card label="GE" value={totals.ge} />
        <Card label="TADEL" value={totals.tadel} />
        <Card label="EMP" value={totals.emp} />
        <Card label="Kg do Amor" value={totals.kgAmor} decimals={1} />
        <Card label="Oferta total" value={totals.ofertaTotal} money />
        <Card label="Entrega" value={totals.esperados ? Math.round((totals.enviados / totals.esperados) * 100) : 0} suffix="%" />
      </div>

      {/* Consolidação por Setor com drill-down */}
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
          <Network className="h-4 w-4 text-gold" />
          <p className="text-xs font-bold uppercase tracking-widest text-navy-600">Por Setor — clique para ver os Life Groups</p>
        </div>
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && bySector.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum dado no seu escopo.</p>}
        <div className="divide-y">
          {bySector.map((s) => {
            const open = openSector === s.sectorId;
            return (
              <div key={s.sectorId}>
                <button
                  onClick={() => setOpenSector(open ? null : s.sectorId)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/20"
                >
                  <div className="flex items-center gap-2">
                    {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    <span className="font-semibold text-navy">{s.sectorName}</span>
                    <span className="text-xs text-muted-foreground">({s.lifeGroups} Life Group{s.lifeGroups !== 1 ? "s" : ""})</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span><b className="text-navy">{s.membros}</b> membros</span>
                    <span><b className="text-navy">{s.mda}</b> MDA</span>
                    <span><b className="text-navy">{s.visitantes}</b> visitantes</span>
                    <span><b className="text-navy">R$ {s.ofertaTotal.toFixed(2).replace(".", ",")}</b></span>
                    <span><b className="text-navy">{s.esperados ? Math.round((s.enviados / s.esperados) * 100) : 0}%</b> entregue</span>
                  </div>
                </button>
                {open && (
                  <div className="overflow-x-auto bg-muted/10 px-4 pb-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left text-[10px] uppercase text-muted-foreground">
                          <th className="py-1.5">Life Group</th><th>Líder</th><th>Igreja</th>
                          <th className="text-center">Membros</th><th className="text-center">MDA</th>
                          <th className="text-center">Visitantes</th><th className="text-center">Oferta</th><th className="text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.rows.map((r) => (
                          <tr key={r.life_group_id} className="border-b border-dashed">
                            <td className="py-1.5 font-medium text-navy">{r.life_group_name}</td>
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
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Igrejas sem Setor cadastrado (vínculo direto ao Núcleo/Distrito) aparecem agrupadas em &quot;Sem Setor definido&quot;. Consolidação por Núcleo/Distrito/Estado entra numa próxima etapa.
      </p>
    </div>
  );
}

function Card({ label, value, money, decimals, suffix }: { label: string; value: number; money?: boolean; decimals?: number; suffix?: string }) {
  const display = money ? `R$ ${value.toFixed(2).replace(".", ",")}` : decimals ? value.toFixed(decimals).replace(".", ",") : `${value}${suffix ?? ""}`;
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className="font-display text-xl font-bold text-navy">{display}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
