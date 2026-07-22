"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Wand2, Lock, FileSpreadsheet, Filter, BarChart3, Users, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAllMembers, useMonthlyReports, useMonthlyReportFull } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import {
  prefillMonthlyReport, updateWeekTotals, updateMemberWeek,
  setMonthlyNucleo, closeMonthlyReport,
} from "@/services/monthlyReports";
import { logAudit } from "@/services/audit";
import type { MonthlyReportWeek, MonthlyReportMemberWeek } from "@/types/domain";

// ─── Tipos ────────────────────────────────────────────────────
interface LifeGroup { id: string; name: string; church_id: string; sector_id?: string; }
interface OrgNode   { id: string; name: string; [key: string]: string; }
type ScopeType = "life_group" | "setor" | "area" | "distrito" | "nucleo" | "todos";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const WEEK_FIELDS: { key: keyof MonthlyReportWeek; label: string; money?: boolean }[] = [
  { key: "num_membros",           label: "Nº de Membros" },
  { key: "memb_c_discipuladores", label: "Membros c/ discipuladores" },
  { key: "mda_15_dias",           label: "MDA 15 dias" },
  { key: "ge",                    label: "GE (Grupo de Evangelismo)" },
  { key: "visitantes",            label: "Visitantes" },
  { key: "oferta_pix",            label: "Oferta PIX", money: true },
  { key: "oferta_especie",        label: "Oferta em espécie", money: true },
  { key: "ebd",                   label: "EBD" },
  { key: "cc",                    label: "C.C" },
  { key: "cel",                   label: "CEL" },
  { key: "kg_amor",               label: "KG do Amor (kg)" },
];

