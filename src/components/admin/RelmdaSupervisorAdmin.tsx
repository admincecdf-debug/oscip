"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, Eye, CheckCircle2, AlertOctagon, Clock,
  FileWarning, X, ShieldCheck, FileDown, FileSpreadsheet, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRelmdaSupervisorOverview, useRelmdaReportFull } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import * as Rm from "@/services/relmdaReports";
import { exportToExcel, exportToPDF, RELMDA_OVERVIEW_COLUMNS } from "@/lib/export";
import type { RelmdaStatus, RelmdaSupervisorOverviewRow } from "@/types/domain";

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const STATUS_CFG: Record<RelmdaStatus, { label: string; cls: string }> = {
  rascunho:             { label: "Rascunho",             cls: "bg-gray-100 text-gray-700 border-gray-300" },
  enviado:              { label: "Enviado",              cls: "bg-blue-50 text-blue-700 border-blue-300" },
  em_analise:           { label: "Em análise",           cls: "bg-purple-50 text-purple-700 border-purple-300" },
  correcao_solicitada:  { label: "Correção solicitada",  cls: "bg-red-50 text-red-700 border-red-300" },
  corrigido:            { label: "Corrigido",             cls: "bg-orange-50 text-orange-700 border-orange-300" },
  validado:             { label: "Validado",              cls: "bg-green-50 text-green-700 border-green-300" },
  encerrado:            { label: "Encerrado",             cls: "bg-navy/10 text-navy border-navy/30" },
};

const CORRECTION_ITEMS = ["Presença", "Visitantes", "MDA", "TADEL", "GE", "Oferta", "Necessidade pastoral", "Outro"];

function weekNumberOfMonth(date: Date): number { return Math.min(5, Math.ceil(date.getDate() / 7)); }

