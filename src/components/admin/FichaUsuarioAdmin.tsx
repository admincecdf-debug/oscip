"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IdCard, Shield, Plus, X, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUsersDirectorySearch, useDelegations, useRoleDelegations } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import * as Del from "@/services/delegations";
import { DELEGATION_MODULE_LABELS } from "@/services/delegations";
import type { DelegationModule, DelegationScope, DelegationPanel } from "@/types/domain";

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  pendente:  { color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: "⏳", label: "Pendente" },
  ativo:     { color: "bg-green-100 text-green-800 border-green-300",  icon: "✅", label: "Ativo" },
  suspensa:  { color: "bg-orange-100 text-orange-800 border-orange-300", icon: "⏸️", label: "Suspensa" },
  rejeitado: { color: "bg-red-100 text-red-800 border-red-300",        icon: "❌", label: "Rejeitado" },
  revogado:  { color: "bg-gray-100 text-gray-700 border-gray-300",     icon: "🚫", label: "Revogado" },
  expirado:  { color: "bg-orange-100 text-orange-800 border-orange-300",icon: "⏰", label: "Expirado" },
};

/**
 * GOV-002 §10 — Ficha Administrativa do Usuário. Identificação
 * completa + todas as delegações da pessoa numa tela só, com ação
 * rápida de conceder uma nova delegação já aprovada.
 */
