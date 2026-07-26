"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  TrendingDown, Wrench, ClipboardList, BarChart3,
  Plus, Trash2, Check, AlertTriangle, Building2, Package,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useChurches, useAssets,
  useDepreciationSummary, useMaintenanceUpcoming, useMaintenanceHistory,
  useInventoryCampaigns, useLastInventory,
  usePatrimonyAccounting, usePatrimonyNationalSummary, usePatrimonyAlerts,
} from "@/hooks/use-queries";
import * as PA from "@/services/patrimonyAdvanced";
import { supabase } from "@/lib/supabase/client";
import type {
  AssetDepreciationSummary, MaintenanceUpcoming, AssetLastInventory,
  PatrimonyAccounting, DepreciationMethod, MaintenanceType, MaintenanceStatus, InventoryStatus,
} from "@/types/domain";

// ── Helpers ──────────────────────────────────────────────────
function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const DEPRECIATION_LABELS: Record<DepreciationMethod, string> = {
  linear: "Linear", acelerado: "Acelerado", soma_digitos: "Soma dos Dígitos",
};
const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  preventiva: "Preventiva", corretiva: "Corretiva",
  emergencial: "Emergencial", revisao: "Revisão",
};
const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  agendada: "Agendada", em_andamento: "Em Andamento",
  concluida: "Concluída", cancelada: "Cancelada",
};
const MAINTENANCE_STATUS_COLOR: Record<string, string> = {
  agendada: "bg-blue-100 text-blue-700",
  em_andamento: "bg-yellow-100 text-yellow-700",
  concluida: "bg-green-100 text-green-700",
  cancelada: "bg-gray-100 text-gray-500",
};
const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  encontrado: "✅ Encontrado", nao_encontrado: "❌ Não encontrado",
  divergente: "⚠️ Divergente", baixado: "🗑️ Baixado",
};

