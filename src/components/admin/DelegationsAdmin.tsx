"use client";
import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Shield, Users, AlertTriangle, CheckCircle2, XCircle, Clock,
  Plus, Trash2, Pencil, Eye, BarChart3, Zap, RefreshCw, Lock, Search,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FichaUsuarioAdmin } from "./FichaUsuarioAdmin";
import { PerfisProntosAdmin } from "./PerfisProntosAdmin";
import { BuscaUsuariosAdmin } from "./BuscaUsuariosAdmin";
import {
  useDelegations, useCouncilMembers, useRoleDelegations,
  useEmergencyAccess, useComplianceDashboard, useModuleRanking,
  useChurches, useAllMembers, useMyProfile,
} from "@/hooks/use-queries";
import * as Del from "@/services/delegations";
import { supabase } from "@/lib/supabase/client";
import type { DelegationPanel, DelegationModule, DelegationScope, CouncilVote } from "@/types/domain";

// ── Config visual ─────────────────────────────────────────────
const MODULE_LABELS: Record<DelegationModule, string> = {
  intelligence:  "🧠 Inteligência",
  reports:       "📊 Relatórios",
  control_tower: "🗼 Torre de Controle",
  finance:       "💰 Financeiro",
  patrimony:     "🏛️ Patrimônio",
  audit:         "📋 Auditoria",
  administrativo: "⚙️ Administrativo",
  comunicacao:    "📣 Comunicação",
  documentacao:   "🗂️ Documentação",
  supervisao:     "🧭 Supervisão Ministerial",
  usuarios:       "👤 Administração de Usuários",
};
const SCOPE_LABELS: Record<string, string> = {
  lg: "Life Group", setor: "Setor", area: "Área",
  distrito: "Distrito", nucleo: "Núcleo", sede: "Sede", nacional: "Nacional",
};
const TRUST_LABELS: Record<number, string> = {
  1: "Consulta", 2: "Operacional", 3: "Gestão",
  4: "Regional", 5: "Estratégico", 6: "Nacional",
};
const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  pendente:  { color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: "⏳", label: "Pendente" },
  ativo:     { color: "bg-green-100 text-green-800 border-green-300",  icon: "✅", label: "Ativo" },
  suspensa:  { color: "bg-orange-100 text-orange-800 border-orange-300", icon: "⏸️", label: "Suspensa" },
  rejeitado: { color: "bg-red-100 text-red-800 border-red-300",        icon: "❌", label: "Rejeitado" },
  revogado:  { color: "bg-gray-100 text-gray-700 border-gray-300",     icon: "🚫", label: "Revogado" },
  expirado:  { color: "bg-orange-100 text-orange-800 border-orange-300",icon: "⏰", label: "Expirado" },
};
const VOTE_CONFIG: Record<CouncilVote, { color: string; label: string }> = {
  aprovado:   { color: "text-green-600", label: "✅ Aprovado" },
  reprovado:  { color: "text-red-600",   label: "❌ Reprovado" },
  abstencao:  { color: "text-gray-500",  label: "⚪ Abstenção" },
};
const MODULES = Object.entries(MODULE_LABELS) as [DelegationModule, string][];
const SCOPES  = Object.entries(SCOPE_LABELS);

// ── Busca de membro (por nome, resolve pra profile_id) ─────────
function MemberSearchInput({ selectedName, onSelect }: {
  selectedName: string;
  onSelect: (profileId: string, fullName: string) => void;
}) {
  const { data: members = [] } = useAllMembers();
  const [query, setQuery] = useState(selectedName);
  const [open, setOpen] = useState(false);

  const eligible = members.filter(m => !!m.profile_id);
  const filtered = query.trim().length >= 2
    ? eligible.filter(m => m.full_name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="pl-8"
          value={query}
          placeholder="Digite o nome do membro…"
          onChange={e => { setQuery(e.target.value); setOpen(true); onSelect("", e.target.value); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
          {filtered.map(m => (
            <button
              key={m.id}
              type="button"
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => { setQuery(m.full_name); setOpen(false); onSelect(m.profile_id!, m.full_name); }}
            >
              <span className="font-medium text-[#0E2A47]">{m.full_name}</span>
              {m.email && <span className="text-xs text-muted-foreground">{m.email}</span>}
            </button>
          ))}
        </div>
      )}
      {open && query.trim().length >= 2 && filtered.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover p-3 text-xs text-muted-foreground shadow-md">
          Nenhum membro com acesso ao sistema encontrado com esse nome.
          <br />Só é possível delegar pra quem já tem login (perfil) cadastrado.
        </div>
      )}
    </div>
  );
}

