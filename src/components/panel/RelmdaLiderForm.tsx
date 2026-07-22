"use client";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRelmdaReportFull, useCellMembers, useEvangelismGroups } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import * as Rm from "@/services/relmdaReports";
import type {
  RelmdaWeeklyReportInput, RelmdaFlow, RelmdaHealth, RelmdaNoMeetingReason,
  RelmdaVisitor, RelmdaPastoralNeed, RelmdaStatus,
} from "@/types/domain";

const STEP_LABELS = [
  "Encontro", "Pessoas", "Discipulado e MDA", "Evangelismo e TADEL",
  "Momento de Generosidade", "Saúde e Necessidades", "Revisão e Envio",
];
const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const FLOW_LABELS: Record<RelmdaFlow, string> = { muito_bem: "Muito bem", bem: "Bem", regular: "Regular", dificil: "Difícil" };
const HEALTH_LABELS: Record<RelmdaHealth, string> = { muito_saudavel: "Muito saudável", saudavel: "Saudável", atencao: "Atenção", necessita_apoio: "Necessita apoio" };
const NO_MEETING_LABELS: Record<RelmdaNoMeetingReason, string> = {
  feriado: "Feriado", evento_igreja: "Evento da Igreja", enfermidade: "Enfermidade",
  ausencia_lideranca: "Ausência de liderança", reorganizacao: "Reorganização", outro: "Outro",
};
const STATUS_LABELS: Record<RelmdaStatus, string> = {
  rascunho: "Rascunho", enviado: "Enviado", em_analise: "Em análise",
  correcao_solicitada: "Correção solicitada", corrigido: "Corrigido", validado: "Validado", encerrado: "Encerrado",
};

type FormState = RelmdaWeeklyReportInput;