export function FichaUsuarioAdmin({ profileId, fullName, onBack }: { profileId: string; fullName: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: allUsers = [] } = useUsersDirectorySearch({ query: fullName });
  const user = allUsers.find((u) => u.profile_id === profileId);
  const { data: delegations = [], isLoading } = useDelegations({ profile_id: profileId });
  const [showNew, setShowNew] = useState(false);

  const active = delegations.filter((d) => d.status === "ativo" || d.status === "suspensa");
  const historico = delegations.filter((d) => d.status !== "ativo" && d.status !== "suspensa" && d.status !== "pendente");
  const pendentes = delegations.filter((d) => d.status === "pendente");

  async function handleSuspend(id: string) {
    if (!confirm("Suspender esta delegação?")) return;
    await Del.suspendDelegation(supabase, id);
    qc.invalidateQueries({ queryKey: ["delegations"] });
  }
  async function handleReactivate(id: string) {
    await Del.reactivateDelegation(supabase, id);
    qc.invalidateQueries({ queryKey: ["delegations"] });
  }
  async function handleRevoke(id: string) {
    const reason = prompt("Motivo da revogação:");
    if (!reason) return;
    await Del.revokeDelegation(supabase, id, reason);
    qc.invalidateQueries({ queryKey: ["delegations"] });
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-navy">← Voltar pra busca</button>

      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          {user?.photo_url ? (
            <img src={user.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-navy/10 text-navy"><IdCard className="h-6 w-6" /></div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold text-navy">{fullName}</p>
            <p className="text-sm text-muted-foreground">
              {user?.email}{user?.phone ? ` · ${user.phone}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {user?.church_name ?? "Sem igreja vinculada"}{user?.state_name ? ` · ${user.state_name}` : ""}
              {user?.cec_id ? ` · ${user.cec_id}` : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-lg text-navy"><Shield className="h-5 w-5 text-gold" />Delegações</h3>
        <Button size="sm" onClick={() => setShowNew((v) => !v)} className="gap-1.5"><Plus className="h-4 w-4" />Nova delegação</Button>
      </div>

      {showNew && <NewDelegationForm profileId={profileId} onDone={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["delegations"] }); }} onCancel={() => setShowNew(false)} />}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Aguardando aprovação</p>
              {pendentes.map((d) => <DelegationRow key={d.id} d={d} />)}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ativas ({active.length})</p>
            {active.length === 0 && <p className="text-sm italic text-muted-foreground">Nenhuma delegação ativa.</p>}
            {active.map((d) => (
              <DelegationRow key={d.id} d={d} actions={
                d.status === "ativo"
                  ? <>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-700" onClick={() => handleSuspend(d.id)}>⏸️ Suspender</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-300" onClick={() => handleRevoke(d.id)}>🚫 Revogar</Button>
                    </>
                  : <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleReactivate(d.id)}>▶️ Reativar</Button>
              } />
            ))}
          </div>

          {historico.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Histórico ({historico.length})</p>
              {historico.map((d) => <DelegationRow key={d.id} d={d} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DelegationRow({ d, actions }: { d: DelegationPanel; actions?: React.ReactNode }) {
  const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.pendente;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-navy">{DELEGATION_MODULE_LABELS[d.module as DelegationModule] ?? d.module}</p>
        <p className="truncate text-xs text-muted-foreground">{d.scope_name}{d.expires_at ? ` · até ${new Date(d.expires_at).toLocaleDateString("pt-BR")}` : ""}</p>
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
      {actions && <div className="flex shrink-0 gap-1.5">{actions}</div>}
    </div>
  );
}

function NewDelegationForm({ profileId, onDone, onCancel }: { profileId: string; onDone: () => void; onCancel: () => void }) {
  const { data: roleDelegations = [] } = useRoleDelegations();
  const profileNames = Array.from(new Set(roleDelegations.map((r) => r.role_name)));
  const [appliedProfile, setAppliedProfile] = useState("");
  const [module, setModule] = useState<DelegationModule>("reports");
  const [level, setLevel] = useState("1");
  const [scope, setScope] = useState<DelegationScope>("lg");
  const [scopeName, setScopeName] = useState("");
  const [expires, setExpires] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function applyProfile(name: string) {
    setAppliedProfile(name);
    if (!name) return;
    const rows = roleDelegations.filter((r) => r.role_name === name);
    if (rows.length === 0) return;
    // Aplica o primeiro módulo do perfil nos campos — os demais módulos do
    // mesmo perfil ficam listados abaixo pra conceder também, se quiser.
    const first = rows[0];
    setModule(first.module);
    setLevel(String(first.trust_level));
    setScope(first.scope as DelegationScope);
  }

  const profileRows = appliedProfile ? roleDelegations.filter((r) => r.role_name === appliedProfile) : [];

  async function grant() {
    if (!scopeName.trim()) { setErr("Informe a unidade de atuação (nome do escopo)."); return; }
    setBusy(true); setErr("");
    try {
      const created = await Del.requestDelegation(supabase, {
        profile_id: profileId, module, trust_level: Number(level), scope, scope_name: scopeName,
        request_reason: appliedProfile ? `Perfil pronto aplicado: ${appliedProfile}.` : "Concedida diretamente pela Ficha Administrativa do Usuário.",
        expires_at: expires || null,
      });
      await Del.approveDelegation(supabase, created.id, {
        trust_level: Number(level), scope, scope_name: scopeName, review_notes: notes || undefined,
        expires_at: expires || null,
      });
      // Se o perfil tiver mais módulos além do que está no formulário, concede os demais também,
      // reaproveitando a mesma unidade de atuação e vigência.
      const remaining = profileRows.filter((r) => r.module !== module);
      for (const r of remaining) {
        const c = await Del.requestDelegation(supabase, {
          profile_id: profileId, module: r.module, trust_level: r.trust_level, scope: r.scope as DelegationScope, scope_name: scopeName,
          request_reason: `Perfil pronto aplicado: ${appliedProfile}.`, expires_at: expires || null,
        });
        await Del.approveDelegation(supabase, c.id, { trust_level: r.trust_level, scope: r.scope as DelegationScope, scope_name: scopeName, expires_at: expires || null });
      }
      onDone();
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Erro ao conceder");
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center justify-between">Conceder nova delegação<Button size="sm" variant="ghost" onClick={onCancel}><X className="h-4 w-4" /></Button></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {profileNames.length > 0 && (
          <div className="rounded-md border border-gold/30 bg-gold/5 p-3">
            <Label className="text-xs">Aplicar perfil pronto (opcional)</Label>
            <Select value={appliedProfile} onValueChange={applyProfile}>
              <SelectTrigger><SelectValue placeholder="Nenhum — preencher manualmente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum — preencher manualmente</SelectItem>
                {profileNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            {profileRows.length > 1 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Esse perfil também concede: {profileRows.filter((r) => r.module !== module).map((r) => DELEGATION_MODULE_LABELS[r.module]).join(", ")}.
                Revise abaixo e confirme — todos serão criados com a mesma unidade de atuação.
              </p>
            )}
          </div>
        )}
        <div>
          <Label className="text-xs">Módulo</Label>
          <Select value={module} onValueChange={(v) => setModule(v as DelegationModule)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DELEGATION_MODULE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nível de confiança</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>Nível {n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Escopo</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as DelegationScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nacional">Nacional</SelectItem>
                <SelectItem value="estado">Estado</SelectItem>
                <SelectItem value="nucleo">Núcleo</SelectItem>
                <SelectItem value="distrito">Distrito</SelectItem>
                <SelectItem value="setor">Setor</SelectItem>
                <SelectItem value="igreja">Igreja</SelectItem>
                <SelectItem value="lg">Life Group</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label className="text-xs">Unidade de atuação (nome do escopo)</Label><Input value={scopeName} onChange={(e) => setScopeName(e.target.value)} placeholder="Ex: Igreja Sede, Estado SP, LG Águas Claras…" /></div>
        <div><Label className="text-xs">Vigência até (opcional)</Label><Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
        <div><Label className="text-xs">Observações (opcional)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button onClick={grant} disabled={busy} className="w-full gap-1.5"><CheckCircle2 className="h-4 w-4" />{busy ? "Concedendo…" : "Conceder delegação"}</Button>
      </CardContent>
    </Card>
  );
}
