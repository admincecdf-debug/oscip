"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ClipboardList, Eye, Filter } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { weeklyReportSchema, type WeeklyReportFormInput } from "@/schemas";
import { useAllMembers, useWeeklyReports } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { createWeeklyReport, deleteWeeklyReport } from "@/services/weeklyReports";
import { logAudit } from "@/services/audit";
import type { WeeklyAttendanceKind } from "@/types/domain";

// ── Tipos ─────────────────────────────────────────────────────
interface LifeGroup { id: string; name: string; church_id: string; sector_id?: string; area_id?: string; district_id?: string; }
interface OrgNode   { id: string; name: string; }

type ScopeType = "todos" | "nucleo" | "distrito" | "area" | "setor" | "life_group";

interface AttendanceRow {
  member_id: string; full_name: string;
  kind: WeeklyAttendanceKind; present: boolean; absence_reason: string;
  had_mda_15_dias: boolean; had_cc: boolean; had_cel: boolean;
}
interface VisitRow { id: string; visitor_name: string; phone: string; notes: string; }

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Seletor de escopo hierárquico ─────────────────────────────
function ScopeSelector({ onSelect }: { onSelect: (lgId: string, lgName: string) => void }) {
  const [scopeType, setScopeType] = useState<ScopeType>("life_group");
  const [nucleos,   setNucleos]   = useState<OrgNode[]>([]);
  const [distritos, setDistritos] = useState<OrgNode[]>([]);
  const [areas,     setAreas]     = useState<OrgNode[]>([]);
  const [setores,   setSetores]   = useState<OrgNode[]>([]);
  const [allLgs,    setAllLgs]    = useState<LifeGroup[]>([]);
  const [filteredLgs, setFilteredLgs] = useState<LifeGroup[]>([]);

  const [selectedNucleo,   setSelectedNucleo]   = useState("");
  const [selectedDistrito, setSelectedDistrito] = useState("");
  const [selectedArea,     setSelectedArea]     = useState("");
  const [selectedSetor,    setSelectedSetor]    = useState("");
  const [selectedLg,       setSelectedLg]       = useState("");

  // Carregar dados hierárquicos
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

  // Filtrar LGs conforme escopo selecionado
  useEffect(() => {
    if (scopeType === "todos") { setFilteredLgs(allLgs); return; }
    if (scopeType === "nucleo" && selectedNucleo) {
      setFilteredLgs(allLgs.filter(lg => lg.church_id === selectedNucleo));
    } else if (scopeType === "distrito" && selectedDistrito) {
      const areaIds = areas.filter((a: OrgNode & { district_id?: string }) => (a as { district_id?: string }).district_id === selectedDistrito).map(a => a.id);
      const setorIds = setores.filter((s: OrgNode & { area_id?: string }) => areaIds.includes((s as { area_id?: string }).area_id ?? "")).map(s => s.id);
      setFilteredLgs(allLgs.filter(lg => lg.sector_id && setorIds.includes(lg.sector_id)));
    } else if (scopeType === "area" && selectedArea) {
      const setorIds = setores.filter((s: OrgNode & { area_id?: string }) => (s as { area_id?: string }).area_id === selectedArea).map(s => s.id);
      setFilteredLgs(allLgs.filter(lg => lg.sector_id && setorIds.includes(lg.sector_id)));
    } else if (scopeType === "setor" && selectedSetor) {
      setFilteredLgs(allLgs.filter(lg => lg.sector_id === selectedSetor));
    } else {
      setFilteredLgs(allLgs);
    }
    setSelectedLg("");
  }, [scopeType, selectedNucleo, selectedDistrito, selectedArea, selectedSetor, allLgs]);

  const SCOPE_LABELS: Record<ScopeType, string> = {
    todos: "Todos os Life Groups",
    nucleo: "Por Núcleo",
    distrito: "Por Distrito",
    area: "Por Área",
    setor: "Por Setor",
    life_group: "Life Group específico",
  };

  return (
    <Card className="border-l-4 border-l-gold">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4 text-gold" />Selecionar Life Group
        </CardTitle>
        <CardDescription>Filtre por escopo hierárquico e selecione o Life Group</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tipo de escopo */}
        <Field label="Filtrar por">
          <select value={scopeType} onChange={(e) => { setScopeType(e.target.value as ScopeType); setSelectedLg(""); }}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>

        {/* Seletor de núcleo */}
        {scopeType === "nucleo" && (
          <Field label="Núcleo">
            <select value={selectedNucleo} onChange={(e) => setSelectedNucleo(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Selecione —</option>
              {nucleos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </Field>
        )}

        {/* Seletor de distrito */}
        {scopeType === "distrito" && (
          <Field label="Distrito">
            <select value={selectedDistrito} onChange={(e) => setSelectedDistrito(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Selecione —</option>
              {distritos.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}

        {/* Seletor de área */}
        {scopeType === "area" && (
          <Field label="Área">
            <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Selecione —</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}

        {/* Seletor de setor */}
        {scopeType === "setor" && (
          <Field label="Setor">
            <select value={selectedSetor} onChange={(e) => setSelectedSetor(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Selecione —</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}

        {/* Life Group final */}
        <Field label={`Life Group (${filteredLgs.length} disponível${filteredLgs.length !== 1 ? "s" : ""})`}>
          <select value={selectedLg} onChange={(e) => {
            setSelectedLg(e.target.value);
            const lg = filteredLgs.find(l => l.id === e.target.value);
            if (lg) onSelect(lg.id, lg.name);
          }}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">— Selecione o Life Group —</option>
            {filteredLgs.map(lg => <option key={lg.id} value={lg.id}>{lg.name}</option>)}
          </select>
        </Field>

        {filteredLgs.length === 0 && (
          <p className="text-xs italic text-muted">Nenhum Life Group encontrado para este escopo.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Componente principal ──────────────────────────────────────
export function WeeklyReportsAdmin() {
  const { data: members = [] } = useAllMembers();
  const [cellId, setCellId] = useState<string>("");
  const { data: reports = [] } = useWeeklyReports(cellId || null);
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<WeeklyReportFormInput>({
      resolver: zodResolver(weeklyReportSchema),
      defaultValues: { meeting_date: new Date().toISOString().slice(0,10), flowed: "null", decisions_count: 0 },
    });

  function onPickCell(id: string) {
    setCellId(id);
    const cellMembers = members.filter((m) => m.life_group_id === id && m.status === "ativo");
    setAttendance(cellMembers.map((m) => ({
      member_id: m.id, full_name: m.full_name,
      kind: "membro" as WeeklyAttendanceKind, present: true, absence_reason: "",
      had_mda_15_dias: false, had_cc: false, had_cel: false,
    })));
    setVisits([]);
    reset({ life_group_id: id, meeting_date: new Date().toISOString().slice(0,10), flowed: "null", decisions_count: 0 });
  }

  function togglePresent(memberId: string) {
    setAttendance((rows) => rows.map((r) => r.member_id === memberId ? { ...r, present: !r.present } : r));
  }
  function setKind(memberId: string, kind: WeeklyAttendanceKind) {
    setAttendance((rows) => rows.map((r) => r.member_id === memberId ? { ...r, kind } : r));
  }
  function setAbsence(memberId: string, reason: string) {
    setAttendance((rows) => rows.map((r) => r.member_id === memberId ? { ...r, absence_reason: reason } : r));
  }
  function toggleMda(memberId: string) {
    setAttendance((rows) => rows.map((r) => r.member_id === memberId ? { ...r, had_mda_15_dias: !r.had_mda_15_dias } : r));
  }
  function toggleCc(memberId: string) {
    setAttendance((rows) => rows.map((r) => r.member_id === memberId ? { ...r, had_cc: !r.had_cc } : r));
  }
  function toggleCel(memberId: string) {
    setAttendance((rows) => rows.map((r) => r.member_id === memberId ? { ...r, had_cel: !r.had_cel } : r));
  }
  function addVisit() {
    setVisits((v) => [...v, { id: crypto.randomUUID(), visitor_name: "", phone: "", notes: "" }]);
  }
  function updateVisit(id: string, patch: Partial<VisitRow>) {
    setVisits((rows) => rows.map((v) => v.id === id ? { ...v, ...patch } : v));
  }
  function removeVisit(id: string) { setVisits((v) => v.filter((x) => x.id !== id)); }

  async function onSubmit(v: WeeklyReportFormInput) {
    setErr("");
    try {
      const id = await createWeeklyReport(supabase, {
        life_group_id: v.life_group_id, meeting_date: v.meeting_date,
        share_theme: v.share_theme, bible_text: v.bible_text,
        flowed: v.flowed === "null" ? null : v.flowed === "sim",
        flowed_reason: v.flowed_reason, decisions_count: v.decisions_count,
        needs: v.needs, summary: v.summary,
        attendance: attendance.map((a) => ({
          member_id: a.member_id, kind: a.kind, present: a.present,
          absence_reason: a.absence_reason || undefined,
          had_mda_15_dias: a.had_mda_15_dias, had_cc: a.had_cc, had_cel: a.had_cel,
        })),
        visits: visits.filter((vi) => vi.visitor_name.trim()).map((vi) => ({
          visitor_name: vi.visitor_name, phone: vi.phone || undefined, notes: vi.notes || undefined,
        })),
        members_with_disciplers: v.members_with_disciplers,
        mda_15_dias_happened: v.mda_15_dias_happened, mda_15_dias_count: v.mda_15_dias_count,
        ge_happened: v.ge_happened, ge_location: v.ge_location, ge_when: v.ge_when,
        oferta_pix: v.oferta_pix, oferta_especie: v.oferta_especie,
        ebd_count: v.ebd_count, cc_count: v.cc_count, cel_count: v.cel_count, kg_amor: v.kg_amor,
        disc_realizados: v.disc_realizados, disc_ativos: v.disc_ativos,
        disc_encontros: v.disc_encontros, disc_interrompidos: v.disc_interrompidos, disc_novos: v.disc_novos,
        cons_retornantes: v.cons_retornantes, cons_acompanhamento: v.cons_acompanhamento,
        cons_integrados: v.cons_integrados, cons_novos_membros: v.cons_novos_membros,
        lid_aux_treinamento: v.lid_aux_treinamento, lid_em_formacao: v.lid_em_formacao,
        lid_potencial_multiplicador: v.lid_potencial_multiplicador, lid_observacoes: v.lid_observacoes,
        mult_filha_preparacao: v.mult_filha_preparacao, mult_nova_lideranca: v.mult_nova_lideranca,
        mult_potencial: v.mult_potencial, saude_status: v.saude_status || undefined,
        saude_comentarios: v.saude_comentarios, nec_oracao_urgente: v.nec_oracao_urgente,
        nec_visita_pastoral: v.nec_visita_pastoral, nec_problema_familiar: v.nec_problema_familiar,
        nec_problema_espiritual: v.nec_problema_espiritual, nec_encaminhar_supervisor: v.nec_encaminhar_supervisor,
      });
      await logAudit(supabase, "insert", "meeting_reports", id);
      qc.invalidateQueries({ queryKey: ["weekly-reports", cellId] });
      reset({ life_group_id: cellId, meeting_date: new Date().toISOString().slice(0,10), flowed: "null", decisions_count: 0 });
      setAttendance((rows) => rows.map((r) => ({ ...r, present: true, absence_reason: "" })));
      setVisits([]);
      alert("Relatório salvo!");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function remove(id: string) {
    if (!confirm("Apagar este relatório?")) return;
    try {
      await deleteWeeklyReport(supabase, id);
      await logAudit(supabase, "delete", "meeting_reports", id);
      qc.invalidateQueries({ queryKey: ["weekly-reports", cellId] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  const present = attendance.filter((a) => a.present);
  const membrosPres = present.filter((a) => a.kind === "membro").length;
  const freqPres = present.filter((a) => a.kind === "frequentador").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-gold" />Relatório Semanal — Life Group</CardTitle>
          <CardDescription>Selecione o Life Group pelo escopo hierárquico desejado</CardDescription>
        </CardHeader>
      </Card>

      {/* Seletor hierárquico */}
      <ScopeSelector onSelect={(id) => onPickCell(id)} />

      {cellId && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <input type="hidden" {...register("life_group_id")} value={cellId} />

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Data do encontro" error={errors.meeting_date?.message}>
                  <Input type="date" {...register("meeting_date")} />
                </Field>
                <Field label="Tema do compartilhamento">
                  <Input {...register("share_theme")} placeholder="Tema da palavra" />
                </Field>
              </div>
              <Field label="Texto bíblico">
                <Input {...register("bible_text")} placeholder="Ex: João 3:16" />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Fluiu?">
                  <select {...register("flowed")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="null">— Não informar —</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                </Field>
                <Field label="Por quê?"><Input {...register("flowed_reason")} placeholder="Motivo (opcional)" /></Field>
              </div>

              {/* Indicadores */}
              <div className="rounded-xl border-2 border-dashed border-gold/40 bg-gold/5 p-3 space-y-3">
                <Label className="block font-bold uppercase tracking-wider text-gold text-xs">Indicadores da semana</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Membros c/ discipuladores"><Input type="number" min={0} {...register("members_with_disciplers")} placeholder="0" /></Field>
                  <Field label="Decisões por Cristo"><Input type="number" min={0} {...register("decisions_count")} placeholder="0" /></Field>
                  <Field label="EBD (membros)"><Input type="number" min={0} {...register("ebd_count")} placeholder="0" /></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="C.C"><Input type="number" min={0} {...register("cc_count")} placeholder="0" /></Field>
                  <Field label="CEL"><Input type="number" min={0} {...register("cel_count")} placeholder="0" /></Field>
                  <Field label="KG do Amor (kg)"><Input type="number" step="0.5" min={0} {...register("kg_amor")} placeholder="0" /></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Oferta PIX (R$)"><Input type="number" step="0.01" min={0} {...register("oferta_pix")} placeholder="0,00" /></Field>
                  <Field label="Oferta em espécie (R$)"><Input type="number" step="0.01" min={0} {...register("oferta_especie")} placeholder="0,00" /></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 rounded-md border bg-card p-3">
                  <Field label="Houve MDA de 15 dias?">
                    <select {...register("mda_15_dias_happened")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="false">Não</option><option value="true">Sim</option>
                    </select>
                  </Field>
                  <Field label="Membros no MDA"><Input type="number" min={0} {...register("mda_15_dias_count")} placeholder="0" /></Field>
                </div>
                <div className="rounded-md border bg-card p-3 space-y-3">
                  <Field label="Houve GE?">
                    <select {...register("ge_happened")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="false">Não</option><option value="true">Sim</option>
                    </select>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Local do GE"><Input {...register("ge_location")} /></Field>
                    <Field label="Quando"><Input {...register("ge_when")} /></Field>
                  </div>
                </div>
              </div>

              {/* Seções colapsáveis */}
              <div className="space-y-2">
                <details className="rounded-xl border bg-card">
                  <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-navy">📖 Discipulado</summary>
                  <div className="border-t p-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Realizados"><Input type="number" min={0} {...register("disc_realizados")} placeholder="0" /></Field>
                      <Field label="Ativos"><Input type="number" min={0} {...register("disc_ativos")} placeholder="0" /></Field>
                      <Field label="Encontros"><Input type="number" min={0} {...register("disc_encontros")} placeholder="0" /></Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Interrompidos"><Input type="number" min={0} {...register("disc_interrompidos")} placeholder="0" /></Field>
                      <Field label="Novos iniciados"><Input type="number" min={0} {...register("disc_novos")} placeholder="0" /></Field>
                    </div>
                  </div>
                </details>

                <details className="rounded-xl border bg-card">
                  <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-navy">🤝 Consolidação</summary>
                  <div className="border-t p-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Retornantes"><Input type="number" min={0} {...register("cons_retornantes")} placeholder="0" /></Field>
                    <Field label="Em acompanhamento"><Input type="number" min={0} {...register("cons_acompanhamento")} placeholder="0" /></Field>
                    <Field label="Integrados ao LG"><Input type="number" min={0} {...register("cons_integrados")} placeholder="0" /></Field>
                    <Field label="Novos membros"><Input type="number" min={0} {...register("cons_novos_membros")} placeholder="0" /></Field>
                  </div>
                </details>

                <details className="rounded-xl border bg-card">
                  <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-navy">👑 Formação de Liderança</summary>
                  <div className="border-t p-3 space-y-3">
                    <div className="space-y-1.5">
                      <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" {...register("lid_aux_treinamento")} className="h-4 w-4 accent-gold" />Auxiliar em treinamento</label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" {...register("lid_em_formacao")} className="h-4 w-4 accent-gold" />Líder em formação</label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" {...register("lid_potencial_multiplicador")} className="h-4 w-4 accent-gold" />Potencial multiplicador</label>
                    </div>
                    <Field label="Observações"><textarea {...register("lid_observacoes")} rows={2} className="w-full rounded-md border bg-background p-2 text-sm" /></Field>
                  </div>
                </details>

                <details className="rounded-xl border bg-card">
                  <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-navy">✂️ Multiplicação</summary>
                  <div className="border-t p-3 space-y-1.5">
                    <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" {...register("mult_filha_preparacao")} className="h-4 w-4 accent-gold" />Célula filha em preparação</label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" {...register("mult_nova_lideranca")} className="h-4 w-4 accent-gold" />Nova liderança sendo preparada</label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" {...register("mult_potencial")} className="h-4 w-4 accent-gold" />Potencial de multiplicação</label>
                  </div>
                </details>

                <details className="rounded-xl border bg-card" open>
                  <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-navy">❤️ Saúde do Life Group</summary>
                  <div className="border-t p-3 space-y-3">
                    <Field label="Avaliação de saúde">
                      <select {...register("saude_status")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                        <option value="">— Não informar —</option>
                        <option value="muito_saudavel">🟢🟢 Muito saudável</option>
                        <option value="saudavel">🟢 Saudável</option>
                        <option value="atencao">🟡 Atenção</option>
                        <option value="necessita_apoio">🔴 Necessita apoio</option>
                      </select>
                    </Field>
                    <Field label="Comentários"><textarea {...register("saude_comentarios")} rows={2} className="w-full rounded-md border bg-background p-2 text-sm" /></Field>
                  </div>
                </details>

                <details className="rounded-xl border bg-card">
                  <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-navy">🙏 Necessidades Pastorais</summary>
                  <div className="border-t p-3 space-y-1.5">
                    <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" {...register("nec_oracao_urgente")} className="h-4 w-4 accent-red-500" />Pedido urgente de oração</label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" {...register("nec_visita_pastoral")} className="h-4 w-4 accent-red-500" />Necessidade de visita pastoral</label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" {...register("nec_problema_familiar")} className="h-4 w-4 accent-red-500" />Problema familiar</label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" {...register("nec_problema_espiritual")} className="h-4 w-4 accent-red-500" />Problema espiritual</label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" {...register("nec_encaminhar_supervisor")} className="h-4 w-4 accent-red-500" />Encaminhar ao supervisor</label>
                  </div>
                </details>
              </div>

              {/* Presença */}
              <div>
                <Label className="mb-2 block">Presença ({present.length}/{attendance.length} — {membrosPres} membros + {freqPres} frequentadores)</Label>
                {attendance.length === 0 && <p className="text-sm italic text-muted">Nenhum membro cadastrado neste Life Group.</p>}
                <div className="space-y-2">
                  {attendance.map((a) => (
                    <div key={a.member_id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="checkbox" checked={a.present} onChange={() => togglePresent(a.member_id)} className="h-4 w-4 accent-gold" />
                        <b className="flex-1 text-sm text-navy">{a.full_name}</b>
                        <select value={a.kind} onChange={(e) => setKind(a.member_id, e.target.value as WeeklyAttendanceKind)}
                          className="h-8 rounded border bg-background px-2 text-xs">
                          <option value="membro">Membro</option>
                          <option value="frequentador">Frequentador</option>
                        </select>
                      </div>
                      {!a.present && (
                        <Input value={a.absence_reason} onChange={(e) => setAbsence(a.member_id, e.target.value)}
                          placeholder="Motivo da falta (opcional)" className="mt-2 h-9 text-sm" />
                      )}
                      {a.present && (
                        <div className="mt-2 flex flex-wrap items-center gap-3 border-t pt-2 text-[11px]">
                          <span className="text-muted">Participou de:</span>
                          <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={a.had_mda_15_dias} onChange={() => toggleMda(a.member_id)} className="h-3.5 w-3.5 accent-gold" /><span>MDA 15 dias</span></label>
                          <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={a.had_cc} onChange={() => toggleCc(a.member_id)} className="h-3.5 w-3.5 accent-gold" /><span>CC</span></label>
                          <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={a.had_cel} onChange={() => toggleCel(a.member_id)} className="h-3.5 w-3.5 accent-gold" /><span>CEL</span></label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Visitas */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Visitas da semana ({visits.length})</Label>
                  <Button type="button" onClick={addVisit} variant="outline" size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" />Adicionar</Button>
                </div>
                <div className="space-y-2">
                  {visits.map((v) => (
                    <div key={v.id} className="rounded-lg border p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input value={v.visitor_name} onChange={(e) => updateVisit(v.id, { visitor_name: e.target.value })} placeholder="Nome do visitante" className="h-9 text-sm" />
                        <Input value={v.phone} onChange={(e) => updateVisit(v.id, { phone: e.target.value })} placeholder="Telefone" className="h-9 text-sm" />
                      </div>
                      <Input value={v.notes} onChange={(e) => updateVisit(v.id, { notes: e.target.value })} placeholder="Notas" className="mt-2 h-9 text-sm" />
                      <Button type="button" onClick={() => removeVisit(v.id)} variant="ghost" size="sm" className="mt-1 text-destructive">Remover</Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Necessidades"><Input {...register("needs")} /></Field>
              </div>
              <Field label="Observações gerais">
                <textarea {...register("summary")} rows={2} className="w-full rounded-md border bg-background p-3 text-sm" placeholder="Resumo livre do encontro" />
              </Field>

              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                <Plus className="h-4 w-4" />Salvar relatório
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Relatórios anteriores */}
      {cellId && (
        <div>
          <h3 className="mb-2 font-display text-lg text-navy">Relatórios anteriores ({reports.length})</h3>
          <div className="space-y-2">
            {reports.length === 0 && <p className="text-sm italic text-muted">Nenhum relatório salvo para este Life Group.</p>}
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <b className="text-navy">{new Date(r.meeting_date).toLocaleDateString("pt-BR")}</b>
                  {r.share_theme && <p className="text-xs text-muted">{r.share_theme}</p>}
                  <p className="mt-1 text-[11px] text-muted">
                    {r.total_present ?? r.attendance_count} presentes · {r.visitors_count} visita(s) · {r.decisions_count} decisão(ões)
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button asChild variant="outline" size="sm" className="gap-1">
                    <Link href={`/admin/relatorio/${r.id}`}><Eye className="h-3.5 w-3.5" />Ver</Link>
                  </Button>
                  <Button onClick={() => remove(r.id)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