export function RelmdaLiderForm({ reportId, cellName }: { reportId: string; cellName: string }) {
  const qc = useQueryClient();
  const { data: full, isLoading } = useRelmdaReportFull(reportId);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});

  const { data: cellMembers = [] } = useCellMembers(full?.report.life_group_id ?? null, null);
  const { data: allGE = [] } = useEvangelismGroups();
  const cellGEs = allGE.filter((g) => g.cell_id === full?.report.life_group_id);

  useEffect(() => {
    if (full?.report) {
      const { id: _id, created_at: _ca, updated_at: _ua, offering_total: _ot, ...rest } = full.report;
      setForm(rest);
    }
  }, [full?.report]);

  useEffect(() => {
    if (full) {
      const map: Record<string, boolean> = {};
      full.attendance.forEach((a) => { map[a.member_id] = a.present; });
      setAttendance(map);
    }
  }, [full]);

  function patch(p: Partial<FormState>) { setForm((f) => ({ ...f, ...p })); }

  async function saveDraft(silent = false) {
    setSaving(true);
    try {
      await Rm.updateReport(supabase, reportId, form);
      qc.invalidateQueries({ queryKey: ["relmda-report-full", reportId] });
      if (!silent) { setSavedMsg("Rascunho salvo."); setTimeout(() => setSavedMsg(""), 2500); }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar rascunho");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAttendance(memberId: string, present: boolean) {
    setAttendance((a) => ({ ...a, [memberId]: present }));
    try {
      await Rm.setAttendance(supabase, reportId, memberId, present);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao marcar presença");
    }
  }

  const presentesCount = Object.values(attendance).filter(Boolean).length;
  const totalMembros = full?.snapshot.total_members ?? 0;

  async function handleSend() {
    if (!confirm("Ao enviar, o relatório será encaminhado à supervisão. Alterações posteriores serão registradas no histórico.\n\nConfirmar envio?")) return;
    setSaving(true);
    try {
      await Rm.updateReport(supabase, reportId, form);
      await Rm.sendReport(supabase, reportId);
      qc.invalidateQueries({ queryKey: ["relmda-report-full", reportId] });
      alert("Relatório enviado com sucesso! A supervisão será notificada.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao enviar relatório");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !full) return <p className="p-6 text-sm text-muted-foreground">Carregando relatório…</p>;

  const locked = !["rascunho", "correcao_solicitada"].includes(full.report.status);

  return (
    <div className="mx-auto max-w-xl pb-28">
      <header className="sticky top-0 z-10 border-b bg-card/95 px-4 py-3 backdrop-blur">
        <p className="text-[11px] uppercase tracking-widest text-gold">Relatório Semanal</p>
        <h1 className="font-display text-xl text-navy">{cellName}</h1>
        <p className="text-xs text-muted-foreground">
          Semana {full.report.week_number} · {MONTH_NAMES[full.report.month - 1]}/{full.report.year} · {STATUS_LABELS[full.report.status]}
        </p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
          <div className="h-1.5 rounded-full bg-gold transition-all" style={{ width: `${(step / 7) * 100}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Etapa {step} de 7 — {STEP_LABELS[step - 1]}</p>
      </header>

      {locked && (
        <div className="m-4 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Este relatório está em <b>{STATUS_LABELS[full.report.status]}</b> e não pode mais ser editado por aqui. Consulte os dados abaixo ou aguarde a supervisão.
        </div>
      )}

      <fieldset disabled={locked} className="space-y-4 px-4 py-4">
        {step === 1 && <StepEncontro form={form} patch={patch} />}
        {step === 2 && (
          <StepPessoas
            totalMembros={totalMembros} comDiscipulador={full.snapshot.with_discipler}
            members={cellMembers} attendance={attendance} onToggle={toggleAttendance}
            presentes={presentesCount} reportId={reportId} visitors={full.visitors} qc={qc}
          />
        )}
        {step === 3 && <StepDiscipulado form={form} patch={patch} />}
        {step === 4 && <StepEvangelismo form={form} patch={patch} ges={cellGEs} />}
        {step === 5 && <StepGenerosidade form={form} patch={patch} />}
        {step === 6 && <StepSaude form={form} patch={patch} reportId={reportId} needs={full.needs} qc={qc} />}
        {step === 7 && (
          <StepRevisao form={form} totalMembros={totalMembros} presentes={presentesCount} visitantesCount={full.visitors.length} needsCount={full.needs.length} />
        )}
      </fieldset>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-card p-3">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <Button variant="outline" size="sm" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>Voltar</Button>
          {!locked && (
            <Button variant="outline" size="sm" className="flex-1" disabled={saving} onClick={() => saveDraft()}>
              {saving ? "Salvando…" : "Salvar rascunho"}
            </Button>
          )}
          {step < 7 ? (
            <Button size="sm" className="flex-1" onClick={async () => { if (!locked) await saveDraft(true); setStep((s) => Math.min(7, s + 1)); }}>
              Continuar
            </Button>
          ) : !locked ? (
            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleSend} disabled={saving}>
              Enviar relatório
            </Button>
          ) : null}
        </div>
        {savedMsg && <p className="mx-auto max-w-xl pt-1 text-center text-[11px] text-green-700">{savedMsg}</p>}
      </div>
    </div>
  );
}

// ============================================================
// ETAPA 1 — ENCONTRO
// ============================================================
function StepEncontro({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">O encontro aconteceu?</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={form.happened ? "default" : "outline"} onClick={() => patch({ happened: true })}>Sim</Button>
          <Button type="button" size="sm" variant={form.happened === false ? "default" : "outline"} onClick={() => patch({ happened: false })}>Não</Button>
        </div>
      </div>

      {form.happened === false ? (
        <>
          <div>
            <Label>Motivo</Label>
            <Select value={form.no_meeting_reason ?? ""} onValueChange={(v) => patch({ no_meeting_reason: v as RelmdaNoMeetingReason })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {Object.entries(NO_MEETING_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={form.no_meeting_note ?? ""} onChange={(e) => patch({ no_meeting_note: e.target.value })} rows={3} />
          </div>
        </>
      ) : (
        <>
          <div>
            <Label>Data do encontro</Label>
            <Input type="date" value={form.reference_date ?? ""} onChange={(e) => patch({ reference_date: e.target.value })} />
          </div>
          <div>
            <Label>Tema da Palavra</Label>
            <Input value={form.topic ?? ""} onChange={(e) => patch({ topic: e.target.value })} />
          </div>
          <div>
            <Label>Texto bíblico</Label>
            <Input value={form.bible_text ?? ""} onChange={(e) => patch({ bible_text: e.target.value })} />
          </div>
          <div>
            <Label>O encontro fluiu?</Label>
            <Select value={form.flow ?? ""} onValueChange={(v) => patch({ flow: v as RelmdaFlow })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {Object.entries(FLOW_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Resumo do encontro</Label>
            <Textarea value={form.summary ?? ""} onChange={(e) => patch({ summary: e.target.value })} rows={3} />
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// ETAPA 2 — PESSOAS
// ============================================================
function StepPessoas({
  totalMembros, comDiscipulador, members, attendance, onToggle, presentes, reportId, visitors, qc,
}: {
  totalMembros: number; comDiscipulador: number;
  members: { id: string; full_name: string }[];
  attendance: Record<string, boolean>; onToggle: (id: string, present: boolean) => void;
  presentes: number; reportId: string; visitors: RelmdaVisitor[]; qc: ReturnType<typeof useQueryClient>;
}) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [vName, setVName] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vFirst, setVFirst] = useState(true);
  const filtered = members.filter((m) => m.full_name.toLowerCase().includes(search.toLowerCase()));

  async function submitVisitor() {
    if (!vName.trim()) { alert("Informe o nome do visitante."); return; }
    try {
      await Rm.addVisitor(supabase, reportId, { full_name: vName.trim(), phone: vPhone || null, first_visit: vFirst });
      setVName(""); setVPhone(""); setVFirst(true); setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["relmda-report-full", reportId] });
    } catch (e) { alert(e instanceof Error ? e.message : "Erro ao adicionar visitante"); }
  }

  async function removeVisitor(id: string) {
    try {
      await Rm.removeVisitor(supabase, id);
      qc.invalidateQueries({ queryKey: ["relmda-report-full", reportId] });
    } catch (e) { alert(e instanceof Error ? e.message : "Erro ao remover visitante"); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border p-2"><p className="text-2xl font-bold text-navy">{totalMembros}</p><p className="text-[10px] uppercase text-muted-foreground">Membros ativos</p></div>
        <div className="rounded-md border p-2"><p className="text-2xl font-bold text-navy">{comDiscipulador}</p><p className="text-[10px] uppercase text-muted-foreground">Com discipulador</p></div>
        <div className="rounded-md border p-2"><p className="text-2xl font-bold text-navy">{totalMembros - comDiscipulador}</p><p className="text-[10px] uppercase text-muted-foreground">Sem discipulador</p></div>
      </div>

      <div>
        <Label className="mb-1 block">Quem participou do encontro?</Label>
        <div className="relative mb-2">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar membro..." className="pl-7" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
          {filtered.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40">
              <Checkbox checked={!!attendance[m.id]} onCheckedChange={(v) => onToggle(m.id, !!v)} />
              {m.full_name}
            </label>
          ))}
          {filtered.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">Nenhum membro encontrado.</p>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Presentes: <b className="text-navy">{presentes}</b> · Ausentes: <b className="text-navy">{Math.max(0, totalMembros - presentes)}</b></p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label>Visitantes ({visitors.length})</Label>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setShowAdd((s) => !s)}>
            <Plus className="h-3 w-3" />Adicionar
          </Button>
        </div>
        {showAdd && (
          <div className="mb-2 space-y-2 rounded-md border bg-muted/20 p-3">
            <Input placeholder="Nome" value={vName} onChange={(e) => setVName(e.target.value)} />
            <Input placeholder="Telefone (opcional)" value={vPhone} onChange={(e) => setVPhone(e.target.value)} />
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={vFirst} onCheckedChange={(v) => setVFirst(!!v)} />Primeira visita</label>
            <Button type="button" size="sm" className="w-full" onClick={submitVisitor}>Adicionar visitante</Button>
          </div>
        )}
        {visitors.length > 0 && (
          <ul className="divide-y rounded-md border">
            {visitors.map((v) => (
              <li key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{v.full_name}{v.first_visit && <span className="ml-1.5 rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold">1ª visita</span>}</span>
                <button onClick={() => removeVisitor(v.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ETAPA 3 — DISCIPULADO E MDA
// ============================================================
function StepDiscipulado({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-gold/30 bg-gold/5 p-2 text-xs text-navy-600">
        <b>MDA semanal</b> = quantidade de encontros de discipulado um-a-um realizados nesta semana (fora da reunião do Life Group).
      </div>
      <div><Label>MDA realizados na semana</Label><Input type="number" min={0} value={form.mda_count ?? 0} onChange={(e) => patch({ mda_count: Number(e.target.value) })} /></div>
      <div><Label>Novos discipulados iniciados</Label><Input type="number" min={0} value={form.new_discipleships ?? 0} onChange={(e) => patch({ new_discipleships: Number(e.target.value) })} /></div>
      <div><Label>Discipulados interrompidos</Label><Input type="number" min={0} value={form.interrupted_discipleships ?? 0} onChange={(e) => patch({ interrupted_discipleships: Number(e.target.value) })} /></div>
    </div>
  );
}

// ============================================================
// ETAPA 4 — EVANGELISMO E TADEL
// ============================================================
function StepEvangelismo({ form, patch, ges }: { form: FormState; patch: (p: Partial<FormState>) => void; ges: { id: string; name: string }[] }) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-navy-600">Evangelismo</p>
      <div>
        <Label className="mb-2 block">Houve GE nesta semana?</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={form.ge_happened ? "default" : "outline"} onClick={() => patch({ ge_happened: true })}>Sim</Button>
          <Button type="button" size="sm" variant={form.ge_happened === false ? "default" : "outline"} onClick={() => patch({ ge_happened: false, ge_count: 0 })}>Não</Button>
        </div>
      </div>
      {form.ge_happened && (
        <>
          <div><Label>Quantidade de GEs</Label><Input type="number" min={0} value={form.ge_count ?? 0} onChange={(e) => patch({ ge_count: Number(e.target.value) })} /></div>
          <div>
            <Label>GE relacionado</Label>
            <Select value={form.evangelism_group_id ?? ""} onValueChange={(v) => patch({ evangelism_group_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
              <SelectContent>{ges.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Pessoas alcançadas</Label><Input type="number" min={0} value={form.ge_people_reached ?? 0} onChange={(e) => patch({ ge_people_reached: Number(e.target.value) })} /></div>
          <div><Label>Decisões</Label><Input type="number" min={0} value={form.ge_decisions ?? 0} onChange={(e) => patch({ ge_decisions: Number(e.target.value) })} /></div>
        </>
      )}

      <p className="pt-2 text-xs font-bold uppercase tracking-widest text-navy-600">TADEL</p>
      <div><Label>Participantes do Life Group</Label><Input type="number" min={0} value={form.tadel_count ?? 0} onChange={(e) => patch({ tadel_count: Number(e.target.value) })} /></div>

      <p className="pt-2 text-xs font-bold uppercase tracking-widest text-navy-600">EMP — Encontro de Maturidade Pessoal</p>
      <div><Label>Participantes na semana</Label><Input type="number" min={0} value={form.emp_participants ?? 0} onChange={(e) => patch({ emp_participants: Number(e.target.value) })} /></div>
      <div><Label>Ocorrências (edições do retiro na semana)</Label><Input type="number" min={0} value={form.emp_occurrences ?? 0} onChange={(e) => patch({ emp_occurrences: Number(e.target.value) })} /></div>
    </div>
  );
}

// ============================================================
// ETAPA 5 — MOMENTO DE GENEROSIDADE
// ============================================================
function StepGenerosidade({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const total = (form.offering_pix ?? 0) + (form.offering_especie ?? 0) + (form.offering_outros ?? 0);
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-navy-600">Momento de Generosidade</p>
      <div><Label>Oferta PIX (R$)</Label><Input type="number" min={0} step="0.01" value={form.offering_pix ?? 0} onChange={(e) => patch({ offering_pix: Number(e.target.value) })} /></div>
      <div><Label>Oferta em espécie (R$)</Label><Input type="number" min={0} step="0.01" value={form.offering_especie ?? 0} onChange={(e) => patch({ offering_especie: Number(e.target.value) })} /></div>
      <div><Label>Outros meios (R$)</Label><Input type="number" min={0} step="0.01" value={form.offering_outros ?? 0} onChange={(e) => patch({ offering_outros: Number(e.target.value) })} /></div>
      {(form.offering_outros ?? 0) > 0 && (
        <div><Label>Descrição de "outros meios"</Label><Input value={form.offering_outros_desc ?? ""} onChange={(e) => patch({ offering_outros_desc: e.target.value })} /></div>
      )}
      <div className="rounded-md border bg-muted/20 p-2 text-center">
        <p className="text-[10px] uppercase text-muted-foreground">Total</p>
        <p className="text-xl font-bold text-navy">R$ {total.toFixed(2).replace(".", ",")}</p>
      </div>

      <p className="pt-2 text-xs font-bold uppercase tracking-widest text-navy-600">Ação Social</p>
      <div><Label>Kg do Amor / Cesta Básica (kg)</Label><Input type="number" min={0} step="0.1" value={form.kg_amor ?? 0} onChange={(e) => patch({ kg_amor: Number(e.target.value) })} /></div>
      <div><Label>Cestas completas</Label><Input type="number" min={0} value={form.cestas_completas ?? 0} onChange={(e) => patch({ cestas_completas: Number(e.target.value) })} /></div>
      <p className="text-[11px] text-muted-foreground">Kg e cestas não são somados num único total.</p>
    </div>
  );
}

// ============================================================
// ETAPA 6 — SAÚDE E NECESSIDADES
// ============================================================
function StepSaude({
  form, patch, reportId, needs, qc,
}: { form: FormState; patch: (p: Partial<FormState>) => void; reportId: string; needs: RelmdaPastoralNeed[]; qc: ReturnType<typeof useQueryClient> }) {
  const [showNeed, setShowNeed] = useState(false);
  const [needType, setNeedType] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [visit, setVisit] = useState(false);
  const [desc, setDesc] = useState("");

  async function submitNeed() {
    try {
      await Rm.addPastoralNeed(supabase, reportId, {
        need_type: needType || null, urgent_prayer: urgent, pastoral_visit: visit, description: desc || null,
      });
      setNeedType(""); setUrgent(false); setVisit(false); setDesc(""); setShowNeed(false);
      qc.invalidateQueries({ queryKey: ["relmda-report-full", reportId] });
    } catch (e) { alert(e instanceof Error ? e.message : "Erro ao registrar necessidade"); }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Como você avalia esta semana?</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(HEALTH_LABELS).map(([k, l]) => (
            <Button key={k} type="button" size="sm" variant={form.health_assessment === k ? "default" : "outline"} onClick={() => patch({ health_assessment: k as RelmdaHealth })}>{l}</Button>
          ))}
        </div>
      </div>
      <div><Label>Comentário</Label><Textarea value={form.health_comment ?? ""} onChange={(e) => patch({ health_comment: e.target.value })} rows={3} /></div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label>Necessidades pastorais registradas ({needs.length})</Label>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setShowNeed((s) => !s)}>
            <Plus className="h-3 w-3" />Registrar
          </Button>
        </div>
        <p className="mb-2 text-[11px] text-muted-foreground">Visível somente à liderança autorizada.</p>
        {showNeed && (
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <Input placeholder="Tipo (ex: visita, oração, saúde...)" value={needType} onChange={(e) => setNeedType(e.target.value)} />
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={urgent} onCheckedChange={(v) => setUrgent(!!v)} />Oração urgente</label>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={visit} onCheckedChange={(v) => setVisit(!!v)} />Visita pastoral</label>
            <Textarea placeholder="Descrição objetiva" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
            <Button type="button" size="sm" className="w-full" onClick={submitNeed}>Registrar necessidade</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ETAPA 7 — REVISÃO E ENVIO
// ============================================================
function StepRevisao({
  form, totalMembros, presentes, visitantesCount, needsCount,
}: { form: FormState; totalMembros: number; presentes: number; visitantesCount: number; needsCount: number }) {
  const total = (form.offering_pix ?? 0) + (form.offering_especie ?? 0) + (form.offering_outros ?? 0);
  const items: { label: string; ok: boolean }[] = [
    { label: form.happened ? "Encontro informado" : "Encontro marcado como não realizado", ok: true },
    { label: `${presentes} membros presentes`, ok: true },
    { label: `${visitantesCount} visitante(s)`, ok: true },
    { label: `${form.mda_count ?? 0} MDA`, ok: true },
    { label: `${form.ge_count ?? 0} GE`, ok: true },
    { label: `Oferta total R$ ${total.toFixed(2).replace(".", ",")}`, ok: true },
  ];
  const warnings: string[] = [];
  if (presentes > totalMembros) warnings.push(`Você marcou ${presentes} membros presentes, mas o Life Group possui ${totalMembros} membros ativos. Revise a presença.`);
  if (needsCount > 0) warnings.push(`${needsCount} necessidade(s) pastoral(is) registrada(s) — a liderança será notificada.`);
  if (form.happened && !form.topic) warnings.push("Relatório sem tema da Palavra informado.");

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-navy-600">Resumo</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />{it.label}</li>
        ))}
      </ul>
      {warnings.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
          {warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2 text-xs text-amber-800"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</p>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Ao enviar, o relatório será encaminhado à supervisão. Alterações posteriores serão registradas no histórico.</p>
    </div>
  );
}