// ── Card de delegação ─────────────────────────────────────────
function DelegationCard({ d, isApostolo, onAction }: {
  d: DelegationPanel; isApostolo: boolean;
  onAction: (action: string, d: DelegationPanel) => void;
}) {
  const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.pendente;
  return (
    <Card className={`border-l-4 ${d.is_critical ? "border-l-red-500" : "border-l-[#C9A227]"}`}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[#0E2A47]">{d.profile_name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
                {cfg.icon} {cfg.label}
              </span>
              {d.is_critical && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-600 text-white font-bold">CRÍTICO</span>
              )}
              {d.council_pauta && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                  🗳️ Em votação
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{MODULE_LABELS[d.module]}</span>
              <span>·</span>
              <span>Nível {d.trust_level} — {TRUST_LABELS[d.trust_level]}</span>
              <span>·</span>
              <span>{SCOPE_LABELS[d.scope]}: {d.scope_name}</span>
            </div>
            {d.request_reason && (
              <p className="text-xs text-gray-600 italic">"{d.request_reason}"</p>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>👤 {d.profile_role} · {d.profile_church_name ?? "—"}</span>
              {d.requested_by_name && <span>📝 Solicitado por: {d.requested_by_name}</span>}
              {d.reviewed_by_name && <span>✅ Atribuído por: {d.reviewed_by_name}</span>}
              {d.expires_at && (
                <span className={d.days_remaining !== null && d.days_remaining < 7 ? "text-red-500 font-semibold" : ""}>
                  ⏰ Expira em {d.days_remaining ?? 0} dia(s)
                </span>
              )}
              {!d.expires_at && d.status === "ativo" && <span>♾️ Permanente</span>}
            </div>
            {/* Votos */}
            {d.council_pauta && d.votes_total > 0 && (
              <div className="flex gap-3 text-xs mt-1">
                <span className="text-green-600 font-semibold">✅ {d.votes_yes}</span>
                <span className="text-red-500 font-semibold">❌ {d.votes_no}</span>
                <span className="text-gray-500">⚪ {d.votes_abstain}</span>
                <span className="text-muted-foreground">/ {d.votes_total} voto(s)</span>
              </div>
            )}
          </div>
          {isApostolo && (
            <div className="flex flex-col gap-1 shrink-0">
              {d.status === "pendente" && (
                <>
                  <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => onAction("approve", d)}>✅ Aprovar</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-blue-400 text-blue-700"
                    onClick={() => onAction("pauta", d)}>🗳️ Pautar</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-300"
                    onClick={() => onAction("reject", d)}>❌ Rejeitar</Button>
                </>
              )}
              {d.status === "ativo" && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-700"
                    onClick={() => onAction("suspend", d)}>⏸️ Suspender</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-300"
                    onClick={() => onAction("revoke", d)}>🚫 Revogar</Button>
                </>
              )}
              {d.status === "suspensa" && (
                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => onAction("reactivate", d)}>▶️ Reativar</Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => onAction("view", d)}>👁️ Ver</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 1 — PENDENTES
// ══════════════════════════════════════════════════════════════
function PendingTab({ isApostolo, onAction }: { isApostolo: boolean; onAction: (a: string, d: DelegationPanel) => void }) {
  const { data: pending = [], isLoading } = useDelegations({ status: "pendente" });
  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>;
  return (
    <div className="space-y-3">
      {pending.length === 0 && (
        <div className="py-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-500 mb-2"/>
          <p className="font-semibold text-[#0E2A47]">Nenhuma solicitação pendente</p>
        </div>
      )}
      {pending.map(d => <DelegationCard key={d.id} d={d} isApostolo={isApostolo} onAction={onAction}/>)}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 2 — DELEGAÇÕES ATIVAS
// ══════════════════════════════════════════════════════════════
function ActiveTab({ isApostolo, onAction }: { isApostolo: boolean; onAction: (a: string, d: DelegationPanel) => void }) {
  const [moduleFilter, setModuleFilter] = useState<DelegationModule|"">("");
  const { data: active = [], isLoading } = useDelegations({ status: "ativo", module: moduleFilter||undefined });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-3">
          <Select value={moduleFilter} onValueChange={v => setModuleFilter(v as DelegationModule|"")}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Todos os módulos"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os módulos</SelectItem>
              {MODULES.map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="flex items-center text-sm text-muted-foreground">{active.length} delegação(ões) ativa(s)</span>
        </div>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      <div className="space-y-3">
        {active.map(d => <DelegationCard key={d.id} d={d} isApostolo={isApostolo} onAction={onAction}/>)}
        {!isLoading && active.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma delegação ativa.</p>}
      </div>
    </div>
  );
}

function AtribuicoesTab({ isApostolo }: { isApostolo: boolean }) {
  const [showGrant, setShowGrant] = useState(false);
  if (!isApostolo) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Apenas o Apóstolo pode atribuir delegações diretamente por aqui.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gold/30 bg-gold/5 p-4">
        <p className="text-sm text-navy">Escolha um membro e atribua uma nova delegação a ele.</p>
        <Button size="sm" className="mt-3" onClick={() => setShowGrant(true)}><Plus className="h-4 w-4 mr-1"/>Nova Atribuição</Button>
      </div>
      {showGrant && <GrantDelegationDialog onClose={() => setShowGrant(false)} />}
    </div>
  );
}

// ── Dialog: conceder nova delegação direta (busca membro + módulo) ──
export function GrantDelegationDialog({ onClose, presetProfileId, presetProfileName }: { onClose: () => void; presetProfileId?: string; presetProfileName?: string }) {
  const qc = useQueryClient();
  const [profileId, setProfileId] = useState(presetProfileId ?? "");
  const [memberName, setMemberName] = useState(presetProfileName ?? "");
  const [module, setModule] = useState<DelegationModule>("finance");
  const [level, setLevel] = useState("3");
  const [scope, setScope] = useState<DelegationScope>("nacional");
  const [scopeName, setScopeName] = useState("Nacional");
  const [reason, setReason] = useState("");
  const [expires, setExpires] = useState("");
  const [propagates, setPropagates] = useState(true);
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const { data: modulePerms = [] } = useQuery({
    queryKey: ["permissions", module], queryFn: () => Del.listPermissions(supabase, module),
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function togglePerm(key: string) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleGrant() {
    if (!profileId) { setErr("Selecione um membro na busca."); return; }
    setBusy(true); setErr("");
    try {
      const created = await Del.requestDelegation(supabase, {
        profile_id: profileId, module, trust_level: Number(level),
        scope, scope_name: scopeName,
        request_reason: reason || `Delegação concedida diretamente via painel de Governança.`,
        expires_at: expires || null,
        propagates_to_subordinates: propagates,
      });
      await Del.approveDelegation(supabase, created.id, {
        trust_level: Number(level), scope, scope_name: scopeName,
        review_notes: "Concedida diretamente (sem solicitação prévia).",
        expires_at: expires || null,
      });
      if (selectedPerms.size > 0) {
        await Del.setDelegationPermissions(supabase, created.id, Array.from(selectedPerms));
      }
      qc.invalidateQueries({ queryKey: ["delegations"] });
      onClose();
    } catch (e: unknown) {
      setErr((e as { message?: string })?.message ?? "Erro ao conceder delegação.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>➕ Nova Delegação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {presetProfileId ? (
            <div><Label className="text-xs">Membro</Label>
              <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm font-medium text-navy">{memberName}</div>
            </div>
          ) : (
            <div><Label className="text-xs">Membro *</Label>
              <MemberSearchInput selectedName={memberName} onSelect={(pid, name) => { setProfileId(pid); setMemberName(name); }} />
            </div>
          )}
          <div><Label className="text-xs">Módulo *</Label>
            <Select value={module} onValueChange={v => setModule(v as DelegationModule)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{MODULES.map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Nível *</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{Object.entries(TRUST_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{k} — {v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Escopo *</Label>
              <Select value={scope} onValueChange={v => setScope(v as DelegationScope)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{SCOPES.map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Nome do escopo</Label>
            <Input value={scopeName} onChange={e => setScopeName(e.target.value)} placeholder="Ex: Distrito Centro-Oeste"/>
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={propagates} onChange={(e) => setPropagates(e.target.checked)} className="mt-0.5" />
            Propaga para as unidades subordinadas ao escopo (ex: Distrito alcança Núcleos/Setores/Igrejas dele). Se desmarcado, vale só a unidade exata.
          </label>
          {modulePerms.length > 0 && (
            <div className="rounded-md border p-2.5">
              <Label className="text-xs">Permissões específicas (opcional)</Label>
              <p className="mb-1.5 text-[11px] text-muted-foreground">Deixe tudo desmarcado para liberar o módulo inteiro (padrão atual).</p>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {modulePerms.map((p) => (
                  <label key={p.key} className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={selectedPerms.has(p.key)} onChange={() => togglePerm(p.key)} />
                    {p.label} {p.is_write ? "" : <span className="text-muted-foreground">(leitura)</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div><Label className="text-xs">Validade (opcional)</Label>
            <Input type="date" value={expires} onChange={e => setExpires(e.target.value)}/>
            <p className="text-xs text-muted-foreground mt-1">Deixe em branco para acesso permanente.</p>
          </div>
          <div><Label className="text-xs">Observação (opcional)</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Responsável pela administração financeira da Sede." rows={2}/>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleGrant} disabled={busy || !profileId}>{busy ? "Concedendo…" : "Conceder Delegação"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 3 — CONSELHO DIRETOR
// ══════════════════════════════════════════════════════════════
function CouncilTab({ isApostolo }: { isApostolo: boolean }) {
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useCouncilMembers();
  const [showAdd, setShowAdd] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [cargo, setCargo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!profileId || !cargo) return;
    setBusy(true);
    try {
      await Del.addCouncilMember(supabase, profileId, cargo);
      qc.invalidateQueries({ queryKey: ["council-members"] });
      setShowAdd(false); setProfileId(""); setCargo("");
    } finally { setBusy(false); }
  }

  async function handleRemove(id: string) {
    if (!confirm("Remover este membro do conselho?")) return;
    await Del.removeCouncilMember(supabase, id);
    qc.invalidateQueries({ queryKey: ["council-members"] });
  }

  const active = members.filter(m => m.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{active.length}/4 membros ativos</p>
          {active.length >= 4 && <p className="text-xs text-amber-600">Conselho completo — remova um membro para adicionar outro.</p>}
        </div>
        {isApostolo && active.length < 4 && (
          <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1"/>Adicionar Diretor</Button>
        )}
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {active.map(m => (
          <Card key={m.id}>
            <CardContent className="pt-3 pb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#0E2A47]">{m.full_name}</p>
                <p className="text-xs text-muted-foreground">{m.cargo} · {m.email}</p>
              </div>
              {isApostolo && (
                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleRemove(m.id)}>
                  <Trash2 className="h-4 w-4"/>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && active.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum membro no conselho ainda.</p>
        )}
      </div>

      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Adicionar Diretor ao Conselho</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Membro</Label>
                <MemberSearchInput selectedName="" onSelect={(pid) => setProfileId(pid)} />
              </div>
              <div><Label className="text-xs">Cargo</Label>
                <Input value={cargo} onChange={e => setCargo(e.target.value) } placeholder="Ex: Diretor Financeiro Nacional"/>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
                <Button onClick={handleAdd} disabled={busy}>{busy ? "Adicionando…" : "Adicionar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 4 — ACESSO EMERGENCIAL
// ══════════════════════════════════════════════════════════════
function EmergencyTab({ isApostolo }: { isApostolo: boolean }) {
  const qc = useQueryClient();
  const { data: access = [], isLoading } = useEmergencyAccess();
  const [showForm, setShowForm] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [module, setModule]   = useState<DelegationModule>("finance");
  const [reason, setReason]   = useState("");
  const [hours, setHours]     = useState("24");
  const [busy, setBusy]       = useState(false);

  async function handleGrant() {
    if (!profileId || !reason) return;
    setBusy(true);
    const expires = new Date(Date.now() + Number(hours) * 3600000).toISOString();
    try {
      await Del.grantEmergencyAccess(supabase, { profile_id: profileId, module, reason, expires_at: expires });
      qc.invalidateQueries({ queryKey: ["emergency-access"] });
      setShowForm(false); setProfileId(""); setReason("");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500"/>
          <p className="text-sm font-medium text-[#0E2A47]">Acessos emergenciais ativos: {access.length}</p>
        </div>
        {isApostolo && (
          <Button size="sm" variant="outline" className="border-amber-400 text-amber-700"
            onClick={() => setShowForm(true)}>
            <Zap className="h-3.5 w-3.5 mr-1"/>Conceder Emergencial
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        ⚠️ O acesso emergencial é concedido em situações excepcionais: hospitalização, falecimento, afastamento repentino ou crise operacional. Toda concessão é registrada e tem validade máxima definida.
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {access.map((a: any) => (
          <Card key={a.id} className="border-l-4 border-l-amber-400">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-[#0E2A47]">{a.profile_name}</p>
                  <p className="text-xs text-muted-foreground">{MODULE_LABELS[a.module as DelegationModule]} · {a.profile_role}</p>
                  <p className="text-xs italic text-gray-600 mt-0.5">"{a.reason}"</p>
                  <p className="text-xs text-amber-700 mt-1">⏰ Expira em {a.hours_remaining} hora(s) · Aprovado por: {a.approved_by_name}</p>
                </div>
                {isApostolo && (
                  <Button size="sm" variant="ghost" className="text-red-500"
                    onClick={async () => { await Del.revokeEmergencyAccess(supabase, a.id); qc.invalidateQueries({ queryKey: ["emergency-access"] }); }}>
                    Revogar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && access.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum acesso emergencial ativo.</p>}
      </div>

      {showForm && (
        <Dialog open onOpenChange={() => setShowForm(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>⚡ Acesso Emergencial</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Membro</Label>
                <MemberSearchInput selectedName="" onSelect={(pid) => setProfileId(pid)} />
              </div>
              <div><Label className="text-xs">Módulo</Label>
                <Select value={module} onValueChange={v => setModule(v as DelegationModule)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{MODULES.map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Validade (horas)</Label><Input type="number" min="1" max="168" value={hours} onChange={e => setHours(e.target.value)}/></div>
              <div><Label className="text-xs">Justificativa *</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Descreva a situação emergencial…" rows={3}/></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleGrant} disabled={busy}>{busy ? "Concedendo…" : "Conceder Acesso"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 5 — COMPLIANCE
// ══════════════════════════════════════════════════════════════
function ComplianceTab() {
  const { data: dash, isLoading } = useComplianceDashboard();
  const { data: ranking = [] }    = useModuleRanking();

  if (isLoading || !dash) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando dashboard…</p>;

  return (
    <div className="space-y-5">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total delegações",    value: dash.total_delegacoes, color: "border-l-[#0E2A47]" },
          { label: "✅ Ativas",            value: dash.ativas,           color: "border-l-green-500" },
          { label: "⏳ Pendentes",         value: dash.pendentes,         color: "border-l-yellow-400" },
          { label: "⏰ Expiradas",         value: dash.expiradas,         color: "border-l-orange-400" },
          { label: "🔴 Críticas ativas",   value: dash.criticas_ativas,  color: "border-l-red-500" },
          { label: "⭐ Nível estratégico", value: dash.nivel_estrategico, color: "border-l-purple-500" },
          { label: "♾️ Permanentes",       value: dash.permanentes,       color: "border-l-blue-400" },
          { label: "🗳️ Em votação",        value: dash.aguardando_conselho, color: "border-l-blue-500" },
        ].map(k => (
          <Card key={k.label} className={`border-l-4 ${k.color}`}>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="font-display text-2xl font-bold text-[#0E2A47]">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertas de vencimento */}
      {(dash.vencendo_7d > 0 || dash.vencendo_15d > 0 || dash.vencendo_30d > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-orange-800 flex items-center gap-2"><Clock className="h-4 w-4"/>Delegações vencendo</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-2xl font-bold text-red-600">{dash.vencendo_7d}</p><p className="text-xs text-muted-foreground">em 7 dias</p></div>
              <div><p className="text-2xl font-bold text-orange-500">{dash.vencendo_15d}</p><p className="text-xs text-muted-foreground">em 15 dias</p></div>
              <div><p className="text-2xl font-bold text-yellow-600">{dash.vencendo_30d}</p><p className="text-xs text-muted-foreground">em 30 dias</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranking de módulos */}
      {ranking.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#C9A227]"/>Módulos mais delegados</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0E2A47] text-white text-xs">
                  <tr><th className="px-3 py-2 text-left">Módulo</th><th className="px-3 py-2 text-center">Ativas</th><th className="px-3 py-2 text-center">Pendentes</th><th className="px-3 py-2 text-center">Total</th><th className="px-3 py-2 text-center">Nível médio</th></tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr key={r.module} className={`border-t ${i%2===0?"bg-gray-50/50":""}`}>
                      <td className="px-3 py-2 font-medium">{MODULE_LABELS[r.module]}</td>
                      <td className="px-3 py-2 text-center font-bold text-green-700">{r.delegacoes_ativas}</td>
                      <td className="px-3 py-2 text-center text-yellow-600">{r.pendentes}</td>
                      <td className="px-3 py-2 text-center">{r.total_historico}</td>
                      <td className="px-3 py-2 text-center">{r.nivel_medio ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 6 — SOLICITAR (não-apóstolo)
// ══════════════════════════════════════════════════════════════
function RequestTab() {
  const [module, setModule]   = useState<DelegationModule>("reports");
  const [level, setLevel]     = useState("1");
  const [scope, setScope]     = useState<DelegationScope>("lg");
  const [scopeName, setScopeName] = useState("Meu LG");
  const [reason, setReason]   = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy]       = useState(false);
  const [sent, setSent]       = useState(false);
  const [err, setErr]         = useState("");

  async function handleSubmit() {
    if (reason.length < 20) { setErr("Justificativa muito curta (mínimo 20 caracteres)."); return; }
    setBusy(true); setErr("");
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Não autenticado");
      await Del.requestDelegation(supabase, {
        profile_id: user.id, module, trust_level: Number(level),
        scope, scope_name: scopeName, request_reason: reason,
        expires_at: expires || null,
      });
      setSent(true);
    } catch (e: unknown) {
      setErr((e as { message?: string })?.message ?? "Erro ao enviar");
    } finally { setBusy(false); }
  }

  if (sent) return (
    <div className="py-12 text-center space-y-3">
      <CheckCircle2 className="mx-auto h-12 w-12 text-green-500"/>
      <p className="font-bold text-[#0E2A47]">Solicitação enviada!</p>
      <p className="text-sm text-muted-foreground">O Administrador Nacional será notificado e avaliará sua solicitação.</p>
      <Button variant="outline" onClick={() => { setSent(false); setReason(""); }}>Nova solicitação</Button>
    </div>
  );

  return (
    <div className="max-w-md space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
        ℹ️ Sua solicitação será analisada pelo Administrador Nacional. Para módulos críticos (Financeiro, Patrimônio, Auditoria, Torre de Controle), pode ser necessária consulta ao Conselho Diretor.
      </div>
      <div><Label className="text-xs">Módulo solicitado *</Label>
        <Select value={module} onValueChange={v => setModule(v as DelegationModule)}>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>{MODULES.map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Nível solicitado *</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{Object.entries(TRUST_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{k} — {v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Escopo *</Label>
          <Select value={scope} onValueChange={v => setScope(v as DelegationScope)}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{SCOPES.map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Nome do escopo</Label>
        <Input value={scopeName} onChange={e => setScopeName(e.target.value)} placeholder="Ex: Distrito Centro-Oeste"/>
      </div>
      <div><Label className="text-xs">Validade (opcional)</Label>
        <Input type="date" value={expires} onChange={e => setExpires(e.target.value)}/>
        <p className="text-xs text-muted-foreground mt-1">Deixe em branco para solicitar acesso permanente.</p>
      </div>
      <div><Label className="text-xs">Justificativa * (mínimo 20 caracteres)</Label>
        <Textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Descreva por que precisa deste acesso e como será utilizado…" rows={4}/>
        <p className="text-xs text-muted-foreground mt-1">{reason.length} caracteres</p>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button onClick={handleSubmit} disabled={busy} className="w-full">
        {busy ? "Enviando…" : "Enviar solicitação"}
      </Button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODAIS DE AÇÃO (Aprovar / Rejeitar / Revogar / Ver)
// ══════════════════════════════════════════════════════════════
export function ActionModal({ action, delegation, onClose, onDone }: {
  action: string; delegation: DelegationPanel;
  onClose: () => void; onDone: () => void;
}) {
  const [notes, setNotes]   = useState("");
  const [level, setLevel]   = useState(String(delegation.trust_level));
  const [scope, setScope]   = useState<DelegationScope>(delegation.scope);
  const [scopeName, setScopeName] = useState(delegation.scope_name);
  const [expires, setExpires] = useState("");
  const [busy, setBusy]     = useState(false);

  async function handle() {
    setBusy(true);
    try {
      if (action === "approve") {
        await Del.approveDelegation(supabase, delegation.id, {
          trust_level: Number(level), scope, scope_name: scopeName,
          review_notes: notes, expires_at: expires || null,
        });
      } else if (action === "reject") {
        await Del.rejectDelegation(supabase, delegation.id, notes);
      } else if (action === "revoke") {
        await Del.revokeDelegation(supabase, delegation.id, notes);
      } else if (action === "suspend") {
        await Del.suspendDelegation(supabase, delegation.id, notes);
      } else if (action === "reactivate") {
        await Del.reactivateDelegation(supabase, delegation.id);
      } else if (action === "pauta") {
        await Del.pautarConselho(supabase, delegation.id);
      }
      onDone();
    } finally { setBusy(false); }
  }

  const titles: Record<string, string> = {
    approve: "✅ Aprovar Delegação",
    reject:  "❌ Rejeitar Solicitação",
    revoke:  "🚫 Revogar Delegação",
    suspend: "⏸️ Suspender Delegação",
    reactivate: "▶️ Reativar Delegação",
    pauta:   "🗳️ Pautar no Conselho",
    view:    "👁️ Detalhes da Delegação",
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{titles[action]}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-gray-50 p-3 space-y-1">
            <p><strong>Solicitante:</strong> {delegation.profile_name} ({delegation.profile_role})</p>
            <p><strong>Módulo:</strong> {MODULE_LABELS[delegation.module]}</p>
            <p><strong>Justificativa:</strong> {delegation.request_reason}</p>
            {delegation.is_critical && <p className="text-red-600 font-semibold">⚠️ Módulo Crítico</p>}
          </div>

          {action === "approve" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nível concedido</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(TRUST_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{k} — {v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Escopo</Label>
                  <Select value={scope} onValueChange={v => setScope(v as DelegationScope)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{SCOPES.map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Nome do escopo</Label>
                <Input value={scopeName} onChange={e => setScopeName(e.target.value)}/>
              </div>
              <div><Label className="text-xs">Validade (opcional)</Label>
                <Input type="date" value={expires} onChange={e => setExpires(e.target.value)}/>
                <p className="text-xs text-muted-foreground">Deixe vazio para permanente.</p>
              </div>
            </>
          )}

          {action === "pauta" && (
            <p className="text-sm text-blue-700 bg-blue-50 p-3 rounded">
              Esta solicitação será disponibilizada para votação pelos membros do Conselho Diretor. Você poderá aprovar ou rejeitar a qualquer momento, independentemente dos votos.
            </p>
          )}

          {(action === "reject" || action === "revoke" || action === "approve" || action === "suspend") && (
            <div><Label className="text-xs">{action === "approve" ? "Observações (opcional)" : action === "suspend" ? "Motivo da suspensão (opcional)" : "Justificativa *"}</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder={action === "approve" ? "Observações da diretoria…" : "Motivo da decisão…"}/>
            </div>
          )}

          {action === "view" && delegation.votes_total > 0 && (
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="font-semibold text-sm mb-2">Votos do Conselho:</p>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600 font-bold">✅ {delegation.votes_yes}</span>
                <span className="text-red-500 font-bold">❌ {delegation.votes_no}</span>
                <span className="text-gray-500">⚪ {delegation.votes_abstain}</span>
              </div>
            </div>
          )}

          {action !== "view" && (
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                className={
                  action === "approve" || action === "reactivate" ? "bg-green-600 hover:bg-green-700"
                  : action === "pauta" ? "bg-blue-600 hover:bg-blue-700"
                  : action === "suspend" ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-red-600 hover:bg-red-700"
                }
                onClick={handle} disabled={busy}>
                {busy ? "Processando…" : action === "approve" ? "Confirmar aprovação" : action === "pauta" ? "Confirmar pauta" : action === "suspend" ? "Confirmar suspensão" : action === "reactivate" ? "Confirmar reativação" : "Confirmar"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════
// MASTER — DelegationsAdmin
// ══════════════════════════════════════════════════════════════
export function DelegationsAdmin() {
  const qc = useQueryClient();
  const { data: me } = useMyProfile();
  const { data: pending = [] } = useDelegations({ status: "pendente" });
  const [modal, setModal] = useState<{ action: string; d: DelegationPanel } | null>(null);
  const [selectedUser, setSelectedUser] = useState<{ profileId: string; fullName: string } | null>(null);

  const isApostolo = me?.role === "apostolo";

  if (selectedUser) {
    return (
      <div className="space-y-5 p-4">
        <FichaUsuarioAdmin profileId={selectedUser.profileId} fullName={selectedUser.fullName} onBack={() => setSelectedUser(null)} />
      </div>
    );
  }

  function handleAction(action: string, d: DelegationPanel) {
    setModal({ action, d });
  }

  function handleDone() {
    setModal(null);
    qc.invalidateQueries({ queryKey: ["delegations"] });
    qc.invalidateQueries({ queryKey: ["compliance-dashboard"] });
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-[#C9A227]"/>
        <div>
          <h2 className="text-xl font-bold text-[#0E2A47]">Governança por Delegação</h2>
          <p className="text-xs text-muted-foreground">Controle central de autorização de acessos</p>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="buscar">🔎 Buscar Usuário</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">
            ⏳ Pendentes
            {pending.length > 0 && (
              <span className="ml-1 rounded-full bg-red-500 text-white text-xs px-1.5 py-0.5">{pending.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">✅ Ativas</TabsTrigger>
          <TabsTrigger value="atribuicoes">➕ Atribuições</TabsTrigger>
          <TabsTrigger value="council">🏛️ Conselho</TabsTrigger>
          <TabsTrigger value="emergency">⚡ Emergencial</TabsTrigger>
          <TabsTrigger value="compliance">📊 Compliance</TabsTrigger>
          <TabsTrigger value="perfis">👤 Perfis Prontos</TabsTrigger>
          {!isApostolo && <TabsTrigger value="request">📝 Solicitar</TabsTrigger>}
        </TabsList>
        <div className="mt-4">
          <TabsContent value="buscar"><BuscaUsuariosAdmin onManage={(pid, name) => setSelectedUser({ profileId: pid, fullName: name })} /></TabsContent>
          <TabsContent value="perfis"><PerfisProntosAdmin /></TabsContent>
          <TabsContent value="pending"><PendingTab isApostolo={isApostolo} onAction={handleAction}/></TabsContent>
          <TabsContent value="active"><ActiveTab isApostolo={isApostolo} onAction={handleAction}/></TabsContent>
          <TabsContent value="atribuicoes"><AtribuicoesTab isApostolo={isApostolo} /></TabsContent>
          <TabsContent value="council"><CouncilTab isApostolo={isApostolo}/></TabsContent>
          <TabsContent value="emergency"><EmergencyTab isApostolo={isApostolo}/></TabsContent>
          <TabsContent value="compliance"><ComplianceTab/></TabsContent>
          <TabsContent value="request"><RequestTab/></TabsContent>
        </div>
      </Tabs>

      {modal && (
        <ActionModal
          action={modal.action}
          delegation={modal.d}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