// ─── Seletor hierárquico (mesmo padrão do semanal) ────────────
function ScopeSelector({ onSelectLgs }: { onSelectLgs: (lgs: LifeGroup[]) => void }) {
  const [scopeType, setScopeType]         = useState<ScopeType>("life_group");
  const [nucleos,   setNucleos]           = useState<OrgNode[]>([]);
  const [distritos, setDistritos]         = useState<OrgNode[]>([]);
  const [areas,     setAreas]             = useState<OrgNode[]>([]);
  const [setores,   setSetores]           = useState<OrgNode[]>([]);
  const [allLgs,    setAllLgs]            = useState<LifeGroup[]>([]);
  const [filteredLgs, setFilteredLgs]     = useState<LifeGroup[]>([]);
  const [selectedNucleo,   setSelectedNucleo]   = useState("");
  const [selectedDistrito, setSelectedDistrito] = useState("");
  const [selectedArea,     setSelectedArea]     = useState("");
  const [selectedSetor,    setSelectedSetor]    = useState("");
  const [selectedLgs,      setSelectedLgs]      = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("churches").select("id, name").eq("type", "nucleo").eq("is_active", true).order("name"),
      supabase.from("districts").select("id, name").order("name"),
      supabase.from("areas").select("id, name, district_id").order("name"),
      supabase.from("sectors").select("id, name, area_id").order("name"),
      supabase.from("life_groups").select("id, name, church_id, sector_id").eq("is_active", true).order("name"),
    ]).then(([n, d, a, s, lg]) => {
      setNucleos((n.data as OrgNode[]) ?? []);
      setDistritos((d.data as OrgNode[]) ?? []);
      setAreas((a.data as OrgNode[]) ?? []);
      setSetores((s.data as OrgNode[]) ?? []);
      const lgs = (lg.data as LifeGroup[]) ?? [];
      setAllLgs(lgs);
      setFilteredLgs(lgs);
    });
  }, []);

  useEffect(() => {
    let lgs = allLgs;
    if (scopeType === "nucleo" && selectedNucleo) {
      lgs = allLgs.filter(lg => lg.church_id === selectedNucleo);
    } else if (scopeType === "distrito" && selectedDistrito) {
      const areaIds = areas.filter(a => a.district_id === selectedDistrito).map(a => a.id);
      const setorIds = setores.filter(s => areaIds.includes(s.area_id ?? "")).map(s => s.id);
      lgs = allLgs.filter(lg => lg.sector_id && setorIds.includes(lg.sector_id));
    } else if (scopeType === "area" && selectedArea) {
      const setorIds = setores.filter(s => s.area_id === selectedArea).map(s => s.id);
      lgs = allLgs.filter(lg => lg.sector_id && setorIds.includes(lg.sector_id));
    } else if (scopeType === "setor" && selectedSetor) {
      lgs = allLgs.filter(lg => lg.sector_id === selectedSetor);
    }
    setFilteredLgs(lgs);
    setSelectedLgs([]);
    onSelectLgs([]);
  }, [scopeType, selectedNucleo, selectedDistrito, selectedArea, selectedSetor, allLgs]);

  function toggleLg(id: string) {
    const next = selectedLgs.includes(id)
      ? selectedLgs.filter(x => x !== id)
      : [...selectedLgs, id];
    setSelectedLgs(next);
    onSelectLgs(filteredLgs.filter(lg => next.includes(lg.id)));
  }

  function selectAll() {
    setSelectedLgs(filteredLgs.map(lg => lg.id));
    onSelectLgs(filteredLgs);
  }

  function clearAll() {
    setSelectedLgs([]);
    onSelectLgs([]);
  }

  const SCOPE_LABELS: Record<ScopeType, string> = {
    life_group: "Life Group específico", setor: "Por Setor",
    area: "Por Área", distrito: "Por Distrito",
    nucleo: "Por Núcleo", todos: "Todos os Life Groups",
  };

  return (
    <Card className="border-l-4 border-l-gold">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4 text-gold" />Escopo do Relatório
        </CardTitle>
        <CardDescription>Selecione um ou mais Life Groups para consolidar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Filtrar por</Label>
          <select value={scopeType} onChange={(e) => { setScopeType(e.target.value as ScopeType); }}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {scopeType === "nucleo" && (
          <div className="space-y-1.5">
            <Label>Núcleo</Label>
            <select value={selectedNucleo} onChange={(e) => setSelectedNucleo(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Selecione —</option>
              {nucleos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
        )}
        {scopeType === "distrito" && (
          <div className="space-y-1.5">
            <Label>Distrito</Label>
            <select value={selectedDistrito} onChange={(e) => setSelectedDistrito(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Selecione —</option>
              {distritos.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        {scopeType === "area" && (
          <div className="space-y-1.5">
            <Label>Área</Label>
            <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Selecione —</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        {scopeType === "setor" && (
          <div className="space-y-1.5">
            <Label>Setor</Label>
            <select value={selectedSetor} onChange={(e) => setSelectedSetor(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Selecione —</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Lista de LGs com multiselect */}
        {filteredLgs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Life Groups ({filteredLgs.length} disponíveis · {selectedLgs.length} selecionados)</Label>
              <div className="flex gap-1">
                <Button onClick={selectAll} variant="outline" size="sm" className="h-7 text-xs">Todos</Button>
                <Button onClick={clearAll} variant="ghost" size="sm" className="h-7 text-xs">Limpar</Button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
              {filteredLgs.map(lg => (
                <label key={lg.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gold/5">
                  <input type="checkbox" checked={selectedLgs.includes(lg.id)}
                    onChange={() => toggleLg(lg.id)} className="h-4 w-4 accent-gold" />
                  <span className={selectedLgs.includes(lg.id) ? "font-semibold text-navy" : "text-muted-foreground"}>
                    {lg.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        {filteredLgs.length === 0 && (
          <p className="text-xs italic text-muted">Nenhum Life Group encontrado para este escopo.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Relatório individual de um LG ────────────────────────────
function SingleLgReport({ lgId, lgName, year, month, allMembers }: {
  lgId: string; lgName: string; year: number; month: number;
  allMembers: { id: string; full_name: string }[];
}) {
  const qc = useQueryClient();
  const [reportId, setReportId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { data: reports = [] } = useMonthlyReports(lgId);
  const { data: full } = useMonthlyReportFull(reportId);
  const memberMap = new Map(allMembers.map(m => [m.id, m]));

  // Auto-selecionar relatório existente do mês/ano — apenas se não houver seleção manual ativa
  useEffect(() => {
    const existing = reports.find(r => r.month === month && r.year === year);
    if (existing && !reportId) setReportId(existing.id);
  }, [reports]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doPrefill() {
    setBusy(true); setErr("");
    try {
      const id = await prefillMonthlyReport(supabase, lgId, year, month);
      await logAudit(supabase, "custom", "monthly_reports", id, { action: "prefill", year, month });
      setReportId(id);
      await qc.invalidateQueries({ queryKey: ["monthly-reports", lgId] });
      await qc.refetchQueries({ queryKey: ["monthly-report-full", id] });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao gerar");
    } finally { setBusy(false); }
  }

  async function patchWeek(id: string, key: keyof MonthlyReportWeek, value: number) {
    await updateWeekTotals(supabase, id, { [key]: value });
    if (reportId) qc.invalidateQueries({ queryKey: ["monthly-report-full", reportId] });
  }
  async function patchMemberWeek(id: string, key: keyof MonthlyReportMemberWeek, value: number) {
    await updateMemberWeek(supabase, id, { [key]: value });
    if (reportId) qc.invalidateQueries({ queryKey: ["monthly-report-full", reportId] });
  }
  async function doClose() {
    if (!full || !confirm("Fechar este relatório?")) return;
    await closeMonthlyReport(supabase, full.report.id);
    await logAudit(supabase, "update", "monthly_reports", full.report.id, { action: "close" });
    qc.invalidateQueries({ queryKey: ["monthly-report-full", full.report.id] });
    qc.invalidateQueries({ queryKey: ["monthly-reports", lgId] });
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho do LG */}
      <Card className="border-l-4 border-l-gold">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold text-navy">{lgName}</p>
              <p className="text-xs text-muted">{MONTHS[month-1]} / {year}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {reports.map(r => (
                <Button key={r.id} onClick={() => setReportId(r.id)}
                  variant={reportId === r.id ? "default" : "outline"} size="sm" className="text-xs">
                  {MONTHS[r.month-1]}/{r.year}{r.closed_at ? " 🔒" : ""}
                </Button>
              ))}
              <Button onClick={doPrefill} disabled={busy} size="sm" className="gap-1.5">
                <Wand2 className="h-3.5 w-3.5" />{busy ? "Gerando…" : "Gerar / Atualizar"}
              </Button>
            </div>
          </div>
          {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        </CardContent>
      </Card>

      {/* Tabela de indicadores */}
      {full && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Indicadores por semana</CardTitle>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm" className="gap-1 h-7 text-xs">
                    <Link href={`/admin/relatorio-mensal/${full.report.id}`}>
                      <Eye className="h-3 w-3" />Ver / Imprimir
                    </Link>
                  </Button>
                  {full.report.closed_at ? (
                    <span className="flex items-center gap-1 rounded-full bg-navy/10 px-3 py-1 text-xs font-bold text-navy">
                      <Lock className="h-3 w-3" />Fechado
                    </span>
                  ) : (
                    <Button onClick={doClose} variant="outline" size="sm" className="gap-1 h-7 text-xs">
                      <Lock className="h-3 w-3" />Fechar
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 text-xs uppercase text-muted">Indicador</th>
                    {full.weeks.map(w => (
                      <th key={w.id} className="p-2 text-center text-xs font-bold uppercase text-navy">{w.week_number}ª</th>
                    ))}
                    <th className="p-2 text-right text-xs uppercase text-muted">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEK_FIELDS.map(f => {
                    const total = full.weeks.reduce((s, w) => s + Number(w[f.key] ?? 0), 0);
                    return (
                      <tr key={f.key} className="border-b">
                        <td className="p-2 text-xs font-semibold text-navy">{f.label}</td>
                        {full.weeks.map(w => (
                          <td key={w.id} className="p-1">
                            <input type="number" min="0" step={f.money ? "0.01" : "1"}
                              defaultValue={Number(w[f.key] ?? 0)}
                              disabled={!!full.report.closed_at}
                              onBlur={(e) => patchWeek(w.id, f.key, Number(e.target.value) || 0)}
                              className="h-8 w-16 rounded border bg-background px-1 text-center text-xs disabled:opacity-50" />
                          </td>
                        ))}
                        <td className="p-2 text-right text-xs font-bold text-navy">
                          {f.money ? total.toFixed(2) : total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Membros */}
          {full.members.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Membros × Semana (MDA / CC / CEL)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th rowSpan={2} className="p-2 align-bottom text-xs uppercase text-muted">Membro</th>
                      {[1,2,3,4,5].map(n => (
                        <th key={n} colSpan={3} className="border-l p-1 text-center text-xs font-bold text-navy">{n}ª sem.</th>
                      ))}
                    </tr>
                    <tr className="border-b text-[10px] uppercase text-muted">
                      {[1,2,3,4,5].flatMap(n => [
                        <th key={`${n}-mda`} className="border-l p-1 text-center">MDA</th>,
                        <th key={`${n}-cc`}  className="p-1 text-center">CC</th>,
                        <th key={`${n}-cel`} className="p-1 text-center">CEL</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {full.members.map(memb => {
                      const member = memberMap.get(memb.member_id);
                      return (
                        <tr key={memb.id} className="border-b">
                          <td className="p-2 text-xs font-semibold text-navy">{member?.full_name ?? "—"}</td>
                          {[1,2,3,4,5].map(n => {
                            const w = memb.weeks.find(x => x.week_number === n);
                            if (!w) return (
                              <React.Fragment key={`${memb.id}-na-${n}`}>
                                <td className="border-l p-1 text-center text-muted text-xs">—</td>
                                <td className="p-1 text-center text-muted text-xs">—</td>
                                <td className="p-1 text-center text-muted text-xs">—</td>
                              </React.Fragment>
                            );
                            return (
                              <React.Fragment key={`${memb.id}-${n}`}>
                                <td className="border-l p-1">
                                  <input type="number" min="0" defaultValue={w.mda}
                                    disabled={!!full.report.closed_at}
                                    onBlur={(e) => patchMemberWeek(w.id, "mda", Number(e.target.value) || 0)}
                                    className="h-7 w-10 rounded border bg-background text-center text-xs disabled:opacity-50" />
                                </td>
                                <td className="p-1">
                                  <input type="number" min="0" defaultValue={w.cc}
                                    disabled={!!full.report.closed_at}
                                    onBlur={(e) => patchMemberWeek(w.id, "cc", Number(e.target.value) || 0)}
                                    className="h-7 w-10 rounded border bg-background text-center text-xs disabled:opacity-50" />
                                </td>
                                <td className="p-1">
                                  <input type="number" min="0" defaultValue={w.cel}
                                    disabled={!!full.report.closed_at}
                                    onBlur={(e) => patchMemberWeek(w.id, "cel", Number(e.target.value) || 0)}
                                    className="h-7 w-10 rounded border bg-background text-center text-xs disabled:opacity-50" />
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!full && (
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <p className="text-sm text-muted">Clique em "Gerar / Atualizar" para consolidar os relatórios semanais deste Life Group.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Dashboard consolidado (visão agregada) ───────────────────
function ConsolidatedDashboard({ lgs, year, month }: { lgs: LifeGroup[]; year: number; month: number }) {
  const [data, setData] = useState<Record<string, { total: Record<string, number>; name: string }>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (lgs.length === 0) return;
    setLoading(true);
    const results: Record<string, { total: Record<string, number>; name: string }> = {};

    await Promise.all(lgs.map(async (lg) => {
      const { data: reports } = await supabase
        .from("monthly_reports")
        .select("id")
        .eq("life_group_id", lg.id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

      if (!reports?.id) return;

      const { data: weeks } = await supabase
        .from("monthly_report_weeks")
        .select("*")
        .eq("report_id", reports.id);

      const totals: Record<string, number> = {};
      WEEK_FIELDS.forEach(f => {
        totals[f.key as string] = (weeks ?? []).reduce((s, w) => s + Number(w[f.key as string] ?? 0), 0);
      });
      results[lg.id] = { total: totals, name: lg.name };
    }));

    setData(results);
    setLoading(false);
  }, [lgs, year, month]);

  useEffect(() => { load(); }, [load]);

  const lgsWithData = Object.values(data);
  if (lgs.length === 0) return null;

  // Totais consolidados
  const consolidated: Record<string, number> = {};
  WEEK_FIELDS.forEach(f => {
    consolidated[f.key as string] = lgsWithData.reduce((s, d) => s + (d.total[f.key as string] ?? 0), 0);
  });

  if (loading) return <p className="text-sm text-muted italic py-4">Consolidando dados…</p>;

  return (
    <div className="space-y-4">
      {/* KPIs consolidados */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-l-4 border-l-gold">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase text-muted">Life Groups</p>
            <p className="font-display text-2xl font-bold text-navy">{lgsWithData.length}/{lgs.length}</p>
            <p className="text-[10px] text-muted">com relatório</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase text-muted">Total membros</p>
            <p className="font-display text-2xl font-bold text-navy">{consolidated["num_membros"] ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase text-muted">Visitantes</p>
            <p className="font-display text-2xl font-bold text-navy">{consolidated["visitantes"] ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase text-muted">Oferta total</p>
            <p className="font-display text-xl font-bold text-navy">
              R$ {((consolidated["oferta_pix"] ?? 0) + (consolidated["oferta_especie"] ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela por LG */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gold" />
            Comparativo por Life Group — {MONTHS[month-1]}/{year}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-navy text-white">
                <th className="px-3 py-2 text-left">Life Group</th>
                {WEEK_FIELDS.map(f => (
                  <th key={f.key as string} className="px-2 py-2 text-center whitespace-nowrap">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lgs.map((lg, i) => {
                const d = data[lg.id];
                return (
                  <tr key={lg.id} className={`border-b ${i % 2 === 0 ? "bg-gray-50/50" : ""}`}>
                    <td className="px-3 py-2 font-medium text-navy">
                      {lg.name}
                      {!d && <span className="ml-2 text-[10px] text-muted italic">sem relatório</span>}
                    </td>
                    {WEEK_FIELDS.map(f => (
                      <td key={f.key as string} className="px-2 py-2 text-center text-muted-foreground">
                        {d ? (f.money
                          ? (d.total[f.key as string] ?? 0).toFixed(2)
                          : (d.total[f.key as string] ?? 0))
                          : "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {/* Linha de totais */}
              <tr className="border-t-2 border-gold bg-gold/5 font-bold">
                <td className="px-3 py-2 text-navy font-bold">TOTAL</td>
                {WEEK_FIELDS.map(f => (
                  <td key={f.key as string} className="px-2 py-2 text-center text-navy font-bold">
                    {f.money
                      ? (consolidated[f.key as string] ?? 0).toFixed(2)
                      : (consolidated[f.key as string] ?? 0)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────
export function MonthlyReportAdmin() {
  const { data: allMembers = [] } = useAllMembers();
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedLgs, setSelectedLgs] = useState<LifeGroup[]>([]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-gold" />Relatório Mensal
          </CardTitle>
          <CardDescription>
            Consolidação automática dos relatórios semanais por Life Group, setor, distrito, núcleo ou rede completa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 max-w-sm">
            <div className="space-y-1.5">
              <Label>Mês</Label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Input type="number" min="2020" max="2100" value={year}
                onChange={(e) => setYear(Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seletor hierárquico */}
      <ScopeSelector onSelectLgs={setSelectedLgs} />

      {/* Conteúdo conforme seleção */}
      {selectedLgs.length === 0 && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <Users className="h-8 w-8 text-muted mx-auto mb-2" />
            <p className="text-sm text-muted">Selecione um ou mais Life Groups para gerar o relatório.</p>
          </CardContent>
        </Card>
      )}

      {selectedLgs.length === 1 && (
        <SingleLgReport
          lgId={selectedLgs[0].id}
          lgName={selectedLgs[0].name}
          year={year} month={month}
          allMembers={allMembers}
        />
      )}

      {selectedLgs.length > 1 && (
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />Dashboard consolidado
            </TabsTrigger>
            <TabsTrigger value="individual">
              <Users className="mr-1.5 h-3.5 w-3.5" />Por Life Group ({selectedLgs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <ConsolidatedDashboard lgs={selectedLgs} year={year} month={month} />
          </TabsContent>

          <TabsContent value="individual" className="mt-4 space-y-8">
            {selectedLgs.map(lg => (
              <div key={lg.id} className="border-b pb-8 last:border-0">
                <SingleLgReport
                  lgId={lg.id} lgName={lg.name}
                  year={year} month={month}
                  allMembers={allMembers}
                />
              </div>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
