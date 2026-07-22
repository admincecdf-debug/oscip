"use client";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  Briefcase, Home, Boxes, Plus, Pencil, Trash2, X, FileText, Upload, AlertTriangle,
  Building2, MapPin, DollarSign, Tag, TrendingDown, Wrench, ClipboardList, BarChart3, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useChurches, useProperties, useAssets, usePropertyDocs, useAssetDocs, usePatrimonySummary,
  useDepreciationSummary, useMaintenanceUpcoming, useMaintenanceHistory,
  useInventoryCampaigns, useLastInventory,
  usePatrimonyAccounting, usePatrimonyNationalSummary, usePatrimonyAlerts,
} from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import * as PA from "@/services/patrimonyAdvanced";
import type { DepreciationMethod, MaintenanceType, MaintenanceStatus, InventoryStatus } from "@/types/domain";
import {
  createProperty, updateProperty, deleteProperty,
  createAsset, updateAsset, deleteAsset,
  uploadPatrimonyFile, getSignedUrl,
  createPropertyDoc, createPropertyDocVersion, deletePropertyDoc,
  createAssetDoc, deleteAssetDoc,
} from "@/services/patrimony";
import { logAudit } from "@/services/audit";
import { propertySchema, type PropertyInput, assetSchema, type AssetInput } from "@/schemas";
import type {
  Property, Asset, OccupationType, AssetCategory, AssetCondition, AssetOrigin,
} from "@/types/domain";

// ============================================================
// LABELS
// ============================================================
const OCCUPATION_LABELS: Record<OccupationType, string> = {
  proprio: "Próprio", alugado: "Alugado", cedido: "Cedido",
  comodato: "Comodato", em_regularizacao: "Em Regularização",
};
const OCCUPATION_COLOR: Record<OccupationType, string> = {
  proprio: "bg-green-50 text-green-700 border-green-200",
  alugado: "bg-blue-50 text-blue-700 border-blue-200",
  cedido: "bg-purple-50 text-purple-700 border-purple-200",
  comodato: "bg-yellow-50 text-yellow-700 border-yellow-200",
  em_regularizacao: "bg-orange-50 text-orange-700 border-orange-200",
};
const CATEGORY_LABELS: Record<AssetCategory, string> = {
  mobiliario: "Mobiliário", equipamentos: "Equipamentos",
  som_multimidia: "Som e Multimídia", infraestrutura: "Infraestrutura",
  nao_duravel: "Não Durável",
};
const CONDITION_LABELS: Record<AssetCondition, string> = {
  novo: "Novo", otimo: "Ótimo", bom: "Bom", regular: "Regular",
  ruim: "Ruim", inutilizado: "Inutilizado", baixado: "Baixado",
};
const CONDITION_COLOR: Record<AssetCondition, string> = {
  novo: "bg-green-100 text-green-800 border-green-300",
  otimo: "bg-green-50 text-green-700 border-green-200",
  bom: "bg-blue-50 text-blue-700 border-blue-200",
  regular: "bg-yellow-50 text-yellow-700 border-yellow-200",
  ruim: "bg-orange-50 text-orange-700 border-orange-200",
  inutilizado: "bg-red-50 text-red-700 border-red-200",
  baixado: "bg-gray-100 text-gray-600 border-gray-300",
};
const ORIGIN_LABELS: Record<AssetOrigin, string> = {
  compra_nf: "Compra com NF", doacao: "Doação", sem_nf: "Sem NF",
  transferencia: "Transferência", comodato: "Comodato", outro: "Outro",
};