// ══════════════════════════════════════════════════════════════
// ABA 1 — DEPRECIAÇÃO
// ══════════════════════════════════════════════════════════════
function DepreciacaoTab({ churchFilter }: { churchFilter: string }) {
  const qc = useQueryClient();
  const { data: summary = [], isLoading } = useDepreciationSummary(churchFilter || undefined);
  const { data: assets = [] } = useAssets({ churchId: churchFilter || undefined });
  const [showForm, setShowForm] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [method, setMethod] = useState<DepreciationMethod>("linear");
  const [lifeYears, setLifeYears] = useState("");
  const [residual, setResidual] = useState("0");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0,10));
  const [busy, setBusy] = useState(false);

  const totalValor = summary.reduce((s, d) => s + (d.valor_atual_liquido ?? 0), 0);
  const totalDeprec = summary.reduce((s, d) => s + (d.depreciacao_acumulada ?? 0), 0);
  const totalAquisicao = summary.reduce((s, d) => s + (d.acquisition_value ?? 0), 0);

  async function handleSave() {
    if (!assetId || !lifeYears) return;
    setBusy(true);
    try {
      await PA.upsertDepreciation(supabase, {
        asset_id: assetId, method, useful_life_years: Number(lifeYears),
        residual_value: Number(residual), start_date: startDate,
      });
      qc.invalidateQueries({ queryKey: ["depreciation-summary"] });
      setShowForm(false); setAssetId(""); setLifeYears(""); setResidual("0");
    } finally { setBusy(false); }
  }

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Calculando depreciações…</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-[#C9A227]"><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase font-bold">Valor de Aquisição</p>
          <p className="font-display text-2xl font-bold text-[#0E2A47] mt-1">{fmt(totalAquisicao)}</p>
        </CardContent></Card>
        <Card className="border-l-4 border-l-red-400"><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase font-bold">Depreciação Acumulada</p>
          <p className="font-display text-2xl font-bold text-red-600 mt-1">{fmt(totalDeprec)}</p>
        </CardContent></Card>
        <Card className="border-l-4 border-l-green-500"><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase font-bold">Valor Líquido Atual</p>
          <p className="font-display text-2xl font-bold text-green-700 mt-1">{fmt(totalValor)}</p>
        </CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1"/>Registrar Depreciação</Button>
      </div>

      {summary.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma depreciação registrada. Clique em "Registrar Depreciação" para começar.
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {summary.map(d => {
          const pct = d.pct_depreciado ?? 0;
          const color = pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-orange-400" : pct >= 50 ? "bg-yellow-400" : "bg-green-500";
          return (
            <Card key={d.asset_id} className={`border-l-4 ${pct >= 100 ? "border-l-red-500" : pct >= 75 ? "border-l-orange-400" : "border-l-[#C9A227]"}`}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#0E2A47]">{d.asset_name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{d.category}</span>
                      {d.status_depreciacao === "totalmente_depreciado" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">Totalmente depreciado</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-gray-100">
                        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-[#0E2A47] w-12 text-right">{pct}%</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <span>📅 Início: {new Date(d.start_date).toLocaleDateString("pt-BR")}</span>
                      <span>⏱️ {d.anos_decorridos}/{d.useful_life_years} anos</span>
                      <span>💰 Aquisição: {fmt(d.acquisition_value)}</span>
                      <span>📊 Líquido: {fmt(d.valor_atual_liquido)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showForm && (
        <Dialog open onOpenChange={() => setShowForm(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Registrar Depreciação</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Bem *</Label>
                <Select value={assetId} onValueChange={setAssetId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o bem…"/></SelectTrigger>
                  <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Método *</Label>
                <Select value={method} onValueChange={v => setMethod(v as DepreciationMethod)}>
                  <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                  <SelectContent>{Object.entries(DEPRECIATION_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Vida útil (anos) *</Label>
                  <Input type="number" min="1" value={lifeYears} onChange={e => setLifeYears(e.target.value)} className="mt-1"/>
                </div>
                <div><Label className="text-xs">Valor residual (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={residual} onChange={e => setResidual(e.target.value)} className="mt-1"/>
                </div>
              </div>
              <div><Label className="text-xs">Data de início *</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1"/>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={busy || !assetId || !lifeYears}>{busy ? "Salvando…" : "Salvar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 2 — MANUTENÇÃO
// ══════════════════════════════════════════════════════════════
function ManutencaoTab({ churchFilter }: { churchFilter: string }) {
  const qc = useQueryClient();
  const { data: upcoming = [], isLoading: loadingUp } = useMaintenanceUpcoming(churchFilter || undefined);
  const { data: history  = [], isLoading: loadingHist } = useMaintenanceHistory(churchFilter || undefined);
  const { data: assets   = [] } = useAssets({ churchId: churchFilter || undefined });
  const [showForm, setShowForm] = useState(false);
  const [tab2, setTab2] = useState<"upcoming"|"history">("upcoming");
  const [form, setForm] = useState({
    asset_id: "", type: "preventiva" as MaintenanceType,
    status: "agendada" as MaintenanceStatus,
    scheduled_at: new Date().toISOString().slice(0,10),
    description: "", provider_name: "", cost: "", next_maintenance: "",
  });
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!form.asset_id || !form.description) return;
    setBusy(true);
    try {
      await PA.createMaintenance(supabase, {
        ...form,
        cost: form.cost ? Number(form.cost) : null,
        next_maintenance: form.next_maintenance || null,
        provider_name: form.provider_name || null,
      });
      qc.invalidateQueries({ queryKey: ["maintenance-upcoming"] });
      qc.invalidateQueries({ queryKey: ["maintenance-history"] });
      setShowForm(false);
    } finally { setBusy(false); }
  }

  async function concluir(id: string) {
    await PA.updateMaintenance(supabase, id, { status: "concluida", completed_at: new Date().toISOString().slice(0,10) });
    qc.invalidateQueries({ queryKey: ["maintenance-upcoming"] });
    qc.invalidateQueries({ queryKey: ["maintenance-history"] });
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta manutenção?")) return;
    await PA.deleteMaintenance(supabase, id);
    qc.invalidateQueries({ queryKey: ["maintenance-upcoming"] });
    qc.invalidateQueries({ queryKey: ["maintenance-history"] });
  }

  const vencidas = upcoming.filter(m => m.dias_para_manutencao < 0).length;

  return (
    <div className="space-y-4">
      {vencidas > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0"/>
          <p className="text-sm text-red-800"><strong>{vencidas} manutenção(ões) vencida(s)</strong> — intervenção necessária.</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button size="sm" variant={tab2==="upcoming"?"default":"outline"} onClick={() => setTab2("upcoming")}>
            Pendentes ({upcoming.length})
          </Button>
          <Button size="sm" variant={tab2==="history"?"default":"outline"} onClick={() => setTab2("history")}>
            Histórico ({history.length})
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1"/>Agendar</Button>
      </div>

      {tab2 === "upcoming" && (
        <div className="space-y-2">
          {loadingUp && <p className="text-sm text-center text-muted-foreground py-6">Carregando…</p>}
          {!loadingUp && upcoming.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">Nenhuma manutenção pendente.</p>}
          {upcoming.map(m => (
            <Card key={m.id} className={`border-l-4 ${m.dias_para_manutencao < 0 ? "border-l-red-500" : m.dias_para_manutencao <= 7 ? "border-l-yellow-400" : "border-l-blue-400"}`}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#0E2A47]">{m.asset_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${MAINTENANCE_STATUS_COLOR[m.status]}`}>
                        {MAINTENANCE_STATUS_LABELS[m.status as MaintenanceStatus]}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {MAINTENANCE_TYPE_LABELS[m.type as MaintenanceType]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>📅 {new Date(m.scheduled_at).toLocaleDateString("pt-BR")}</span>
                      {m.dias_para_manutencao < 0
                        ? <span className="text-red-600 font-semibold">⚠️ Vencida há {Math.abs(m.dias_para_manutencao)} dias</span>
                        : <span>Em {m.dias_para_manutencao} dias</span>}
                      {m.cost && <span>💰 {fmt(m.cost)}</span>}
                      {m.provider_name && <span>🔧 {m.provider_name}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="text-green-600" onClick={() => concluir(m.id)}>
                      <Check className="h-3.5 w-3.5"/>
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => excluir(m.id)}>
                      <Trash2 className="h-3.5 w-3.5"/>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab2 === "history" && (
        <div className="space-y-2">
          {loadingHist && <p className="text-sm text-center text-muted-foreground py-6">Carregando…</p>}
          {!loadingHist && history.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">Nenhuma manutenção registrada.</p>}
          {history.map(m => (
            <div key={m.id} className={`flex items-start gap-3 rounded-lg border p-3 ${m.status === "concluida" ? "bg-green-50/50" : m.status === "cancelada" ? "bg-gray-50" : "bg-white"}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[#0E2A47] text-sm">{m.asset_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${MAINTENANCE_STATUS_COLOR[m.status]}`}>
                    {MAINTENANCE_STATUS_LABELS[m.status as MaintenanceStatus]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{m.description}</p>
                <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{new Date(m.scheduled_at).toLocaleDateString("pt-BR")}</span>
                  {m.cost && <span>{fmt(m.cost)}</span>}
                  {m.provider_name && <span>{m.provider_name}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Dialog open onOpenChange={() => setShowForm(false)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Agendar Manutenção</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Bem *</Label>
                <Select value={form.asset_id} onValueChange={v => setForm(f => ({...f, asset_id:v}))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione…"/></SelectTrigger>
                  <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Tipo *</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({...f, type:v as MaintenanceType}))}>
                    <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(MAINTENANCE_TYPE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({...f, status:v as MaintenanceStatus}))}>
                    <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(MAINTENANCE_STATUS_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Descrição *</Label>
                <Input value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} className="mt-1"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Data agendada *</Label>
                  <Input type="date" value={form.scheduled_at} onChange={e => setForm(f => ({...f, scheduled_at:e.target.value}))} className="mt-1"/>
                </div>
                <div><Label className="text-xs">Custo (R$)</Label>
                  <Input type="number" step="0.01" value={form.cost} onChange={e => setForm(f => ({...f, cost:e.target.value}))} className="mt-1"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Fornecedor/Técnico</Label>
                  <Input value={form.provider_name} onChange={e => setForm(f => ({...f, provider_name:e.target.value}))} className="mt-1"/>
                </div>
                <div><Label className="text-xs">Próxima manutenção</Label>
                  <Input type="date" value={form.next_maintenance} onChange={e => setForm(f => ({...f, next_maintenance:e.target.value}))} className="mt-1"/>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={busy || !form.asset_id || !form.description}>{busy?"Salvando…":"Salvar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 3 — INVENTÁRIO
// ══════════════════════════════════════════════════════════════
function InventarioTab({ churchFilter }: { churchFilter: string }) {
  const qc = useQueryClient();
  const { data: campaigns = [], isLoading: loadingCamp } = useInventoryCampaigns(churchFilter || undefined);
  const { data: lastInv   = [], isLoading: loadingInv  } = useLastInventory(churchFilter || undefined);
  const { data: assets    = [] } = useAssets({ churchId: churchFilter || undefined });
  const { data: churches  = [] } = useChurches();
  const [tab3, setTab3] = useState<"campaigns"|"items">("campaigns");
  const [showForm, setShowForm] = useState(false);
  const [campaign, setCampaign] = useState("");
  const [churchId, setChurchId] = useState(churchFilter || "");
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0,10));
  const [assetId, setAssetId] = useState("");
  const [status, setStatus] = useState<InventoryStatus>("encontrado");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!campaign || !assetId || !churchId) return;
    setBusy(true);
    try {
      await PA.registerInventoryItem(supabase, { campaign_name: campaign, church_id: churchId, inventory_date: invDate, asset_id: assetId, status, notes: notes || null });
      qc.invalidateQueries({ queryKey: ["inventory-campaigns"] });
      qc.invalidateQueries({ queryKey: ["last-inventory"] });
      setAssetId(""); setNotes("");
    } finally { setBusy(false); }
  }

  const naoEncontrados = lastInv.filter(i => i.last_status === "nao_encontrado").length;

  return (
    <div className="space-y-4">
      {naoEncontrados > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0"/>
          <p className="text-sm text-red-800"><strong>{naoEncontrados} bem(ns) não encontrado(s)</strong> no último inventário.</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button size="sm" variant={tab3==="campaigns"?"default":"outline"} onClick={() => setTab3("campaigns")}>Campanhas</Button>
          <Button size="sm" variant={tab3==="items"?"default":"outline"} onClick={() => setTab3("items")}>Último Status</Button>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1"/>Registrar Item</Button>
      </div>

      {tab3 === "campaigns" && (
        <div className="space-y-2">
          {loadingCamp && <p className="text-sm text-center text-muted-foreground py-6">Carregando…</p>}
          {!loadingCamp && campaigns.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">Nenhuma campanha de inventário.</p>}
          {campaigns.map((c, i) => (
            <Card key={i}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0E2A47]">{c.campaign_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(c.inventory_date).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex gap-4 text-xs text-center">
                    <div><p className="font-bold text-green-600">{c.encontrados}</p><p className="text-muted-foreground">Encontrados</p></div>
                    <div><p className="font-bold text-red-600">{c.nao_encontrados}</p><p className="text-muted-foreground">Não enc.</p></div>
                    <div><p className="font-bold text-yellow-600">{c.divergentes}</p><p className="text-muted-foreground">Divergentes</p></div>
                    <div><p className="font-bold text-[#0E2A47]">{c.pct_encontrados}%</p><p className="text-muted-foreground">Conformidade</p></div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100">
                  <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${c.pct_encontrados}%` }}/>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab3 === "items" && (
        <div className="space-y-2">
          {loadingInv && <p className="text-sm text-center text-muted-foreground py-6">Carregando…</p>}
          {!loadingInv && lastInv.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">Nenhum inventário registrado.</p>}
          {lastInv.map(item => (
            <div key={item.asset_id} className={`flex items-center gap-3 rounded-lg border p-3 ${item.last_status==="encontrado"?"bg-green-50/50":item.last_status==="nao_encontrado"?"bg-red-50":"bg-yellow-50/50"}`}>
              <div className="flex-1">
                <p className="font-medium text-[#0E2A47] text-sm">{item.asset_name}</p>
                <p className="text-xs text-muted-foreground">{item.category} · {new Date(item.inventory_date).toLocaleDateString("pt-BR")}</p>
              </div>
              <span className="text-xs font-medium">{INVENTORY_STATUS_LABELS[item.last_status as InventoryStatus]}</span>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Dialog open onOpenChange={() => setShowForm(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Registrar Item de Inventário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nome da campanha *</Label>
                <Input value={campaign} onChange={e => setCampaign(e.target.value)} placeholder="Ex: Inventário 2025 - Sede AM" className="mt-1"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Comunidade *</Label>
                  <Select value={churchId} onValueChange={setChurchId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione…"/></SelectTrigger>
                    <SelectContent>{churches.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Data</Label>
                  <Input type="date" value={invDate} onChange={e => setInvDate(e.target.value)} className="mt-1"/>
                </div>
              </div>
              <div><Label className="text-xs">Bem *</Label>
                <Select value={assetId} onValueChange={setAssetId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione…"/></SelectTrigger>
                  <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Status *</Label>
                <Select value={status} onValueChange={v => setStatus(v as InventoryStatus)}>
                  <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                  <SelectContent>{Object.entries(INVENTORY_STATUS_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Observações</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1"/>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={busy || !campaign || !assetId || !churchId}>{busy?"Salvando…":"Registrar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 4 — DASHBOARD CONTÁBIL
// ══════════════════════════════════════════════════════════════
function DashboardContabilTab({ churchFilter }: { churchFilter: string }) {
  const { data: accounting = [], isLoading } = usePatrimonyAccounting(churchFilter || undefined);
  const { data: national } = usePatrimonyNationalSummary();
  const { data: alerts = [] } = usePatrimonyAlerts(churchFilter || undefined);

  const criticos = alerts.filter(a => a.severity === "critico").length;
  const atencao  = alerts.filter(a => a.severity === "atencao").length;

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Calculando…</p>;

  return (
    <div className="space-y-5">
      {/* KPIs nacionais */}
      {national && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-[#C9A227]"><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-bold">Total Bens</p>
            <p className="font-display text-2xl font-bold text-[#0E2A47] mt-1">{national.total_bens}</p>
          </CardContent></Card>
          <Card className="border-l-4 border-l-blue-500"><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-bold">Imóveis</p>
            <p className="font-display text-2xl font-bold text-[#0E2A47] mt-1">{national.total_imoveis}</p>
          </CardContent></Card>
          <Card className="border-l-4 border-l-green-500"><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-bold">Valor Líquido</p>
            <p className="font-display text-xl font-bold text-green-700 mt-1">{fmt(national.valor_liquido_total)}</p>
          </CardContent></Card>
          <Card className="border-l-4 border-l-red-400"><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-bold">Depreciação Total</p>
            <p className="font-display text-xl font-bold text-red-600 mt-1">{fmt(national.depreciacao_total)}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Alertas */}
      {alerts.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500"/>
              Alertas Patrimoniais
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{criticos} críticos</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">{atencao} atenção</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.slice(0,10).map((a, i) => (
                <div key={i} className={`flex items-start gap-3 rounded-lg border p-2.5 ${a.severity==="critico"?"bg-red-50 border-red-200":"bg-yellow-50 border-yellow-200"}`}>
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${a.severity==="critico"?"text-red-500":"text-yellow-500"}`}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0E2A47]">{a.asset_name}</p>
                    <p className="text-xs text-muted-foreground">{a.detail}</p>
                    {a.church_name && <p className="text-[11px] text-muted-foreground">{a.church_name}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela por categoria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#C9A227]"/>
            Patrimônio por Categoria e Igreja
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accounting.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum dado patrimonial encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0E2A47] text-white">
                  <tr>
                    <th className="px-3 py-2 text-left">Categoria</th>
                    <th className="px-3 py-2 text-left">Igreja</th>
                    <th className="px-2 py-2 text-center">Bens</th>
                    <th className="px-3 py-2 text-right">Aquisição</th>
                    <th className="px-3 py-2 text-right">Depreciação</th>
                    <th className="px-3 py-2 text-right">Valor Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {accounting.map((row, i) => (
                    <tr key={i} className={`border-t ${i%2===0?"bg-gray-50/50":""}`}>
                      <td className="px-3 py-2 font-medium text-[#0E2A47] capitalize">{row.category}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.church_name ?? "—"}</td>
                      <td className="px-2 py-2 text-center">{row.total_bens}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.valor_aquisicao_total)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{fmt(row.depreciacao_acumulada_total)}</td>
                      <td className="px-3 py-2 text-right font-bold text-green-700">{fmt(row.valor_atual_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MASTER — PatrimonyAdvancedAdmin
// ══════════════════════════════════════════════════════════════
export function PatrimonyAdvancedAdmin() {
  const { data: churches = [] } = useChurches();
  const [churchFilter, setChurchFilter] = useState("");

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-[#C9A227]"/>
          <div>
            <h2 className="text-xl font-bold text-[#0E2A47]">Patrimônio Avançado</h2>
            <p className="text-xs text-muted-foreground">Depreciação · Manutenção · Inventário · Dashboard Contábil</p>
          </div>
        </div>
        <Select value={churchFilter} onValueChange={setChurchFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todas as comunidades"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as comunidades</SelectItem>
            {churches.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="depreciacao">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="depreciacao" className="gap-1.5"><TrendingDown className="h-3.5 w-3.5"/>Depreciação</TabsTrigger>
          <TabsTrigger value="manutencao" className="gap-1.5"><Wrench className="h-3.5 w-3.5"/>Manutenção</TabsTrigger>
          <TabsTrigger value="inventario" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5"/>Inventário</TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5"/>Dashboard Contábil</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="depreciacao"><DepreciacaoTab churchFilter={churchFilter}/></TabsContent>
          <TabsContent value="manutencao"><ManutencaoTab churchFilter={churchFilter}/></TabsContent>
          <TabsContent value="inventario"><InventarioTab churchFilter={churchFilter}/></TabsContent>
          <TabsContent value="dashboard"><DashboardContabilTab churchFilter={churchFilter}/></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