export function RelmdaSupervisorAdmin() {
  const qc = useQueryClient();
  const today = new Date();
  const [period, setPeriod] = useState({ week: weekNumberOfMonth(today), month: today.getMonth() + 1, year: today.getFullYear() });
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [correctionRow, setCorrectionRow] = useState<RelmdaSupervisorOverviewRow | null>(null);

  const { data: rows = [], isLoading } = useRelmdaSupervisorOverview(period.week, period.month, period.year);

  function shiftWeek(delta: number) {
    setPeriod((p) => {
      let week = p.week + delta;
      let month = p.month;
      let year = p.year;
      if (week < 1) { week = 5; month -= 1; if (month < 1) { month = 12; year -= 1; } }
      if (week > 5) { week = 1; month += 1; if (month > 12) { month = 1; year += 1; } }
      return { week, month, year };
    });
  }

  const isPastPeriod = period.year < today.getFullYear()
    || (period.year === today.getFullYear() && period.month < today.getMonth() + 1)
    || (period.year === today.getFullYear() && period.month === today.getMonth() + 1 && period.week < weekNumberOfMonth(today));

  const esperados = rows.length;
  const enviados = rows.filter((r) => r.report_id && r.status !== "rascunho").length;
  const pendentes = rows.filter((r) => !r.report_id || r.status === "rascunho").length;
  const atrasados = isPastPeriod ? pendentes : 0;
  const noPrazo = enviados - (isPastPeriod ? 0 : 0);
  const inconsistentes = rows.filter((r) => r.is_inconsistent).length;

  const filenameBase = `relmda_supervisao_semana${period.week}_${period.month}_${period.year}`;
  function handleExportExcel() {
    exportToExcel(rows as unknown as Record<string, unknown>[], RELMDA_OVERVIEW_COLUMNS, filenameBase, "Supervisão");
  }
  function handleExportPdf() {
    exportToPDF({
      title: "Supervisão de Rede — RELMDA",
      subtitle: `Semana ${period.week} de ${MONTH_NAMES[period.month - 1]} de ${period.year}`,
      columns: RELMDA_OVERVIEW_COLUMNS,
      data: rows as unknown as Record<string, unknown>[],
      filename: filenameBase,
      landscape: true,
    });
  }

  async function handleValidate(reportId: string) {
    if (!confirm("Após a validação, os dados serão considerados na consolidação oficial da semana.\n\nValidar relatório?")) return;
    try {
      await Rm.validateReport(supabase, reportId);
      qc.invalidateQueries({ queryKey: ["relmda-supervisor-overview"] });
      qc.invalidateQueries({ queryKey: ["relmda-report-full", reportId] });
    } catch (e) { alert(e instanceof Error ? e.message : "Erro ao validar"); }
  }

  async function handleOpen(row: RelmdaSupervisorOverviewRow) {
    if (!row.report_id) { alert("Este Life Group ainda não enviou o relatório desta semana."); return; }
    if (row.status === "enviado" || row.status === "corrigido") {
      try { await Rm.markInAnalysis(supabase, row.report_id); } catch { /* silencioso */ }
    }
    setOpenReportId(row.report_id);
    qc.invalidateQueries({ queryKey: ["relmda-supervisor-overview"] });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-navy">Supervisão de Rede</h2>
          <p className="text-sm text-muted-foreground">
            Semana {period.week} de {MONTH_NAMES[period.month - 1]} de {period.year}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)} className="gap-1"><ChevronLeft className="h-4 w-4" />Semana anterior</Button>
          <Button variant="outline" size="sm" onClick={() => shiftWeek(1)} className="gap-1">Semana seguinte<ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1" disabled={rows.length === 0}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1" disabled={rows.length === 0}><FileDown className="h-4 w-4" />PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Esperados" value={esperados} />
        <KpiCard label="Enviados" value={enviados} accent="blue" />
        <KpiCard label="Pendentes" value={pendentes} accent="yellow" />
        <KpiCard label="No prazo" value={noPrazo < 0 ? 0 : noPrazo} accent="green" />
        <KpiCard label="Atrasados" value={atrasados} accent="red" />
        <KpiCard label="Inconsistentes" value={inconsistentes} accent="red" />
      </div>

      {esperados > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Entrega dos relatórios</span>
            <span>{Math.round((enviados / esperados) * 100)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-2 rounded-full bg-gold transition-all" style={{ width: `${(enviados / esperados) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-[#0E2A47] text-xs uppercase tracking-wider text-white">
            <tr>
              <th className="px-3 py-2 text-left">Situação</th>
              <th className="px-3 py-2 text-left">Life Group</th>
              <th className="px-3 py-2 text-left">Líder</th>
              <th className="px-3 py-2 text-left">Enviado</th>
              <th className="px-3 py-2 text-center">Membros</th>
              <th className="px-3 py-2 text-center">MDA</th>
              <th className="px-3 py-2 text-center">Visitantes</th>
              <th className="px-3 py-2 text-center">Oferta</th>
              <th className="px-3 py-2 text-center">Ação</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Nenhum Life Group no seu escopo.</td></tr>}
            {rows.map((r) => {
              const cfg = !r.report_id ? { label: "Pendente", cls: "bg-yellow-50 text-yellow-700 border-yellow-300" } : STATUS_CFG[r.status];
              return (
                <tr key={r.life_group_id} className={`border-t ${r.is_inconsistent ? "bg-red-50/40" : ""}`}>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cfg.cls}`}>
                      {r.is_inconsistent && <AlertOctagon className="h-3 w-3" />}
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-navy">{r.life_group_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.leader_name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.sent_at ? new Date(r.sent_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">{r.total_members}</td>
                  <td className="px-3 py-2 text-center">{r.mda_count}</td>
                  <td className="px-3 py-2 text-center">{r.visitantes_count}</td>
                  <td className="px-3 py-2 text-center">R$ {r.offering_total.toFixed(2).replace(".", ",")}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => handleOpen(r)} disabled={!r.report_id}>
                        <Eye className="h-3 w-3" />Ver
                      </Button>
                      {r.report_id && r.status !== "validado" && r.status !== "encerrado" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-red-600" onClick={() => setCorrectionRow(r)}>
                            <FileWarning className="h-3 w-3" />Corrigir
                          </Button>
                          <Button size="sm" className="h-7 gap-1 bg-green-600 px-2 text-xs hover:bg-green-700" onClick={() => handleValidate(r.report_id as string)}>
                            <CheckCircle2 className="h-3 w-3" />Validar
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openReportId && (
        <ReportDetailModal reportId={openReportId} onClose={() => setOpenReportId(null)} onValidate={handleValidate} onRequestCorrection={(row) => { setOpenReportId(null); setCorrectionRow(row); }} />
      )}

      {correctionRow && (
        <RequestCorrectionModal row={correctionRow} onClose={() => setCorrectionRow(null)} onDone={() => { setCorrectionRow(null); qc.invalidateQueries({ queryKey: ["relmda-supervisor-overview"] }); }} />
      )}
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: "blue" | "yellow" | "green" | "red" }) {
  const cls = accent === "blue" ? "border-blue-200 bg-blue-50"
    : accent === "yellow" ? "border-yellow-200 bg-yellow-50"
    : accent === "green" ? "border-green-200 bg-green-50"
    : accent === "red" ? "border-red-200 bg-red-50"
    : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-3 text-center ${cls}`}>
      <p className="font-display text-2xl font-bold text-navy">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

// ============================================================
// DETALHE DO RELATÓRIO (visão do supervisor)
// ============================================================
function ReportDetailModal({
  reportId, onClose, onValidate, onRequestCorrection,
}: { reportId: string; onClose: () => void; onValidate: (id: string) => void; onRequestCorrection: (row: RelmdaSupervisorOverviewRow) => void }) {
  const qc = useQueryClient();
  const { data: full, isLoading } = useRelmdaReportFull(reportId);
  const [note, setNote] = useState("");
  const [needsSupport, setNeedsSupport] = useState(false);
  const [supportType, setSupportType] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (full) { setNote(full.report.supervisor_note ?? ""); setNeedsSupport(full.report.needs_support); setSupportType(full.report.support_type ?? ""); }
  }, [full]);

  async function saveAnalysis() {
    setSaving(true);
    try {
      await Rm.saveSupervisorNote(supabase, reportId, note, needsSupport, supportType || null);
      qc.invalidateQueries({ queryKey: ["relmda-report-full", reportId] });
      qc.invalidateQueries({ queryKey: ["relmda-supervisor-overview"] });
    } catch (e) { alert(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-navy">Relatório do Life Group</h3>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <Link href={`/admin/relatorio-relmda/${reportId}`} target="_blank"><Printer className="h-3 w-3" />Imprimir</Link>
            </Button>
            <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
          </div>
        </div>

        {isLoading || !full ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
              <MiniStat label="Membros" value={full.snapshot.total_members} />
              <MiniStat label="MDA" value={full.report.mda_count} />
              <MiniStat label="GE" value={full.report.ge_count} />
              <MiniStat label="Visitantes" value={full.visitors.length} />
              <MiniStat label="TADEL" value={full.report.tadel_count} />
              <MiniStat label="Oferta" value={full.report.offering_total} money />
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><b className="text-navy">Tema:</b> {full.report.topic ?? "—"}</p>
              <p><b className="text-navy">Texto bíblico:</b> {full.report.bible_text ?? "—"}</p>
              <p><b className="text-navy">Avaliação:</b> {full.report.flow ?? "—"}</p>
              <p><b className="text-navy">Saúde:</b> {full.report.health_assessment ?? "—"}</p>
            </div>
            {full.report.summary && <p className="text-sm text-muted-foreground">{full.report.summary}</p>}

            {full.needs.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <p className="mb-1 text-xs font-bold uppercase text-amber-800">Necessidades pastorais ({full.needs.length})</p>
                {full.needs.map((n) => (
                  <p key={n.id} className="text-xs text-amber-800">
                    {n.need_type ?? "Necessidade"} {n.urgent_prayer && "· Oração urgente"} {n.pastoral_visit && "· Visita pastoral"} — {n.description ?? "sem descrição"}
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-2 border-t pt-3">
              <Label>Observação da supervisão</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              <label className="flex items-center gap-2 text-xs"><Checkbox checked={needsSupport} onCheckedChange={(v) => setNeedsSupport(!!v)} />Necessita apoio</label>
              {needsSupport && <Input placeholder="Tipo de apoio" value={supportType} onChange={(e) => setSupportType(e.target.value)} />}
              <Button size="sm" variant="outline" onClick={saveAnalysis} disabled={saving}>{saving ? "Salvando…" : "Salvar análise"}</Button>
            </div>

            {full.report.status !== "validado" && full.report.status !== "encerrado" && (
              <div className="flex gap-2 border-t pt-3">
                <Button variant="outline" className="flex-1 gap-1 text-red-600" onClick={() => onRequestCorrection({
                  life_group_id: full.report.life_group_id, life_group_name: "", leader_name: null,
                  church_id: null, church_name: null, report_id: full.report.id,
                  status: full.report.status, sent_at: full.report.sent_at, total_members: full.snapshot.total_members,
                  mda_count: full.report.mda_count, visitantes_count: full.visitors.length, ge_count: full.report.ge_count,
                  offering_total: full.report.offering_total, kg_amor: full.report.kg_amor, tadel_count: full.report.tadel_count,
                  emp_participants: full.report.emp_participants, needs_correction: full.report.needs_correction,
                  correction_deadline: full.report.correction_deadline, is_inconsistent: false,
                })}>
                  <FileWarning className="h-4 w-4" />Solicitar correção
                </Button>
                <Button className="flex-1 gap-1 bg-green-600 hover:bg-green-700" onClick={() => onValidate(full.report.id)}>
                  <ShieldCheck className="h-4 w-4" />Validar relatório
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, money }: { label: string; value: number; money?: boolean }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-lg font-bold text-navy">{money ? `R$ ${value.toFixed(2).replace(".", ",")}` : value}</p>
      <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

// ============================================================
// SOLICITAR CORREÇÃO
// ============================================================
function RequestCorrectionModal({ row, onClose, onDone }: { row: RelmdaSupervisorOverviewRow; onClose: () => void; onDone: () => void }) {
  const [items, setItems] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(item: string) {
    setItems((arr) => arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  }

  async function submit() {
    if (!row.report_id) return;
    setSaving(true);
    try {
      await Rm.requestCorrection(supabase, row.report_id, items, note, deadline ? new Date(deadline).toISOString() : null);
      alert("Correção solicitada. O líder foi notificado.");
      onDone();
    } catch (e) { alert(e instanceof Error ? e.message : "Erro ao solicitar correção"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-navy">Solicitar Correção</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block">Selecione os itens</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {CORRECTION_ITEMS.map((item) => (
                <label key={item} className="flex items-center gap-2 text-xs">
                  <Checkbox checked={items.includes(item)} onCheckedChange={() => toggle(item)} />{item}
                </label>
              ))}
            </div>
          </div>
          <div><Label>Orientação ao líder</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} /></div>
          <div><Label>Prazo</Label><Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={submit} disabled={saving || items.length === 0}>{saving ? "Enviando…" : "Enviar solicitação"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