// ============================================================
// MASTER
// ============================================================
export function PatrimonyAdmin({ initialChurchId = "" }: { initialChurchId?: string } = {}) {
  const { data: churches = [] } = useChurches();
  const { data: summary = [] } = usePatrimonySummary();
  const [churchFilter, setChurchFilter] = useState(initialChurchId);

  const totalProperties = summary.reduce((s, x) => s + x.properties_count, 0);
  const totalAssets = summary.reduce((s, x) => s + x.assets_count, 0);
  const totalValue = summary.reduce((s, x) => s + Number(x.total_acquisition_value || 0), 0);
  const expiringSoon = summary.reduce((s, x) => s + x.contracts_expiring_90d, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-gold" />Patrimônio
              </CardTitle>
              <CardDescription>Imóveis · Bens · Depreciação · Manutenção · Inventário · Dashboard Contábil</CardDescription>
            </div>
            <Select value={churchFilter} onValueChange={setChurchFilter}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Todas as comunidades" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as comunidades</SelectItem>
                {churches.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {expiringSoon > 0 && (
            <div className="mb-3 rounded-md border-l-4 border-l-red-500 bg-red-50 p-3 text-sm text-red-800">
              <b className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{expiringSoon} contrato(s) vencendo nos próximos 90 dias.</b>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-4">
            <Kpi icon={<Home />} label="Imóveis" value={totalProperties} />
            <Kpi icon={<Boxes />} label="Bens" value={totalAssets} />
            <Kpi icon={<DollarSign />} label="Valor patrimonial" value={`R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
            <Kpi icon={<Building2 />} label="Comunidades cobertas" value={summary.filter(s => s.properties_count > 0 || s.assets_count > 0).length} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="properties">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="properties"><Home className="mr-1 h-4 w-4" />Imóveis</TabsTrigger>
          <TabsTrigger value="assets"><Boxes className="mr-1 h-4 w-4" />Bens</TabsTrigger>
          <TabsTrigger value="depreciacao"><TrendingDown className="mr-1 h-4 w-4" />Depreciação</TabsTrigger>
          <TabsTrigger value="manutencao"><Wrench className="mr-1 h-4 w-4" />Manutenção</TabsTrigger>
          <TabsTrigger value="inventario"><ClipboardList className="mr-1 h-4 w-4" />Inventário</TabsTrigger>
          <TabsTrigger value="dashboard"><BarChart3 className="mr-1 h-4 w-4" />Dashboard Contábil</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="properties"><PropertiesSection churches={churches} initialChurchId={initialChurchId} /></TabsContent>
          <TabsContent value="assets"><AssetsSection churches={churches} initialChurchId={initialChurchId} /></TabsContent>
          <TabsContent value="depreciacao"><DepreciacaoTab churchFilter={churchFilter} /></TabsContent>
          <TabsContent value="manutencao"><ManutencaoTab churchFilter={churchFilter} /></TabsContent>
          <TabsContent value="inventario"><InventarioTab churchFilter={churchFilter} /></TabsContent>
          <TabsContent value="dashboard"><DashboardContabilTab churchFilter={churchFilter} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-l-4 border-l-gold bg-card p-3">
      <div className="flex items-center gap-2 text-navy-600">
        <span className="text-gold [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <p className="text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-1 font-display text-xl text-navy">{value}</p>
    </div>
  );
}

// ============================================================
// SEÇÃO: IMÓVEIS
// ============================================================
function PropertiesSection({ churches, initialChurchId = "" }: { churches: { id: string; name: string }[]; initialChurchId?: string }) {
  const [churchFilter, setChurchFilter] = useState<string>(initialChurchId || churches[0]?.id || "");
  const [editing, setEditing] = useState<Property | null>(null);
  const [creating, setCreating] = useState(false);
  const [openProperty, setOpenProperty] = useState<Property | null>(null);
  const { data: properties = [] } = useProperties(churchFilter || null);
  const qc = useQueryClient();

  async function remove(p: Property) {
    if (!confirm(`Remover imóvel "${p.name}"? Isso o desativa (não apaga o histórico).`)) return;
    try {
      await deleteProperty(supabase, p.id);
      await logAudit(supabase, "delete", "properties", p.id, { name: p.name });
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["patrimony-summary"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {churches.length > 1 && (
          <div className="min-w-[200px]">
            <Label className="mb-1 block text-xs uppercase tracking-wider text-muted">Comunidade</Label>
            <select value={churchFilter} onChange={(e) => setChurchFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <Button onClick={() => setCreating(true)} className="gap-1.5"><Plus className="h-4 w-4" />Novo imóvel</Button>
      </div>

      {(editing || creating) && (
        <PropertyForm churches={churches} editing={editing} defaultChurchId={churchFilter}
          onClose={() => { setEditing(null); setCreating(false); }} />
      )}

      {openProperty && (
        <PropertyDetail property={openProperty} onClose={() => setOpenProperty(null)} />
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {properties.length === 0 && (
          <p className="col-span-full text-sm italic text-muted">Nenhum imóvel cadastrado.</p>
        )}
        {properties.map(p => <PropertyCard key={p.id} property={p}
          onEdit={() => { setEditing(p); setCreating(false); }}
          onOpen={() => setOpenProperty(p)}
          onRemove={() => remove(p)} />)}
      </div>
    </div>
  );
}

function PropertyCard({ property: p, onEdit, onOpen, onRemove }: { property: Property; onEdit: () => void; onOpen: () => void; onRemove: () => void }) {
  const daysUntilEnd = p.contract_end_at
    ? Math.floor((new Date(p.contract_end_at).getTime() - Date.now()) / 86400000)
    : null;
  const isExpiringSoon = daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= 90;

  return (
    <Card className={isExpiringSoon ? "border-l-4 border-l-red-400" : "border-l-4 border-l-gold"}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onOpen} className="min-w-0 flex-1 text-left">
            <b className="block truncate text-navy">{p.name}</b>
            <span className={`mt-1 inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${OCCUPATION_COLOR[p.occupation_type]}`}>
              {OCCUPATION_LABELS[p.occupation_type]}
            </span>
            {(p.city || p.state) && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted">
                <MapPin className="h-3 w-3" />{[p.city, p.state].filter(Boolean).join(", ")}
              </p>
            )}
            {isExpiringSoon && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-red-700">
                <AlertTriangle className="h-3 w-3" />Contrato vence em {daysUntilEnd} dia(s)
              </p>
            )}
          </button>
          <div className="flex shrink-0 gap-1">
            <Button onClick={onEdit} variant="outline" size="sm" className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
            <Button onClick={onRemove} variant="destructive" size="sm" className="h-7 w-7 p-0"><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PropertyForm({ churches, editing, defaultChurchId, onClose }: {
  churches: { id: string; name: string }[];
  editing: Property | null;
  defaultChurchId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<PropertyInput>({
      resolver: zodResolver(propertySchema),
      defaultValues: editing ? {
        church_id: editing.church_id, name: editing.name,
        occupation_type: editing.occupation_type,
        cep: editing.cep ?? "", state: editing.state ?? "", city: editing.city ?? "",
        neighborhood: editing.neighborhood ?? "", address: editing.address ?? "",
        numero: editing.numero ?? "", complemento: editing.complemento ?? "",
        acquired_at: editing.acquired_at ?? "", contract_end_at: editing.contract_end_at ?? "",
        iptu_due_at: editing.iptu_due_at ?? "",
        owner_name: editing.owner_name ?? "", owner_document: editing.owner_document ?? "",
        owner_phone: editing.owner_phone ?? "",
        observations: editing.observations ?? "",
      } : { church_id: defaultChurchId, occupation_type: "proprio" },
    });

  const occupation = watch("occupation_type");
  const isRentedOrLent = occupation === "alugado" || occupation === "comodato" || occupation === "cedido";

  async function onSubmit(v: PropertyInput) {
    setErr("");
    try {
      const payload = {
        church_id: v.church_id, name: v.name, occupation_type: v.occupation_type,
        cep: v.cep || null, state: v.state || null, city: v.city || null,
        neighborhood: v.neighborhood || null, address: v.address || null,
        numero: v.numero || null, complemento: v.complemento || null,
        acquired_at: v.acquired_at || null,
        contract_end_at: v.contract_end_at || null,
        iptu_due_at: v.iptu_due_at || null,
        owner_name: v.owner_name || null, owner_document: v.owner_document || null,
        owner_phone: v.owner_phone || null,
        observations: v.observations || null,
      };
      if (editing) {
        await updateProperty(supabase, editing.id, payload);
        await logAudit(supabase, "update", "properties", editing.id, { name: v.name });
      } else {
        const created = await createProperty(supabase, payload);
        await logAudit(supabase, "insert", "properties", created.id, { name: v.name });
      }
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["patrimony-summary"] });
      onClose();
    } catch (e: unknown) {
      console.error("[PropertyForm]", e);
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  return (
    <Card className="border-2 border-dashed border-gold/40 bg-gold/5">
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="flex items-center justify-between">
            <b className="text-navy">{editing ? "Editar imóvel" : "Novo imóvel"}</b>
            <Button type="button" onClick={onClose} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Fechar</Button>
          </div>

          {churches.length > 1 && (
            <Field label="Comunidade"><select {...register("church_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></Field>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome / identificação" error={errors.name?.message}>
              <Input {...register("name")} placeholder="Ex: Templo Central CEC Manaus" />
            </Field>
            <Field label="Tipo de ocupação">
              <select {...register("occupation_type")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {Object.entries(OCCUPATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>

          <div className="rounded-md border bg-card p-3 space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-navy-600">Endereço</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="CEP" error={errors.cep?.message}>
                <Input {...register("cep")} placeholder="00000-000" maxLength={9} />
              </Field>
              <Field label="Estado"><Input {...register("state")} placeholder="AM" maxLength={3} /></Field>
              <Field label="Cidade"><Input {...register("city")} /></Field>
            </div>
            <Field label="Bairro"><Input {...register("neighborhood")} /></Field>
            <Field label="Logradouro"><Input {...register("address")} placeholder="Rua, Av..." /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Número"><Input {...register("numero")} /></Field>
              <Field label="Complemento"><Input {...register("complemento")} /></Field>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Data de aquisição/ocupação" error={errors.acquired_at?.message}>
              <Input type="date" {...register("acquired_at")} />
            </Field>
            <Field label="Vencimento de contrato" error={errors.contract_end_at?.message}>
              <Input type="date" {...register("contract_end_at")} />
            </Field>
            <Field label="Vencimento do IPTU" error={errors.iptu_due_at?.message}>
              <Input type="date" {...register("iptu_due_at")} />
            </Field>
          </div>

          {isRentedOrLent && (
            <div className="rounded-md border bg-card p-3 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-navy-600">Dados do proprietário</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome"><Input {...register("owner_name")} /></Field>
                <Field label="CPF/CNPJ"><Input {...register("owner_document")} /></Field>
              </div>
              <Field label="Telefone"><Input {...register("owner_phone")} placeholder="(00) 00000-0000" /></Field>
            </div>
          )}

          <Field label="Observações">
            <textarea {...register("observations")} rows={2} className="w-full rounded-md border bg-background p-2 text-sm" />
          </Field>

          {err && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? "Salvando…" : (editing ? "Salvar alterações" : "Criar imóvel")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================
// ACERVO DOCUMENTAL — IMÓVEIS (com metadados expandidos)
// ============================================================
const PROPERTY_DOC_TYPES = [
  ["escritura", "Escritura"], ["cessao_direitos", "Cessão de Direitos"],
  ["procuracao", "Procuração"], ["contrato_compra_venda", "Contrato de Compra e Venda"],
  ["matricula", "Matrícula Atualizada"], ["certidao_onus", "Certidão de Ônus Reais"],
  ["habite_se", "Habite-se"], ["iptu", "IPTU"], ["planta", "Planta do Imóvel"],
  ["memorial_descritivo", "Memorial Descritivo"], ["laudo_tecnico", "Laudo Técnico"],
  ["contrato_locacao", "Contrato de Locação"], ["comodato", "Comodato"],
  ["alvara", "Alvará"], ["outro", "Outro"],
] as const;

function PropertyDocUploaderForm({ propertyId, churchId, onSaved }: {
  propertyId: string; churchId: string; onSaved: () => void;
}) {
  const [docType, setDocType] = useState<string>(PROPERTY_DOC_TYPES[0][0]);
  const [title, setTitle] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [issuingBody, setIssuingBody] = useState("");
  const [observations, setObservations] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    if (!file) { setErr("Selecione um arquivo PDF."); return; }
    if (!title.trim()) { setErr("Informe um título."); return; }
    setBusy(true); setErr("");
    try {
      const up = await uploadPatrimonyFile(supabase, churchId, `properties/${propertyId}`, file);
      await createPropertyDoc(supabase, {
        property_id: propertyId, doc_type: docType, title: title.trim(),
        storage_path: up.path, size_bytes: up.size, mime_type: up.mime,
        doc_number: docNumber || null,
        issued_at: issuedAt || null,
        expires_at: expiresAt || null,
        issuing_body: issuingBody || null,
        observations: observations || null,
      });
      setFile(null); setTitle(""); setDocNumber(""); setIssuedAt("");
      setExpiresAt(""); setIssuingBody(""); setObservations("");
      setDocType(PROPERTY_DOC_TYPES[0][0]);
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro no upload");
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-md border-2 border-dashed border-gold/30 bg-gold/5 p-3 space-y-3">
      <Label className="block text-xs font-bold uppercase tracking-wider text-gold">Adicionar ao Acervo Documental</Label>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Tipo de documento">
          <select value={docType} onChange={(e) => setDocType(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            {PROPERTY_DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Título *">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Escritura do Templo Sede" />
        </Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Número do documento">
          <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="Ex: 12345/2020" />
        </Field>
        <Field label="Data de emissão">
          <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
        </Field>
        <Field label="Data de validade">
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </Field>
      </div>

      <Field label="Órgão emissor">
        <Input value={issuingBody} onChange={(e) => setIssuingBody(e.target.value)} placeholder="Ex: Cartório do 3º Ofício, Prefeitura Municipal..." />
      </Field>

      <Field label="Observações">
        <Input value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Notas adicionais (opcional)" />
      </Field>

      <Field label="Arquivo (PDF) *">
        <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>

      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button onClick={go} disabled={busy} size="sm" className="gap-1.5">
        <Upload className="h-3.5 w-3.5" />{busy ? "Enviando…" : "Salvar no Acervo"}
      </Button>
      <p className="text-[10px] text-muted">Apenas PDF. Limite 20 MB.</p>
    </div>
  );
}

function PropertyDocRow({ doc, onDelete, onNewVersion }: {
  doc: import("@/types/domain").PropertyDocument;
  onDelete: () => void;
  onNewVersion: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const today = new Date();
  const expiresAt = doc.expires_at ? new Date(doc.expires_at) : null;
  const daysLeft = expiresAt ? Math.floor((expiresAt.getTime() - today.getTime()) / 86400000) : null;
  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 90;
  const isExpired = daysLeft !== null && daysLeft < 0;

  async function openDoc() {
    if (!doc.storage_path) return;
    setBusy(true);
    try {
      const url = await getSignedUrl(supabase, doc.storage_path, 600);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally { setBusy(false); }
  }

  const docTypeLabel = PROPERTY_DOC_TYPES.find(([v]) => v === doc.doc_type)?.[1] ?? doc.doc_type;

  return (
    <div className={`rounded-md border p-3 ${isExpired ? "border-l-4 border-l-red-500 bg-red-50/30" : isExpiringSoon ? "border-l-4 border-l-yellow-400 bg-yellow-50/30" : "bg-card"}`}>
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 shrink-0 text-gold mt-0.5" />
        <div className="min-w-0 flex-1">
          <button onClick={openDoc} disabled={busy} className="block text-left text-sm font-semibold text-navy hover:underline">
            {busy ? "Abrindo…" : doc.title}
          </button>
          <p className="text-[10px] uppercase tracking-wider text-muted mt-0.5">
            {docTypeLabel}{doc.doc_number ? ` · Nº ${doc.doc_number}` : ""}{doc.version > 1 ? ` · v${doc.version}` : ""}
          </p>
          <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-muted">
            {doc.issued_at && <span>Emitido: {new Date(doc.issued_at).toLocaleDateString("pt-BR")}</span>}
            {doc.issuing_body && <span>{doc.issuing_body}</span>}
          </div>
          {expiresAt && (
            <p className={`mt-1 text-[11px] font-bold flex items-center gap-1 ${isExpired ? "text-red-700" : isExpiringSoon ? "text-yellow-700" : "text-muted"}`}>
              {(isExpired || isExpiringSoon) && <AlertTriangle className="h-3 w-3" />}
              {isExpired
                ? `Venceu há ${Math.abs(daysLeft!)} dia(s)`
                : isExpiringSoon
                  ? `Vence em ${daysLeft} dia(s)`
                  : `Válido até ${expiresAt.toLocaleDateString("pt-BR")}`}
            </p>
          )}
          {doc.observations && <p className="mt-1 text-[11px] italic text-muted">{doc.observations}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button onClick={onNewVersion} variant="outline" size="sm" className="h-7 px-2 text-[10px]" title="Nova versão">
            v+
          </Button>
          <Button onClick={onDelete} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PropertyDetail({ property: p, onClose }: { property: Property; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: docs = [] } = usePropertyDocs(p.id);
  const [newVersionFor, setNewVersionFor] = useState<import("@/types/domain").PropertyDocument | null>(null);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["property-docs", p.id] });
  }

  return (
    <Card className="border-2 border-navy/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{p.name}</CardTitle>
          <Button onClick={onClose} variant="ghost" size="sm"><X className="h-3.5 w-3.5" /></Button>
        </div>
        <CardDescription>Acervo Patrimonial Digital — documentação jurídica e administrativa do imóvel</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <PropertyDocUploaderForm propertyId={p.id} churchId={p.church_id} onSaved={refresh} />

        <div className="space-y-2">
          {docs.length === 0 && <p className="text-sm italic text-muted">Nenhum documento no acervo ainda.</p>}
          {docs.map(d => (
            <PropertyDocRow key={d.id} doc={d}
              onDelete={async () => {
                if (!confirm("Apagar este documento do acervo?")) return;
                await deletePropertyDoc(supabase, d.id, d.storage_path);
                refresh();
              }}
              onNewVersion={() => setNewVersionFor(d)}
            />
          ))}
        </div>

        {newVersionFor && (
          <NewVersionDialog doc={newVersionFor} propertyId={p.id} churchId={p.church_id}
            onClose={() => setNewVersionFor(null)}
            onSaved={() => { setNewVersionFor(null); refresh(); }} />
        )}
      </CardContent>
    </Card>
  );
}

function NewVersionDialog({ doc, propertyId, churchId, onClose, onSaved }: {
  doc: import("@/types/domain").PropertyDocument;
  propertyId: string; churchId: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [expiresAt, setExpiresAt] = useState(doc.expires_at ?? "");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0,10));

  async function go() {
    if (!file) { setErr("Selecione o novo arquivo."); return; }
    setBusy(true); setErr("");
    try {
      const up = await uploadPatrimonyFile(supabase, churchId, `properties/${propertyId}`, file);
      await createPropertyDocVersion(supabase, doc.id, {
        property_id: propertyId, doc_type: doc.doc_type, title: doc.title,
        storage_path: up.path, size_bytes: up.size, mime_type: up.mime,
        doc_number: doc.doc_number, issuing_body: doc.issuing_body,
        issued_at: issuedAt || null, expires_at: expiresAt || null,
      });
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao criar nova versão");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-base">Nova versão — {doc.title}</CardTitle>
          <CardDescription>A versão atual (v{doc.version}) será mantida no histórico</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Novo arquivo (PDF) *">
            <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Nova data de emissão">
              <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
            </Field>
            <Field label="Nova validade">
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </Field>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} variant="outline" size="sm">Cancelar</Button>
            <Button onClick={go} disabled={busy} size="sm">{busy ? "Salvando…" : "Criar nova versão"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// SEÇÃO: BENS

// ============================================================
function AssetsSection({ churches, initialChurchId = "" }: { churches: { id: string; name: string }[]; initialChurchId?: string }) {
  const [churchFilter, setChurchFilter] = useState<string>(initialChurchId || churches[0]?.id || "");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [editing, setEditing] = useState<Asset | null>(null);
  const [creating, setCreating] = useState(false);
  const [openAsset, setOpenAsset] = useState<Asset | null>(null);
  const { data: assets = [] } = useAssets({ churchId: churchFilter || null });
  const { data: properties = [] } = useProperties(churchFilter || null);
  const qc = useQueryClient();

  const filtered = useMemo(() =>
    categoryFilter ? assets.filter(a => a.category === categoryFilter) : assets,
    [assets, categoryFilter]
  );

  async function remove(a: Asset) {
    if (!confirm(`Remover bem "${a.name}"? Isso o desativa.`)) return;
    try {
      await deleteAsset(supabase, a.id);
      await logAudit(supabase, "delete", "assets", a.id, { name: a.name });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["patrimony-summary"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {churches.length > 1 && (
          <div className="min-w-[180px]">
            <Label className="mb-1 block text-xs uppercase tracking-wider text-muted">Comunidade</Label>
            <select value={churchFilter} onChange={(e) => setChurchFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="min-w-[180px]">
          <Label className="mb-1 block text-xs uppercase tracking-wider text-muted">Categoria</Label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Todas</option>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-1.5"><Plus className="h-4 w-4" />Novo bem</Button>
      </div>

      {(editing || creating) && (
        <AssetForm churches={churches} properties={properties} editing={editing}
          defaultChurchId={churchFilter} onClose={() => { setEditing(null); setCreating(false); }} />
      )}

      {openAsset && (
        <AssetDetail asset={openAsset} onClose={() => setOpenAsset(null)} />
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && <p className="col-span-full text-sm italic text-muted">Nenhum bem cadastrado.</p>}
        {filtered.map(a => <AssetCard key={a.id} asset={a}
          onEdit={() => { setEditing(a); setCreating(false); }}
          onOpen={() => setOpenAsset(a)}
          onRemove={() => remove(a)} />)}
      </div>
    </div>
  );
}

function AssetCard({ asset: a, onEdit, onOpen, onRemove }: { asset: Asset; onEdit: () => void; onOpen: () => void; onRemove: () => void }) {
  return (
    <Card className="border-l-4 border-l-gold">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onOpen} className="min-w-0 flex-1 text-left">
            <b className="block truncate text-navy">{a.name}</b>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="rounded-md border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gold">
                {CATEGORY_LABELS[a.category]}
              </span>
              <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${CONDITION_COLOR[a.condition]}`}>
                {CONDITION_LABELS[a.condition]}
              </span>
            </div>
            {a.patrimony_code && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted"><Tag className="h-3 w-3" />{a.patrimony_code}</p>
            )}
            {a.acquisition_value !== null && a.acquisition_value > 0 && (
              <p className="mt-0.5 text-[11px] text-muted">R$ {Number(a.acquisition_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            )}
          </button>
          <div className="flex shrink-0 gap-1">
            <Button onClick={onEdit} variant="outline" size="sm" className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
            <Button onClick={onRemove} variant="destructive" size="sm" className="h-7 w-7 p-0"><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AssetForm({ churches, properties, editing, defaultChurchId, onClose }: {
  churches: { id: string; name: string }[];
  properties: Property[];
  editing: Asset | null;
  defaultChurchId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<AssetInput>({
      resolver: zodResolver(assetSchema),
      defaultValues: editing ? {
        church_id: editing.church_id,
        property_id: editing.property_id ?? "",
        patrimony_code: editing.patrimony_code ?? "",
        tag_number: editing.tag_number ?? "",
        name: editing.name, category: editing.category,
        subcategory: editing.subcategory ?? "",
        description: editing.description ?? "",
        manufacturer: editing.manufacturer ?? "",
        model: editing.model ?? "",
        serial_number: editing.serial_number ?? "",
        location_text: editing.location_text ?? "",
        acquired_at: editing.acquired_at ?? "",
        acquisition_value: Number(editing.acquisition_value ?? 0),
        origin: editing.origin, condition: editing.condition,
        is_durable: editing.is_durable,
        observations: editing.observations ?? "",
      } : {
        church_id: defaultChurchId,
        category: "mobiliario", condition: "bom", origin: "outro",
        is_durable: true, acquisition_value: 0,
      },
    });

  async function onSubmit(v: AssetInput) {
    setErr("");
    try {
      const payload = {
        church_id: v.church_id, property_id: v.property_id || null,
        patrimony_code: v.patrimony_code || null, tag_number: v.tag_number || null,
        name: v.name, category: v.category, subcategory: v.subcategory || null,
        description: v.description || null, manufacturer: v.manufacturer || null,
        model: v.model || null, serial_number: v.serial_number || null,
        location_text: v.location_text || null,
        acquired_at: v.acquired_at || null,
        acquisition_value: v.acquisition_value || 0,
        origin: v.origin, condition: v.condition, is_durable: v.is_durable,
        observations: v.observations || null,
      };
      if (editing) {
        await updateAsset(supabase, editing.id, payload);
        await logAudit(supabase, "update", "assets", editing.id, { name: v.name });
      } else {
        const created = await createAsset(supabase, payload);
        await logAudit(supabase, "insert", "assets", created.id, { name: v.name });
      }
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["patrimony-summary"] });
      onClose();
    } catch (e: unknown) {
      console.error("[AssetForm]", e);
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <Card className="border-2 border-dashed border-gold/40 bg-gold/5">
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="flex items-center justify-between">
            <b className="text-navy">{editing ? "Editar bem" : "Novo bem"}</b>
            <Button type="button" onClick={onClose} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Fechar</Button>
          </div>

          {churches.length > 1 && (
            <Field label="Comunidade"><select {...register("church_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></Field>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" error={errors.name?.message}>
              <Input {...register("name")} placeholder="Ex: Cadeira do altar" />
            </Field>
            <Field label="Localização (sala, prateleira...)">
              <Input {...register("location_text")} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Categoria">
              <select {...register("category")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Subcategoria">
              <Input {...register("subcategory")} placeholder="Cadeira / Notebook / etc." />
            </Field>
            <Field label="Localizado em (imóvel)">
              <select {...register("property_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Não vinculado —</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Código patrimonial"><Input {...register("patrimony_code")} placeholder="Ex: PAT-0001" /></Field>
            <Field label="Nº de tombamento"><Input {...register("tag_number")} /></Field>
            <Field label="Estado de conservação">
              <select {...register("condition")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Fabricante"><Input {...register("manufacturer")} /></Field>
            <Field label="Modelo"><Input {...register("model")} /></Field>
            <Field label="Número de série"><Input {...register("serial_number")} /></Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Origem do bem">
              <select {...register("origin")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {Object.entries(ORIGIN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Data de aquisição" error={errors.acquired_at?.message}>
              <Input type="date" {...register("acquired_at")} />
            </Field>
            <Field label="Valor de aquisição (R$)" error={errors.acquisition_value?.message}>
              <Input type="number" step="0.01" min={0} {...register("acquisition_value")} placeholder="0,00" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_durable")} className="h-4 w-4 accent-gold" />
            Bem durável (se desmarcado: material de consumo / não-durável)
          </label>

          <Field label="Descrição">
            <textarea {...register("description")} rows={2} className="w-full rounded-md border bg-background p-2 text-sm" />
          </Field>

          <Field label="Observações">
            <textarea {...register("observations")} rows={2} className="w-full rounded-md border bg-background p-2 text-sm" />
          </Field>

          {err && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? "Salvando…" : (editing ? "Salvar alterações" : "Cadastrar bem")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AssetDetail({ asset: a, onClose }: { asset: Asset; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: docs = [] } = useAssetDocs(a.id);

  async function handleUpload(file: File, docType: string, title: string) {
    try {
      const up = await uploadPatrimonyFile(supabase, a.church_id, `assets/${a.id}`, file);
      await createAssetDoc(supabase, {
        asset_id: a.id, doc_type: docType, title: title || file.name,
        storage_path: up.path, size_bytes: up.size, mime_type: up.mime,
      });
      qc.invalidateQueries({ queryKey: ["asset-docs", a.id] });
    } catch (e: unknown) {
      console.error("[upload]", e);
      alert(e instanceof Error ? e.message : "Erro no upload");
    }
  }

  return (
    <Card className="border-2 border-navy/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{a.name}</CardTitle>
          <Button onClick={onClose} variant="ghost" size="sm"><X className="h-3.5 w-3.5" /></Button>
        </div>
        <CardDescription>Documentos vinculados (NF, manual, garantia, termo de doação...)</CardDescription>
      </CardHeader>
      <CardContent>
        <DocumentUploader
          docTypes={["nota_fiscal", "danfe", "xml_nfe", "manual", "garantia", "termo_doacao", "comprovante_pagamento", "outro"]}
          onUpload={handleUpload}
        />
        <div className="mt-3 space-y-1.5">
          {docs.length === 0 && <p className="text-sm italic text-muted">Nenhum documento anexado.</p>}
          {docs.map(d => (
            <DocRow key={d.id} doc={d}
              onDelete={async () => {
                if (!confirm("Apagar este documento?")) return;
                await deleteAssetDoc(supabase, d.id, d.storage_path);
                qc.invalidateQueries({ queryKey: ["asset-docs", a.id] });
              }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// COMPONENTES REUTILIZÁVEIS
// ============================================================
function DocumentUploader({ docTypes, onUpload }: {
  docTypes: string[];
  onUpload: (file: File, docType: string, title: string) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState(docTypes[0]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!file) return;
    setBusy(true);
    try {
      await onUpload(file, docType, title);
      setFile(null); setTitle(""); setDocType(docTypes[0]);
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-md border-2 border-dashed border-gold/30 bg-gold/5 p-3 space-y-2">
      <Label className="block text-xs font-bold uppercase tracking-wider text-gold">Adicionar documento</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={docType} onChange={(e) => setDocType(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm">
          {docTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)" />
      </div>
      <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        accept="image/*,application/pdf,application/xml,text/xml" />
      <Button onClick={go} disabled={!file || busy} size="sm" className="gap-1.5">
        <Upload className="h-3.5 w-3.5" />{busy ? "Enviando…" : "Enviar"}
      </Button>
      <p className="text-[10px] text-muted">Limite: 20 MB. Formatos: imagem, PDF, XML.</p>
    </div>
  );
}

function DocRow({ doc, onDelete }: { doc: { id: string; title: string; doc_type: string; storage_path: string | null; mime_type: string | null }; onDelete: () => void }) {
  const [busy, setBusy] = useState(false);

  async function openDoc() {
    if (!doc.storage_path) return;
    setBusy(true);
    try {
      const url = await getSignedUrl(supabase, doc.storage_path, 600);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-card p-2">
      <FileText className="h-4 w-4 shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <button onClick={openDoc} disabled={busy} className="block w-full truncate text-left text-sm text-navy hover:underline">
          {busy ? "Abrindo…" : doc.title}
        </button>
        <p className="text-[10px] uppercase tracking-wider text-muted">{doc.doc_type.replace(/_/g, " ")}</p>
      </div>
      <Button onClick={onDelete} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}


// ── Labels das abas avançadas ─────────────────────────────────
const DEPRECIATION_LABELS: Record<string, string> = {
  linear: "Linear", acelerado: "Acelerado", soma_digitos: "Soma dos Dígitos",
};
const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  preventiva: "Preventiva", corretiva: "Corretiva", emergencial: "Emergencial", revisao: "Revisão",
};
const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  agendada: "Agendada", em_andamento: "Em Andamento", concluida: "Concluída", cancelada: "Cancelada",
};
const MAINTENANCE_STATUS_COLOR: Record<string, string> = {
  agendada: "bg-blue-100 text-blue-700", em_andamento: "bg-yellow-100 text-yellow-700",
  concluida: "bg-green-100 text-green-700", cancelada: "bg-gray-100 text-gray-500",
};
const INVENTORY_STATUS_LABELS: Record<string, string> = {
  encontrado: "✅ Encontrado", nao_encontrado: "❌ Não encontrado",
  divergente: "⚠️ Divergente", baixado: "🗑️ Baixado",
};

function fmtMoney(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
// Alias usado pelas abas avançadas


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
          <p className="font-display text-2xl font-bold text-[#0E2A47] mt-1">{fmtMoney(totalAquisicao)}</p>
        </CardContent></Card>
        <Card className="border-l-4 border-l-red-400"><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase font-bold">Depreciação Acumulada</p>
          <p className="font-display text-2xl font-bold text-red-600 mt-1">{fmtMoney(totalDeprec)}</p>
        </CardContent></Card>
        <Card className="border-l-4 border-l-green-500"><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase font-bold">Valor Líquido Atual</p>
          <p className="font-display text-2xl font-bold text-green-700 mt-1">{fmtMoney(totalValor)}</p>
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
                      <span>💰 Aquisição: {fmtMoney(d.acquisition_value)}</span>
                      <span>📊 Líquido: {fmtMoney(d.valor_atual_liquido)}</span>
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
                      {m.cost && <span>💰 {fmtMoney(m.cost)}</span>}
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
                  {m.cost && <span>{fmtMoney(m.cost)}</span>}
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
            <p className="font-display text-xl font-bold text-green-700 mt-1">{fmtMoney(national.valor_liquido_total)}</p>
          </CardContent></Card>
          <Card className="border-l-4 border-l-red-400"><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-bold">Depreciação Total</p>
            <p className="font-display text-xl font-bold text-red-600 mt-1">{fmtMoney(national.depreciacao_total)}</p>
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
                      <td className="px-3 py-2 text-right">{fmtMoney(row.valor_aquisicao_total)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{fmtMoney(row.depreciacao_acumulada_total)}</td>
                      <td className="px-3 py-2 text-right font-bold text-green-700">{fmtMoney(row.valor_atual_total)}</td>
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
