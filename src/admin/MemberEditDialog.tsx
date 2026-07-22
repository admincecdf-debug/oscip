"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { X, Save, ArrowRightLeft, UserCog, History as HistoryIcon, Plus, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useChurches, useCells, useStates, useNucleos, useDistricts, useSectors, useChurchAncestry,
  useMemberRelocations, useLeadershipAssignments, useAllMembers, useMemberCard, useMemberStructureNames,
} from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { sendPasswordResetTo } from "@/services/security";
import { updateMember } from "@/services/members";
import { relocateMember } from "@/services/relocations";
import { assignLeadership, encerrarLideranca } from "@/services/leadership";
import { approveMemberCard, setCardStatusManual, CARD_STATUS_LABELS, CARD_STATUS_COLORS } from "@/services/cecId";
import { logAudit } from "@/services/audit";
import type { Member, RelocationReason, LeadershipFunction, ScopeLevel, CardStatus } from "@/types/domain";

const RELOCATION_REASONS: [RelocationReason, string][] = [
  ["correcao_cadastro","Correção de cadastro"], ["mudanca_endereco","Mudança de endereço"],
  ["transferencia_ministerial","Transferência ministerial"], ["mudanca_igreja","Mudança de igreja"],
  ["multiplicacao_lg","Multiplicação de Life Group"], ["reorganizacao_territorial","Reorganização territorial"],
  ["designacao_pastoral","Designação pastoral"], ["solicitacao_membro","Solicitação do membro"], ["outro","Outro"],
];
const JOURNEY_STAGES: [Member["journey_stage"], string][] = [
  ["visitante","Visitante"], ["novo_convertido","Novo Convertido"], ["consolidacao","Em Consolidação"],
  ["discipulado","Discípulo"], ["batismo","Batismo"], ["membro_ativo","Membro"],
  ["membro_efetivo","Membro Efetivo"], ["servo","Servo"], ["lider_formacao","Líder em Formação"],
  ["lider","Líder de Life Group"], ["diacono","Diácono(a)"],
  ["supervisor_setor","Supervisor(a) de Setor"], ["supervisor_area","Supervisor(a) de Área"],
  ["supervisor_distrito","Supervisor(a) de Distrito"], ["supervisor","Supervisor"],
  ["pastor_auxiliar","Pastor(a) Auxiliar"], ["pastor_principal","Pastor(a) Principal"],
  ["apostolo","Apóstolo(a)"], ["missionario","Missionário"],
];
const FUNCTION_LABELS: Record<LeadershipFunction, string> = {
  apostolo: "Apóstolo", pastor_principal: "Pastor Principal", pastor_auxiliar: "Pastor Auxiliar",
  pastor_distrito: "Pastor de Distrito", supervisor_distrito: "Supervisor de Distrito",
  supervisor_area: "Supervisor de Área", supervisor_setor: "Supervisor de Setor",
  lider_lg: "Líder de Life Group", lider_auxiliar: "Líder Auxiliar", diacono: "Diácono",
  lider_ministerio: "Líder de Ministério", lider_louvor: "Líder de Louvor", lider_jovens: "Líder de Jovens",
  lider_casais: "Líder de Casais", lider_infantil: "Líder Infantil", lider_evangelismo: "Líder de Evangelismo",
  lider_missoes: "Líder de Missões", outro: "Outro",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

export function MemberEditDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCog size={18} /> {member.full_name}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="pessoais" className="space-y-3">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="pessoais">Dados Pessoais</TabsTrigger>
            <TabsTrigger value="classificacao">Classificação</TabsTrigger>
            <TabsTrigger value="estrutura">Estrutura</TabsTrigger>
            <TabsTrigger value="lideranca">Liderança</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="pessoais"><PersonalDataTab member={member} /></TabsContent>
          <TabsContent value="classificacao"><ClassificationTab member={member} /></TabsContent>
          <TabsContent value="estrutura"><StructureTab member={member} onClose={onClose} /></TabsContent>
          <TabsContent value="lideranca"><LeadershipTab member={member} /></TabsContent>
          <TabsContent value="historico"><HistoryTab member={member} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Aba 1: Dados Pessoais ─────────────────────────────────────────
function PersonalDataTab({ member }: { member: Member }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      full_name: member.full_name, social_name: member.social_name ?? "",
      birth_date: member.birth_date ?? "", gender: member.gender ?? "", marital_status: member.marital_status ?? "",
      member_since: member.member_since ?? "",
      cpf: member.cpf ?? "", rg: member.rg ?? "", cnh: member.cnh ?? "",
      phone: member.phone ?? "", phone_recado: member.phone_recado ?? "", phone_recado_nome: member.phone_recado_nome ?? "",
      email: member.email ?? "", whatsapp: member.whatsapp ?? "",
      cep: member.cep ?? "", address: member.address ?? "", numero: member.numero ?? "", complemento: member.complemento ?? "",
      neighborhood: member.neighborhood ?? "", city: member.city ?? "", state: member.state ?? "",
      photo_url: member.photo_url ?? "",
    },
  });

  async function onSubmit(v: Record<string, string>) {
    setErr(""); setSaved(false);
    try {
      const payload = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val || null]));
      await updateMember(supabase, member.id, payload);
      await logAudit(supabase, "update", "members", member.id, { section: "dados_pessoais" });
      qc.invalidateQueries({ queryKey: ["all-members"] });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setErr((e as { message?: string })?.message ?? "Erro ao salvar"); }
  }

  async function handleSendReset() {
    if (!member.email) { setPwMsg("Este membro não tem e-mail cadastrado."); return; }
    setPwBusy(true); setPwMsg("");
    try {
      await sendPasswordResetTo(supabase, member.email);
      setPwMsg("Link de redefinição enviado por e-mail.");
    } catch (e) {
      setPwMsg((e as { message?: string })?.message ?? "Erro ao enviar.");
    } finally { setPwBusy(false); }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome completo"><Input {...register("full_name")} /></Field>
        <Field label="Nome social"><Input {...register("social_name")} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Data de nascimento"><Input type="date" {...register("birth_date")} /></Field>
        <Field label="Membro desde (Carteira CEC ID)"><Input type="date" {...register("member_since")} /></Field>
        <Field label="Sexo">
          <select {...register("gender")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">—</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option>
          </select>
        </Field>
        <Field label="Estado civil">
          <select {...register("marital_status")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">—</option><option value="solteiro">Solteiro(a)</option><option value="casado">Casado(a)</option>
            <option value="divorciado">Divorciado(a)</option><option value="viuvo">Viúvo(a)</option>
          </select>
        </Field>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documentos</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="CPF"><Input {...register("cpf")} placeholder="000.000.000-00" /></Field>
        <Field label="RG"><Input {...register("rg")} /></Field>
        <Field label="CNH (se houver)"><Input {...register("cnh")} /></Field>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contato</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Telefone principal"><Input {...register("phone")} /></Field>
        <Field label="WhatsApp"><Input {...register("whatsapp")} /></Field>
        <Field label="Telefone de recado"><Input {...register("phone_recado")} /></Field>
        <Field label="Nome do contato de recado"><Input {...register("phone_recado_nome")} /></Field>
        <Field label="E-mail"><Input type="email" {...register("email")} /></Field>
        <Field label="URL da foto"><Input {...register("photo_url")} placeholder="https://…" /></Field>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Endereço</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="CEP"><Input {...register("cep")} /></Field>
        <Field label="Endereço"><Input {...register("address")} /></Field>
        <Field label="Número"><Input {...register("numero")} /></Field>
        <Field label="Complemento"><Input {...register("complemento")} /></Field>
        <Field label="Bairro"><Input {...register("neighborhood")} /></Field>
        <Field label="Cidade"><Input {...register("city")} /></Field>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full gap-1.5">
        <Save size={16} /> {isSubmitting ? "Salvando…" : saved ? "Salvo!" : "Salvar dados pessoais"}
      </Button>

      <div className="rounded-md border p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Segurança da conta</p>
        <p className="mt-1 text-xs text-muted-foreground">Envia um link por e-mail pra esse membro criar uma nova senha. Você nunca vê a senha atual dele.</p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={handleSendReset} disabled={pwBusy}>
          {pwBusy ? "Enviando…" : "Enviar redefinição de senha"}
        </Button>
        {pwMsg && <p className="mt-1.5 text-xs text-muted-foreground">{pwMsg}</p>}
      </div>
    </form>
  );
}

// ── Aba 2: Classificação ───────────────────────────────────────────
function ClassificationTab({ member }: { member: Member }) {
  const qc = useQueryClient();
  const { data: card } = useMemberCard(member.id);
  const [journeyStage, setJourneyStage] = useState(member.journey_stage);
  const [status, setStatus] = useState(member.status);
  const [busy, setBusy] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true); setErr("");
    try {
      await updateMember(supabase, member.id, { journey_stage: journeyStage, status });
      await logAudit(supabase, "update", "members", member.id, { section: "classificacao", journey_stage: journeyStage, status });
      qc.invalidateQueries({ queryKey: ["all-members"] });
    } catch (e) { setErr((e as { message?: string })?.message ?? "Erro ao salvar"); }
    finally { setBusy(false); }
  }

  async function approve() {
    setCardBusy(true); setErr("");
    try {
      await approveMemberCard(supabase, member.id);
      qc.invalidateQueries({ queryKey: ["member-card", member.id] });
    } catch (e) { setErr((e as { message?: string })?.message ?? "Erro ao aprovar"); }
    finally { setCardBusy(false); }
  }
  async function toggleSuspend() {
    setCardBusy(true); setErr("");
    try {
      const next = card?.card_status === "suspensa" ? "elegivel" : "suspensa";
      await setCardStatusManual(supabase, member.id, next);
      qc.invalidateQueries({ queryKey: ["member-card", member.id] });
    } catch (e) { setErr((e as { message?: string })?.message ?? "Erro ao alterar"); }
    finally { setCardBusy(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Situação Ministerial é a etapa espiritual/ministerial da pessoa — diferente da Responsabilidade
        Institucional (aba Liderança) e do Tipo de Cadastro original do convite.
      </p>
      <Field label="Situação Ministerial">
        <select value={journeyStage} onChange={(e) => setJourneyStage(e.target.value as Member["journey_stage"])} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {JOURNEY_STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Situação do vínculo">
        <select value={status} onChange={(e) => setStatus(e.target.value as Member["status"])} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="afastado">Afastado</option>
        </select>
      </Field>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full gap-1.5"><Save size={16} /> {busy ? "Salvando…" : "Salvar classificação"}</Button>

      {card && (
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Carteirinha CEC ID</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-navy">{card.cec_id ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">{card.categoria} · {card.completion_percent}% do cadastro completo</p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${CARD_STATUS_COLORS[card.card_status]}`}>
              {CARD_STATUS_LABELS[card.card_status]}
            </span>
          </div>
          <div className="flex gap-2">
            {card.card_status === "aguardando_aprovacao" && (
              <Button size="sm" onClick={approve} disabled={cardBusy} className="gap-1.5">
                <Save size={14} /> Aprovar carteirinha
              </Button>
            )}
            {(card.card_status === "elegivel" || card.card_status === "emitida" || card.card_status === "suspensa") && (
              <Button size="sm" variant="outline" onClick={toggleSuspend} disabled={cardBusy} className="gap-1.5">
                <Ban size={14} /> {card.card_status === "suspensa" ? "Reativar" : "Suspender"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aba 3: Estrutura Organizacional (reaproveita relocate_member) ──
function StructureTab({ member, onClose }: { member: Member; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: churches = [] } = useChurches();
  const { data: cells = [] } = useCells();
  const { data: statesList = [] } = useStates();
  const { data: nucleosList = [] } = useNucleos();
  const { data: districtsList = [] } = useDistricts();
  const { data: sectorsList = [] } = useSectors();
  const { data: ancestry = [] } = useChurchAncestry();

  const [stateId, setStateId] = useState("");
  const [nucleoId, setNucleoId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [churchId, setChurchId] = useState(member.church_id ?? "");
  const [lgId, setLgId] = useState(member.life_group_id ?? "");
  const [reason, setReason] = useState<RelocationReason>("correcao_cadastro");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const ancestryByChurch = new Map(ancestry.map((a) => [a.church_id, a]));
  const nucleosOpts = stateId ? nucleosList.filter(n => n.state_id === stateId) : nucleosList;
  const districtsOpts = nucleoId ? districtsList.filter(d => d.parent_level === "nucleo" && d.parent_id === nucleoId) : districtsList;
  const sectorsOpts = districtId ? sectorsList.filter(s => s.parent_level === "distrito" && s.parent_id === districtId) : sectorsList;
  const churchesOpts = sectorId ? churches.filter(c => ancestryByChurch.get(c.id)?.sector_id === sectorId) : churches;
  const lgsOpts = churchId ? cells.filter(c => c.church_id === churchId) : cells;

  const currentChurchNameLocal = churches.find(c => c.id === member.church_id)?.name;
  const currentLgNameLocal = cells.find(c => c.id === member.life_group_id)?.name;
  const { data: resolvedNames } = useMemberStructureNames(member.id);

  // Se não achar na lista já filtrada pelo escopo, tenta a resolução real (RPC)
  // antes de assumir "sem Life Group" — a lista local pode só estar fora do escopo territorial de quem está vendo.
  const currentChurchName = currentChurchNameLocal
    ?? resolvedNames?.church_name
    ?? (member.church_id ? "Igreja fora do seu escopo de visualização" : "—");
  const currentLgName = member.life_group_id
    ? (currentLgNameLocal ?? resolvedNames?.life_group_name ?? "Life Group fora do seu escopo de visualização")
    : "sem Life Group";

  async function save() {
    if (!churchId) { setErr("Selecione a igreja de destino."); return; }
    setBusy(true); setErr("");
    try {
      await relocateMember(supabase, { member_id: member.id, to_church_id: churchId, to_life_group_id: lgId || null, reason, notes: notes || null });
      await logAudit(supabase, "update", "members", member.id, { section: "estrutura", realocado_para: churchId });
      qc.invalidateQueries({ queryKey: ["all-members"] });
      qc.invalidateQueries({ queryKey: ["member-relocations", member.id] });
      onClose();
    } catch (e) { setErr((e as { message?: string })?.message ?? "Erro ao realocar."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
        Atualmente em: <b className="text-navy">{currentChurchName}</b> · {currentLgName}
      </div>
      <Field label="Motivo da alteração">
        <select value={reason} onChange={e => setReason(e.target.value as RelocationReason)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {RELOCATION_REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Estado">
          <select value={stateId} onChange={e => { setStateId(e.target.value); setNucleoId(""); setDistrictId(""); setSectorId(""); setChurchId(""); setLgId(""); }} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
            <option value="">— Todos —</option>{statesList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.uf})</option>)}
          </select>
        </Field>
        <Field label="Núcleo">
          <select value={nucleoId} onChange={e => { setNucleoId(e.target.value); setDistrictId(""); setSectorId(""); setChurchId(""); setLgId(""); }} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
            <option value="">— Todos —</option>{nucleosOpts.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </Field>
        <Field label="Distrito">
          <select value={districtId} onChange={e => { setDistrictId(e.target.value); setSectorId(""); setChurchId(""); setLgId(""); }} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
            <option value="">— Todos —</option>{districtsOpts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Setor">
          <select value={sectorId} onChange={e => { setSectorId(e.target.value); setChurchId(""); setLgId(""); }} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
            <option value="">— Todos —</option>{sectorsOpts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Igreja Local">
          <select value={churchId} onChange={e => { setChurchId(e.target.value); setLgId(""); }} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
            <option value="">— Selecione —</option>{churchesOpts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Life Group (opcional)">
          <select value={lgId} onChange={e => setLgId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
            <option value="">— Sem célula —</option>{lgsOpts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Observações"><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" /></Field>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full gap-1.5"><ArrowRightLeft size={16} /> {busy ? "Aplicando…" : "Aplicar realocação/transferência"}</Button>
    </div>
  );
}

// ── Aba 4: Liderança e Responsabilidades ────────────────────────────
function LeadershipTab({ member }: { member: Member }) {
  const qc = useQueryClient();
  const { data: allAssignments = [] } = useLeadershipAssignments();
  const { data: churches = [] } = useChurches();
  const mine = allAssignments.filter(a => a.profile_id === member.profile_id);
  const active = mine.filter(a => a.status === "ativo");

  const [showNew, setShowNew] = useState(false);
  const [fn, setFn] = useState<LeadershipFunction>("lider_lg");
  const [churchId, setChurchId] = useState(member.church_id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!member.profile_id) {
    return <p className="text-sm italic text-muted-foreground">Essa pessoa ainda não tem acesso ao sistema (sem perfil vinculado) — não é possível atribuir liderança formal ainda.</p>;
  }

  async function designar() {
    setBusy(true); setErr("");
    try {
      await assignLeadership(supabase, { profile_id: member.profile_id!, function_type: fn, church_id: churchId || null });
      await logAudit(supabase, "insert", "leadership_assignments", member.profile_id!, { function_type: fn });
      qc.invalidateQueries({ queryKey: ["leadership-assignments"] });
      setShowNew(false);
    } catch (e) { setErr((e as { message?: string })?.message ?? "Erro ao designar (confira se já não existe Pastor Principal ativo nessa igreja)"); }
    finally { setBusy(false); }
  }
  async function encerrar(id: string) {
    if (!confirm("Encerrar essa designação?")) return;
    await encerrarLideranca(supabase, id);
    qc.invalidateQueries({ queryKey: ["leadership-assignments"] });
  }

  return (
    <div className="space-y-3">
      {active.length === 0 && <p className="text-sm italic text-muted-foreground">Nenhuma responsabilidade institucional ativa.</p>}
      {active.map(a => (
        <div key={a.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
          <div><b className="text-navy">{FUNCTION_LABELS[a.function_type]}</b>{a.church_name && <span className="ml-2 text-xs text-muted-foreground">{a.church_name}</span>}</div>
          <Button size="icon" variant="ghost" onClick={() => encerrar(a.id)} title="Encerrar"><Ban size={14} className="text-destructive" /></Button>
        </div>
      ))}
      {!showNew ? (
        <Button variant="outline" size="sm" onClick={() => setShowNew(true)} className="gap-1.5"><Plus size={14} /> Designar nova responsabilidade</Button>
      ) : (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <Field label="Função">
            <select value={fn} onChange={e => setFn(e.target.value as LeadershipFunction)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              {Object.entries(FUNCTION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Igreja">
            <select value={churchId} onChange={e => setChurchId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              <option value="">— Selecione —</option>{churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button size="sm" onClick={designar} disabled={busy} className="flex-1">{busy ? "Designando…" : "Confirmar"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aba 5: Histórico (realocações + liderança) ──────────────────────
function HistoryTab({ member }: { member: Member }) {
  const { data: relocations = [], isLoading } = useMemberRelocations(member.id);
  const { data: allAssignments = [] } = useLeadershipAssignments();
  const leadershipHistory = allAssignments.filter(a => a.profile_id === member.profile_id);

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground"><HistoryIcon size={13} /> Realocações/Transferências</p>
        {isLoading ? <p className="text-xs italic text-muted-foreground">Carregando…</p> :
          relocations.length === 0 ? <p className="text-xs italic text-muted-foreground">Nenhuma movimentação registrada.</p> :
          relocations.map(h => (
            <div key={h.id} className="mb-1.5 rounded-md border p-2 text-xs">
              <p className="font-medium text-navy">{h.from_church_name ?? "—"} → {h.to_church_name ?? "—"}</p>
              <p className="text-muted-foreground">{RELOCATION_REASONS.find(([k]) => k === h.reason)?.[1]} · {new Date(h.created_at).toLocaleDateString("pt-BR")}{h.performed_by_name ? ` · por ${h.performed_by_name}` : ""}</p>
            </div>
          ))}
      </div>
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground"><UserCog size={13} /> Designações de Liderança</p>
        {leadershipHistory.length === 0 ? <p className="text-xs italic text-muted-foreground">Nenhuma designação registrada.</p> :
          leadershipHistory.map(a => (
            <div key={a.id} className="mb-1.5 rounded-md border p-2 text-xs">
              <p className="font-medium text-navy">{FUNCTION_LABELS[a.function_type]}{a.church_name ? ` — ${a.church_name}` : ""}</p>
              <p className="text-muted-foreground">
                {new Date(a.started_at).toLocaleDateString("pt-BR")}
                {a.ended_at ? ` até ${new Date(a.ended_at).toLocaleDateString("pt-BR")}` : " (ativa)"}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
