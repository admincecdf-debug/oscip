"use client";
import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Users, Link2, CreditCard, Clock, FolderOpen, Settings,
  Plus, Pencil, Trash2, X, Upload, FileText, Check,
  ChevronDown, ChevronRight, AlertTriangle, Building2,
  Phone, Mail, MapPin, Banknote, User,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase/client";
import { logAudit } from "@/services/audit";
import { useChurches } from "@/hooks/use-queries";

// ─── Tipos ────────────────────────────────────────────────────

type CategoriaVinculo = "eclesiastico" | "trabalhista" | "autonomo" | "voluntario" | "outro";
type StatusVinculo    = "ativo" | "suspenso" | "licenca" | "encerrado";
type Periodicidade    = "mensal" | "quinzenal" | "semanal" | "por_evento" | "unico";
type TipoEvento       = "nomeacao" | "promocao" | "transferencia" | "mudanca_salario" |
                        "suspensao" | "licenca" | "afastamento" | "ferias" | "rescisao" |
                        "reativacao" | "advertencia" | "curso" | "treinamento" | "ocorrencia";
type StatusPagamento  = "pendente" | "pago" | "cancelado" | "estornado";
type TipoDoc          = "contrato" | "termo_voluntariado" | "portaria" | "ata" | "nomeacao" |
                        "certificado" | "diploma" | "doc_pessoal" | "comprovante_bancario" |
                        "recibo" | "nota_fiscal" | "comprovante_pagamento" | "outro";

interface GpvPessoa {
  id: string; church_id: string; full_name: string; cpf?: string; rg?: string;
  data_nascimento?: string; email?: string; phone?: string; whatsapp?: string;
  cep?: string; logradouro?: string; numero?: string; complemento?: string;
  bairro?: string; cidade?: string; estado?: string;
  pix_key?: string; banco?: string; agencia?: string; conta?: string;
  foto_url?: string; is_active: boolean; created_at: string;
}
interface GpvTipoVinculo {
  id: string; nome: string; categoria: CategoriaVinculo; church_id?: string; is_active: boolean;
}
interface GpvFormaRemuneracao { id: string; nome: string; is_active: boolean; }
interface GpvVinculo {
  id: string; vinculo_id?: string; pessoa_id: string; tipo_vinculo_id: string; church_id: string;
  cargo?: string; departamento?: string; data_inicio: string; data_fim?: string;
  status: StatusVinculo; observacoes?: string;
  // joined
  pessoa_nome?: string; tipo_vinculo?: string; church_name?: string;
}
interface GpvRemuneracao {
  id: string; vinculo_id: string; forma_id: string; valor: number;
  periodicidade: Periodicidade; dia_pagamento?: number;
  vigente_desde: string; vigente_ate?: string; observacoes?: string;
  forma_nome?: string;
}
interface GpvHistorico {
  id: string; vinculo_id: string; tipo_evento: TipoEvento;
  descricao: string; data_evento: string; created_at: string;
}
interface GpvPagamento {
  id: string; vinculo_id: string; forma_id?: string;
  competencia_mes: number; competencia_ano: number;
  valor_bruto: number; valor_liquido: number;
  data_vencimento?: string; data_pagamento?: string;
  status: StatusPagamento; comprovante_path?: string; observacoes?: string;
  // joined
  pessoa_nome?: string; tipo_vinculo?: string; forma_nome?: string; church_name?: string;
}
interface GpvDocumento {
  id: string; pessoa_id: string; vinculo_id?: string; tipo_doc: TipoDoc;
  titulo: string; descricao?: string; storage_path: string;
  size_bytes?: number; mime_type?: string; created_at: string;
}

// ─── Labels ───────────────────────────────────────────────────

const CATEGORIA_LABELS: Record<CategoriaVinculo, string> = {
  eclesiastico: "Eclesiástico", trabalhista: "Trabalhista",
  autonomo: "Autônomo/Prestador", voluntario: "Voluntário", outro: "Outro",
};
const STATUS_VINCULO_LABELS: Record<StatusVinculo, string> = {
  ativo: "Ativo", suspenso: "Suspenso", licenca: "Licença", encerrado: "Encerrado",
};
const STATUS_VINCULO_COLOR: Record<StatusVinculo, string> = {
  ativo: "bg-green-100 text-green-800",
  suspenso: "bg-yellow-100 text-yellow-800",
  licenca: "bg-blue-100 text-blue-800",
  encerrado: "bg-gray-100 text-gray-600",
};
const PERIODICIDADE_LABELS: Record<Periodicidade, string> = {
  mensal: "Mensal", quinzenal: "Quinzenal", semanal: "Semanal",
  por_evento: "Por evento", unico: "Pagamento único",
};
const TIPO_EVENTO_LABELS: Record<TipoEvento, string> = {
  nomeacao: "Nomeação", promocao: "Promoção", transferencia: "Transferência",
  mudanca_salario: "Mudança salarial", suspensao: "Suspensão", licenca: "Licença",
  afastamento: "Afastamento", ferias: "Férias", rescisao: "Rescisão",
  reativacao: "Reativação", advertencia: "Advertência", curso: "Curso",
  treinamento: "Treinamento", ocorrencia: "Ocorrência",
};
const STATUS_PAG_LABELS: Record<StatusPagamento, string> = {
  pendente: "Pendente", pago: "Pago", cancelado: "Cancelado", estornado: "Estornado",
};
const STATUS_PAG_COLOR: Record<StatusPagamento, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  pago: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-700",
  estornado: "bg-gray-100 text-gray-600",
};
const TIPO_DOC_LABELS: Record<TipoDoc, string> = {
  contrato: "Contrato", termo_voluntariado: "Termo de voluntariado",
  portaria: "Portaria", ata: "Ata", nomeacao: "Nomeação",
  certificado: "Certificado", diploma: "Diploma", doc_pessoal: "Documento pessoal",
  comprovante_bancario: "Comprovante bancário", recibo: "Recibo",
  nota_fiscal: "Nota fiscal", comprovante_pagamento: "Comprovante de pagamento",
  outro: "Outro",
};
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// ─── Helpers ──────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Hooks de dados ───────────────────────────────────────────

function useGpvData(table: string, deps: unknown[] = []) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await (supabase.from(table) as ReturnType<typeof supabase.from>).select("*").order("created_at", { ascending: false });
    setData((rows as Record<string, unknown>[]) ?? []);
    setLoading(false);
  }, [table, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  return { data, loading, reload: load };
}

// ══════════════════════════════════════════════════════════════
// ABA 1 — PESSOAS
// ══════════════════════════════════════════════════════════════

function PessoasTab({ churches }: { churches: { id: string; name: string }[] }) {
  const [pessoas, setPessoas] = useState<GpvPessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<GpvPessoa | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("gpv_pessoas").select("*").eq("is_active", true).order("full_name");
    setPessoas((data as GpvPessoa[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = pessoas.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.cpf ?? "").includes(search) ||
    (p.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function remove(p: GpvPessoa) {
    if (!confirm(`Desativar ${p.full_name}?`)) return;
    await supabase.from("gpv_pessoas").update({ is_active: false }).eq("id", p.id);
    await logAudit(supabase, "update", "gpv_pessoas", p.id, { action: "desativar" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Buscar por nome, CPF ou e-mail…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Button onClick={() => { setEditing(null); setForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nova pessoa
        </Button>
      </div>

      {(form || editing) && (
        <PessoaForm
          churches={churches}
          editing={editing}
          onClose={() => { setForm(false); setEditing(null); }}
          onSaved={load}
        />
      )}

      {loading && <p className="text-sm text-muted italic">Carregando…</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <Card key={p.id} className="border-l-4 border-l-gold">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy truncate">{p.full_name}</p>
                  {p.cpf && <p className="text-[11px] text-muted">CPF: {p.cpf}</p>}
                  {p.email && (
                    <p className="flex items-center gap-1 text-[11px] text-muted truncate">
                      <Mail className="h-3 w-3 shrink-0" />{p.email}
                    </p>
                  )}
                  {p.phone && (
                    <p className="flex items-center gap-1 text-[11px] text-muted">
                      <Phone className="h-3 w-3" />{p.phone}
                    </p>
                  )}
                  {(p.cidade || p.estado) && (
                    <p className="flex items-center gap-1 text-[11px] text-muted">
                      <MapPin className="h-3 w-3" />{[p.cidade, p.estado].filter(Boolean).join("/")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button onClick={() => { setEditing(p); setForm(false); }} variant="outline" size="sm" className="h-7 w-7 p-0">
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button onClick={() => remove(p)} variant="destructive" size="sm" className="h-7 w-7 p-0">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && filtered.length === 0 && (
          <p className="col-span-full text-sm italic text-muted">Nenhuma pessoa cadastrada.</p>
        )}
      </div>
    </div>
  );
}

function PessoaForm({ churches, editing, onClose, onSaved }: {
  churches: { id: string; name: string }[];
  editing: GpvPessoa | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({
    church_id: editing?.church_id ?? churches[0]?.id ?? "",
    full_name: editing?.full_name ?? "",
    cpf: editing?.cpf ?? "", rg: editing?.rg ?? "",
    data_nascimento: editing?.data_nascimento ?? "",
    email: editing?.email ?? "", phone: editing?.phone ?? "", whatsapp: editing?.whatsapp ?? "",
    cep: editing?.cep ?? "", logradouro: editing?.logradouro ?? "",
    numero: editing?.numero ?? "", complemento: editing?.complemento ?? "",
    bairro: editing?.bairro ?? "", cidade: editing?.cidade ?? "", estado: editing?.estado ?? "",
    pix_key: editing?.pix_key ?? "", banco: editing?.banco ?? "",
    agencia: editing?.agencia ?? "", conta: editing?.conta ?? "",
  });

  function set(key: string, val: string) { setF((prev) => ({ ...prev, [key]: val })); }

  async function save() {
    if (!f.full_name.trim()) { setErr("Nome obrigatório."); return; }
    if (!f.church_id) { setErr("Selecione uma comunidade."); return; }
    setBusy(true); setErr("");
    const payload = {
      church_id: f.church_id, full_name: f.full_name.trim(),
      cpf: f.cpf || null, rg: f.rg || null,
      data_nascimento: f.data_nascimento || null,
      email: f.email || null, phone: f.phone || null, whatsapp: f.whatsapp || null,
      cep: f.cep || null, logradouro: f.logradouro || null,
      numero: f.numero || null, complemento: f.complemento || null,
      bairro: f.bairro || null, cidade: f.cidade || null, estado: f.estado || null,
      pix_key: f.pix_key || null, banco: f.banco || null,
      agencia: f.agencia || null, conta: f.conta || null,
    };
    try {
      if (editing) {
        const { error } = await supabase.from("gpv_pessoas").update(payload).eq("id", editing.id);
        if (error) throw error;
        await logAudit(supabase, "update", "gpv_pessoas", editing.id, { name: f.full_name });
      } else {
        const { data, error } = await supabase.from("gpv_pessoas").insert(payload).select().single();
        if (error) throw error;
        await logAudit(supabase, "insert", "gpv_pessoas", (data as GpvPessoa).id, { name: f.full_name });
      }
      onSaved(); onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setBusy(false); }
  }

  const SI = (key: string) => ({
    value: f[key as keyof typeof f] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
    className: "h-10 w-full rounded-md border bg-background px-3 text-sm",
  });

  return (
    <Card className="border-2 border-dashed border-gold/40 bg-gold/5">
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <b className="text-navy">{editing ? "Editar pessoa" : "Nova pessoa"}</b>
          <Button type="button" onClick={onClose} variant="ghost" size="sm"><X className="h-3.5 w-3.5" /></Button>
        </div>

        {/* Dados básicos */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome completo *">
            <Input {...SI("full_name")} placeholder="João da Silva" />
          </Field>
          <Field label="Comunidade *">
            <select value={f.church_id} onChange={(e) => set("church_id", e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="CPF"><Input {...SI("cpf")} placeholder="000.000.000-00" /></Field>
          <Field label="RG"><Input {...SI("rg")} /></Field>
          <Field label="Data de nascimento"><Input type="date" {...SI("data_nascimento")} /></Field>
        </div>

        {/* Contato */}
        <div className="rounded-md border bg-card p-3 space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-navy">Contato</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="E-mail"><Input type="email" {...SI("email")} /></Field>
            <Field label="Telefone"><Input {...SI("phone")} placeholder="(00) 00000-0000" /></Field>
            <Field label="WhatsApp"><Input {...SI("whatsapp")} placeholder="(00) 00000-0000" /></Field>
          </div>
        </div>

        {/* Endereço */}
        <div className="rounded-md border bg-card p-3 space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-navy">Endereço</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="CEP"><Input {...SI("cep")} placeholder="00000-000" /></Field>
            <Field label="Estado"><Input {...SI("estado")} placeholder="AM" maxLength={3} /></Field>
            <Field label="Cidade"><Input {...SI("cidade")} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bairro"><Input {...SI("bairro")} /></Field>
            <Field label="Logradouro"><Input {...SI("logradouro")} placeholder="Rua, Av..." /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Número"><Input {...SI("numero")} /></Field>
            <Field label="Complemento"><Input {...SI("complemento")} /></Field>
          </div>
        </div>

        {/* Dados bancários */}
        <div className="rounded-md border bg-card p-3 space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-navy">Dados bancários / PIX</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Chave PIX"><Input {...SI("pix_key")} placeholder="CPF, e-mail, telefone ou chave aleatória" /></Field>
            <Field label="Banco"><Input {...SI("banco")} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Agência"><Input {...SI("agencia")} /></Field>
            <Field label="Conta"><Input {...SI("conta")} /></Field>
          </div>
        </div>

        {err && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}
        <Button onClick={save} disabled={busy} className="gap-2">
          {busy ? "Salvando…" : (editing ? "Salvar alterações" : "Cadastrar pessoa")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 2 — VÍNCULOS
// ══════════════════════════════════════════════════════════════

function VinculosTab({ churches }: { churches: { id: string; name: string }[] }) {
  const [vinculos, setVinculos] = useState<GpvVinculo[]>([]);
  const [pessoas, setPessoas] = useState<GpvPessoa[]>([]);
  const [tipos, setTipos] = useState<GpvTipoVinculo[]>([]);
  const [formas, setFormas] = useState<GpvFormaRemuneracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [remuneracoes, setRemuneracoes] = useState<Record<string, GpvRemuneracao[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [vRes, pRes, tRes, fRes] = await Promise.all([
      supabase.from("vw_gpv_vinculos_ativos").select("*"),
      supabase.from("gpv_pessoas").select("id, full_name").eq("is_active", true).order("full_name"),
      supabase.from("gpv_tipos_vinculo").select("*").eq("is_active", true).order("nome"),
      supabase.from("gpv_formas_remuneracao").select("*").eq("is_active", true).order("nome"),
    ]);
    setVinculos((vRes.data as GpvVinculo[]) ?? []);
    setPessoas((pRes.data as GpvPessoa[]) ?? []);
    setTipos((tRes.data as GpvTipoVinculo[]) ?? []);
    setFormas((fRes.data as GpvFormaRemuneracao[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadRemuneracoes(vinculoId: string) {
    if (remuneracoes[vinculoId]) return;
    const { data } = await supabase
      .from("gpv_remuneracoes")
      .select("*, forma:gpv_formas_remuneracao(nome)")
      .eq("vinculo_id", vinculoId);
    const rows = (data ?? []).map((r: unknown) => ({
      ...(r as GpvRemuneracao),
      forma_nome: ((r as { forma?: { nome?: string } | null }).forma)?.nome,
    }));
    setRemuneracoes((prev) => ({ ...prev, [vinculoId]: rows }));
  }

  function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    loadRemuneracoes(id);
  }

  async function encerrar(v: GpvVinculo) {
    if (!confirm(`Encerrar vínculo de ${v.pessoa_nome}?`)) return;
    await supabase.from("gpv_vinculos").update({ status: "encerrado", data_fim: new Date().toISOString().slice(0,10) }).eq("id", v.id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{vinculos.length} vínculo(s) ativo(s)</p>
        <Button onClick={() => setForm(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo vínculo
        </Button>
      </div>

      {form && (
        <VinculoForm
          pessoas={pessoas} tipos={tipos} formas={formas} churches={churches}
          onClose={() => setForm(false)} onSaved={load}
        />
      )}

      {loading && <p className="text-sm text-muted italic">Carregando…</p>}

      <div className="space-y-2">
        {vinculos.map((v) => (
          <Card key={v.vinculo_id ?? v.id} className="border-l-4 border-l-gold">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-3">
                <button onClick={() => toggleExpand(v.vinculo_id ?? v.id)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-navy">{v.pessoa_nome}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_VINCULO_COLOR[v.status]}`}>
                      {STATUS_VINCULO_LABELS[v.status]}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {v.tipo_vinculo}{v.cargo ? ` · ${v.cargo}` : ""} · {v.church_name}
                  </p>
                  <p className="text-xs text-muted">
                    Desde {new Date(v.data_inicio).toLocaleDateString("pt-BR")}
                    {(v as unknown as { total_remuneracao: number }).total_remuneracao > 0 &&
                      ` · ${fmt((v as unknown as { total_remuneracao: number }).total_remuneracao)}/mês`}
                  </p>
                </button>
                <div className="flex gap-1 shrink-0">
                  {expanded === (v.vinculo_id ?? v.id)
                    ? <ChevronDown className="h-4 w-4 text-muted" />
                    : <ChevronRight className="h-4 w-4 text-muted" />}
                  <Button onClick={() => encerrar(v)} variant="outline" size="sm" className="h-7 px-2 text-xs">
                    Encerrar
                  </Button>
                </div>
              </div>

              {/* Remunerações expandidas */}
              {expanded === (v.vinculo_id ?? v.id) && (
                <div className="mt-3 border-t pt-3">
                  <p className="text-xs font-bold uppercase text-muted mb-2">Remunerações</p>
                  {(remuneracoes[v.vinculo_id ?? v.id] ?? []).length === 0
                    ? <p className="text-xs text-muted italic">Nenhuma remuneração cadastrada.</p>
                    : (remuneracoes[v.vinculo_id ?? v.id] ?? []).map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-xs border-b py-1.5 last:border-0">
                          <span className="text-navy font-medium">{r.forma_nome}</span>
                          <span className="text-muted">{PERIODICIDADE_LABELS[r.periodicidade]}</span>
                          <span className="font-bold text-navy">{fmt(r.valor)}</span>
                        </div>
                      ))}
                  <AddRemuneracaoInline vinculoId={v.vinculo_id ?? v.id} formas={formas}
                    onSaved={() => {
                      setRemuneracoes((prev) => { const n = {...prev}; delete n[v.vinculo_id ?? v.id]; return n; });
                      loadRemuneracoes(v.vinculo_id ?? v.id);
                    }} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!loading && vinculos.length === 0 && (
          <p className="text-sm italic text-muted">Nenhum vínculo ativo.</p>
        )}
      </div>
    </div>
  );
}

function VinculoForm({ pessoas, tipos, formas, churches, onClose, onSaved }: {
  pessoas: GpvPessoa[]; tipos: GpvTipoVinculo[]; formas: GpvFormaRemuneracao[];
  churches: { id: string; name: string }[];
  onClose: () => void; onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({
    pessoa_id: "", tipo_vinculo_id: "", church_id: churches[0]?.id ?? "",
    cargo: "", departamento: "", data_inicio: new Date().toISOString().slice(0,10),
    status: "ativo" as StatusVinculo, observacoes: "",
    // remuneração inicial (opcional)
    forma_id: "", valor: "", periodicidade: "mensal" as Periodicidade, dia_pagamento: "5",
  });

  function set(key: string, val: string) { setF((prev) => ({ ...prev, [key]: val })); }

  async function save() {
    if (!f.pessoa_id) { setErr("Selecione uma pessoa."); return; }
    if (!f.tipo_vinculo_id) { setErr("Selecione o tipo de vínculo."); return; }
    if (!f.data_inicio) { setErr("Data de início obrigatória."); return; }
    setBusy(true); setErr("");
    try {
      const { data: vData, error: vErr } = await supabase.from("gpv_vinculos").insert({
        pessoa_id: f.pessoa_id, tipo_vinculo_id: f.tipo_vinculo_id, church_id: f.church_id,
        cargo: f.cargo || null, departamento: f.departamento || null,
        data_inicio: f.data_inicio, status: f.status,
        observacoes: f.observacoes || null,
      }).select().single();
      if (vErr) throw vErr;
      const vinculoId = (vData as { id: string }).id;
      // Registrar no histórico
      await supabase.from("gpv_historico").insert({
        vinculo_id: vinculoId, tipo_evento: "nomeacao",
        descricao: `Vínculo iniciado em ${new Date(f.data_inicio).toLocaleDateString("pt-BR")}`,
        data_evento: f.data_inicio,
      });
      // Remuneração inicial (se preenchida)
      if (f.forma_id && f.valor) {
        await supabase.from("gpv_remuneracoes").insert({
          vinculo_id: vinculoId, forma_id: f.forma_id,
          valor: Number(f.valor), periodicidade: f.periodicidade,
          dia_pagamento: f.dia_pagamento ? Number(f.dia_pagamento) : null,
          vigente_desde: f.data_inicio,
        });
      }
      await logAudit(supabase, "insert", "gpv_vinculos", vinculoId, { pessoa_id: f.pessoa_id });
      onSaved(); onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setBusy(false); }
  }

  const tiposPorCategoria = Object.entries(
    tipos.reduce<Record<string, GpvTipoVinculo[]>>((acc, t) => {
      (acc[t.categoria] = acc[t.categoria] || []).push(t);
      return acc;
    }, {})
  );

  return (
    <Card className="border-2 border-dashed border-gold/40 bg-gold/5">
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <b className="text-navy">Novo vínculo</b>
          <Button type="button" onClick={onClose} variant="ghost" size="sm"><X className="h-3.5 w-3.5" /></Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pessoa *">
            <select value={f.pessoa_id} onChange={(e) => set("pessoa_id", e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Selecione —</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </Field>
          <Field label="Comunidade *">
            <select value={f.church_id} onChange={(e) => set("church_id", e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo de vínculo *">
            <select value={f.tipo_vinculo_id} onChange={(e) => set("tipo_vinculo_id", e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Selecione —</option>
              {tiposPorCategoria.map(([cat, items]) => (
                <optgroup key={cat} label={CATEGORIA_LABELS[cat as CategoriaVinculo]}>
                  {items.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => set("status", e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {Object.entries(STATUS_VINCULO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Cargo / Função"><Input value={f.cargo} onChange={(e) => set("cargo", e.target.value)} /></Field>
          <Field label="Departamento"><Input value={f.departamento} onChange={(e) => set("departamento", e.target.value)} /></Field>
          <Field label="Data de início *"><Input type="date" value={f.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} /></Field>
        </div>

        <Field label="Observações">
          <Input value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
        </Field>

        {/* Remuneração inicial opcional */}
        <div className="rounded-md border bg-card p-3 space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-navy">Remuneração inicial (opcional)</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Forma de pagamento">
              <select value={f.forma_id} onChange={(e) => set("forma_id", e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Não informar agora —</option>
                {formas.map((fr) => <option key={fr.id} value={fr.id}>{fr.nome}</option>)}
              </select>
            </Field>
            <Field label="Valor (R$)">
              <Input type="number" step="0.01" min={0} value={f.valor}
                onChange={(e) => set("valor", e.target.value)} placeholder="0,00" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Periodicidade">
              <select value={f.periodicidade} onChange={(e) => set("periodicidade", e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {Object.entries(PERIODICIDADE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Dia do pagamento">
              <Input type="number" min={1} max={31} value={f.dia_pagamento}
                onChange={(e) => set("dia_pagamento", e.target.value)} />
            </Field>
          </div>
        </div>

        {err && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}
        <Button onClick={save} disabled={busy} className="gap-2">
          {busy ? "Salvando…" : "Criar vínculo"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AddRemuneracaoInline({ vinculoId, formas, onSaved }: {
  vinculoId: string; formas: GpvFormaRemuneracao[]; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [forma_id, setFormaId] = useState("");
  const [valor, setValor] = useState("");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("mensal");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!forma_id || !valor) return;
    setBusy(true);
    await supabase.from("gpv_remuneracoes").insert({
      vinculo_id: vinculoId, forma_id, valor: Number(valor),
      periodicidade, vigente_desde: new Date().toISOString().slice(0,10),
    });
    setBusy(false); setOpen(false); setFormaId(""); setValor("");
    onSaved();
  }

  if (!open) return (
    <Button onClick={() => setOpen(true)} variant="outline" size="sm" className="mt-2 gap-1 text-xs h-7">
      <Plus className="h-3 w-3" /> Adicionar remuneração
    </Button>
  );

  return (
    <div className="mt-2 rounded-md border bg-background p-2 space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <select value={forma_id} onChange={(e) => setFormaId(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs">
          <option value="">— Forma —</option>
          {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <Input type="number" step="0.01" min={0} value={valor}
          onChange={(e) => setValor(e.target.value)} placeholder="Valor R$"
          className="h-8 text-xs" />
        <select value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}
          className="h-8 rounded-md border bg-background px-2 text-xs">
          {Object.entries(PERIODICIDADE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="flex gap-1">
        <Button onClick={save} disabled={busy || !forma_id || !valor} size="sm" className="h-7 gap-1 text-xs">
          <Check className="h-3 w-3" />{busy ? "Salvando…" : "Salvar"}
        </Button>
        <Button onClick={() => setOpen(false)} variant="ghost" size="sm" className="h-7 text-xs">Cancelar</Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 3 — PAGAMENTOS
// ══════════════════════════════════════════════════════════════

function PagamentosTab() {
  const [pagamentos, setPagamentos] = useState<GpvPagamento[]>([]);
  const [vinculos, setVinculos] = useState<GpvVinculo[]>([]);
  const [formas, setFormas] = useState<GpvFormaRemuneracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<StatusPagamento | "">("");
  const today = new Date();

  const load = useCallback(async () => {
    setLoading(true);
    const [pgRes, vRes, fRes] = await Promise.all([
      supabase.from("vw_gpv_pagamentos_pendentes").select("*").order("data_vencimento"),
      supabase.from("vw_gpv_vinculos_ativos").select("vinculo_id, pessoa_nome, tipo_vinculo"),
      supabase.from("gpv_formas_remuneracao").select("*").eq("is_active", true).order("nome"),
    ]);
    // Também pegar pagamentos já realizados (pago/cancelado/estornado)
    const { data: todos } = await supabase
      .from("gpv_pagamentos")
      .select(`
        *,
        vinculo:gpv_vinculos(
          pessoa:gpv_pessoas(full_name),
          tipo:gpv_tipos_vinculo(nome),
          church:churches(name)
        ),
        forma:gpv_formas_remuneracao(nome)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    const mapped = (todos ?? []).map((p: unknown) => ({
      ...(p as GpvPagamento),
      pessoa_nome: ((p as { vinculo?: { pessoa?: { full_name?: string } } | null }).vinculo?.pessoa?.full_name),
      tipo_vinculo: ((p as { vinculo?: { tipo?: { nome?: string } } | null }).vinculo?.tipo?.nome),
      church_name: ((p as { vinculo?: { church?: { name?: string } } | null }).vinculo?.church?.name),
      forma_nome: ((p as { forma?: { nome?: string } | null }).forma?.nome),
    }));

    setPagamentos(mapped);
    setVinculos((vRes.data as GpvVinculo[]) ?? []);
    setFormas((fRes.data as GpvFormaRemuneracao[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filtroStatus ? pagamentos.filter(p => p.status === filtroStatus) : pagamentos;
  const totalPendente = pagamentos.filter(p => p.status === "pendente").reduce((s, p) => s + p.valor_liquido, 0);

  async function marcarPago(p: GpvPagamento) {
    await supabase.from("gpv_pagamentos").update({
      status: "pago", data_pagamento: new Date().toISOString().slice(0,10),
    }).eq("id", p.id);
    load();
  }

  async function cancelar(p: GpvPagamento) {
    if (!confirm("Cancelar este pagamento?")) return;
    await supabase.from("gpv_pagamentos").update({ status: "cancelado" }).eq("id", p.id);
    load();
  }

  return (
    <div className="space-y-4">
      {totalPendente > 0 && (
        <Card className="border-l-4 border-l-yellow-400 bg-yellow-50/50">
          <CardContent className="pt-3 pb-3">
            <p className="text-sm font-semibold text-yellow-800">
              Total pendente: <span className="text-lg">{fmt(totalPendente)}</span>
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as StatusPagamento | "")}
          className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_PAG_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button onClick={() => setForm(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Registrar pagamento
        </Button>
      </div>

      {form && (
        <PagamentoForm vinculos={vinculos} formas={formas}
          onClose={() => setForm(false)} onSaved={load} />
      )}

      {loading && <p className="text-sm text-muted italic">Carregando…</p>}

      <div className="space-y-2">
        {filtered.map((p) => (
          <Card key={p.id} className={`border-l-4 ${p.status === "pago" ? "border-l-green-500" : p.status === "pendente" ? "border-l-yellow-400" : "border-l-gray-300"}`}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-navy">{p.pessoa_nome ?? "—"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_PAG_COLOR[p.status]}`}>
                      {STATUS_PAG_LABELS[p.status]}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {p.tipo_vinculo} · {p.forma_nome} · Competência {MESES[(p.competencia_mes ?? 1) - 1]}/{p.competencia_ano}
                  </p>
                  <div className="flex gap-4 mt-0.5 text-xs text-muted">
                    <span>Bruto: {fmt(p.valor_bruto)}</span>
                    <span className="font-bold text-navy">Líquido: {fmt(p.valor_liquido)}</span>
                    {p.data_vencimento && <span>Vence: {new Date(p.data_vencimento).toLocaleDateString("pt-BR")}</span>}
                    {p.data_pagamento && <span>Pago em: {new Date(p.data_pagamento).toLocaleDateString("pt-BR")}</span>}
                  </div>
                </div>
                {p.status === "pendente" && (
                  <div className="flex gap-1 shrink-0">
                    <Button onClick={() => marcarPago(p)} size="sm" className="h-7 gap-1 text-xs bg-green-600 hover:bg-green-700">
                      <Check className="h-3 w-3" /> Pago
                    </Button>
                    <Button onClick={() => cancelar(p)} variant="outline" size="sm" className="h-7 text-xs">
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && filtered.length === 0 && (
          <p className="text-sm italic text-muted">Nenhum pagamento encontrado.</p>
        )}
      </div>
    </div>
  );
}

function PagamentoForm({ vinculos, formas, onClose, onSaved }: {
  vinculos: GpvVinculo[]; formas: GpvFormaRemuneracao[];
  onClose: () => void; onSaved: () => void;
}) {
  const today = new Date();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({
    vinculo_id: "", forma_id: "",
    competencia_mes: String(today.getMonth() + 1),
    competencia_ano: String(today.getFullYear()),
    valor_bruto: "", valor_liquido: "",
    data_vencimento: "", data_pagamento: "",
    status: "pendente" as StatusPagamento,
    observacoes: "",
  });

  function set(key: string, val: string) { setF((prev) => ({ ...prev, [key]: val })); }

  async function save() {
    if (!f.vinculo_id) { setErr("Selecione o vínculo."); return; }
    if (!f.valor_bruto) { setErr("Valor bruto obrigatório."); return; }
    setBusy(true); setErr("");
    try {
      const { data, error } = await supabase.from("gpv_pagamentos").insert({
        vinculo_id: f.vinculo_id, forma_id: f.forma_id || null,
        competencia_mes: Number(f.competencia_mes),
        competencia_ano: Number(f.competencia_ano),
        valor_bruto: Number(f.valor_bruto),
        valor_liquido: Number(f.valor_liquido || f.valor_bruto),
        data_vencimento: f.data_vencimento || null,
        data_pagamento: f.data_pagamento || null,
        status: f.status, observacoes: f.observacoes || null,
      }).select().single();
      if (error) throw error;
      await logAudit(supabase, "insert", "gpv_pagamentos", (data as { id: string }).id, {});
      onSaved(); onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setBusy(false); }
  }

  return (
    <Card className="border-2 border-dashed border-gold/40 bg-gold/5">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <b className="text-navy">Registrar pagamento</b>
          <Button type="button" onClick={onClose} variant="ghost" size="sm"><X className="h-3.5 w-3.5" /></Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vínculo *">
            <select value={f.vinculo_id} onChange={(e) => set("vinculo_id", e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Selecione —</option>
              {vinculos.map((v) => (
                <option key={v.vinculo_id ?? v.id} value={v.vinculo_id ?? v.id}>
                  {v.pessoa_nome} · {v.tipo_vinculo}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Forma de remuneração">
            <select value={f.forma_id} onChange={(e) => set("forma_id", e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Não especificada —</option>
              {formas.map((fr) => <option key={fr.id} value={fr.id}>{fr.nome}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mês de competência">
            <select value={f.competencia_mes} onChange={(e) => set("competencia_mes", e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </Field>
          <Field label="Ano">
            <Input type="number" min="2020" max="2100" value={f.competencia_ano}
              onChange={(e) => set("competencia_ano", e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valor bruto (R$) *">
            <Input type="number" step="0.01" min={0} value={f.valor_bruto}
              onChange={(e) => { set("valor_bruto", e.target.value); if (!f.valor_liquido) set("valor_liquido", e.target.value); }} />
          </Field>
          <Field label="Valor líquido (R$)">
            <Input type="number" step="0.01" min={0} value={f.valor_liquido}
              onChange={(e) => set("valor_liquido", e.target.value)}
              placeholder="Igual ao bruto se não informado" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Data de vencimento">
            <Input type="date" value={f.data_vencimento} onChange={(e) => set("data_vencimento", e.target.value)} />
          </Field>
          <Field label="Data de pagamento">
            <Input type="date" value={f.data_pagamento} onChange={(e) => set("data_pagamento", e.target.value)} />
          </Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => set("status", e.target.value as StatusPagamento)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {Object.entries(STATUS_PAG_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Observações">
          <Input value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
        </Field>

        {err && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}
        <Button onClick={save} disabled={busy} className="gap-2">
          {busy ? "Salvando…" : "Registrar pagamento"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 4 — HISTÓRICO
// ══════════════════════════════════════════════════════════════

function HistoricoTab() {
  const [vinculos, setVinculos] = useState<GpvVinculo[]>([]);
  const [historico, setHistorico] = useState<GpvHistorico[]>([]);
  const [vinculoId, setVinculoId] = useState("");
  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fEvento, setFEvento] = useState({ tipo_evento: "nomeacao" as TipoEvento, descricao: "", data_evento: new Date().toISOString().slice(0,10) });

  useEffect(() => {
    supabase.from("vw_gpv_vinculos_ativos").select("vinculo_id, pessoa_nome, tipo_vinculo")
      .then(({ data }) => setVinculos((data as GpvVinculo[]) ?? []));
  }, []);

  async function loadHistorico(id: string) {
    const { data } = await supabase.from("gpv_historico").select("*").eq("vinculo_id", id).order("data_evento", { ascending: false });
    setHistorico((data as GpvHistorico[]) ?? []);
  }

  useEffect(() => { if (vinculoId) loadHistorico(vinculoId); }, [vinculoId]);

  async function saveEvento() {
    if (!vinculoId || !fEvento.descricao) return;
    setBusy(true);
    await supabase.from("gpv_historico").insert({ vinculo_id: vinculoId, ...fEvento });
    setBusy(false); setForm(false);
    setFEvento({ tipo_evento: "nomeacao", descricao: "", data_evento: new Date().toISOString().slice(0,10) });
    loadHistorico(vinculoId);
  }

  const EVENTO_ICON: Record<TipoEvento, string> = {
    nomeacao: "🏅", promocao: "📈", transferencia: "🔄", mudanca_salario: "💰",
    suspensao: "⚠️", licenca: "🏖️", afastamento: "🏥", ferias: "🌴",
    rescisao: "📋", reativacao: "✅", advertencia: "⚡", curso: "📚",
    treinamento: "🎯", ocorrencia: "📝",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={vinculoId} onChange={(e) => setVinculoId(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">— Selecione o vínculo —</option>
          {vinculos.map((v) => (
            <option key={v.vinculo_id ?? v.id} value={v.vinculo_id ?? v.id}>
              {v.pessoa_nome} · {v.tipo_vinculo}
            </option>
          ))}
        </select>
        {vinculoId && (
          <Button onClick={() => setForm(true)} variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Registrar evento
          </Button>
        )}
      </div>

      {form && vinculoId && (
        <Card className="border-2 border-dashed border-gold/40 bg-gold/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <b className="text-navy">Novo evento</b>
              <Button type="button" onClick={() => setForm(false)} variant="ghost" size="sm"><X className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo de evento">
                <select value={fEvento.tipo_evento}
                  onChange={(e) => setFEvento((prev) => ({ ...prev, tipo_evento: e.target.value as TipoEvento }))}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {Object.entries(TIPO_EVENTO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Data do evento">
                <Input type="date" value={fEvento.data_evento}
                  onChange={(e) => setFEvento((prev) => ({ ...prev, data_evento: e.target.value }))} />
              </Field>
            </div>
            <Field label="Descrição *">
              <Input value={fEvento.descricao}
                onChange={(e) => setFEvento((prev) => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descreva o evento em detalhes…" />
            </Field>
            <Button onClick={saveEvento} disabled={busy || !fEvento.descricao} className="gap-2">
              {busy ? "Salvando…" : "Registrar evento"}
            </Button>
          </CardContent>
        </Card>
      )}

      {vinculoId && (
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gold/30" />
          {historico.length === 0 && <p className="text-sm italic text-muted">Nenhum evento registrado.</p>}
          {historico.map((h) => (
            <div key={h.id} className="relative mb-4 pl-6">
              <div className="absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full bg-gold border-2 border-white" />
              <p className="text-[11px] text-muted font-bold uppercase tracking-wide">
                {EVENTO_ICON[h.tipo_evento]} {TIPO_EVENTO_LABELS[h.tipo_evento]} · {new Date(h.data_evento).toLocaleDateString("pt-BR")}
              </p>
              <p className="text-sm text-navy mt-0.5">{h.descricao}</p>
            </div>
          ))}
        </div>
      )}

      {!vinculoId && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <Clock className="h-8 w-8 text-muted mx-auto mb-2" />
            <p className="text-sm text-muted">Selecione um vínculo para ver o histórico.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 5 — DOCUMENTOS (GED)
// ══════════════════════════════════════════════════════════════

function DocumentosTab() {
  const [pessoas, setPessoas] = useState<GpvPessoa[]>([]);
  const [vinculos, setVinculos] = useState<GpvVinculo[]>([]);
  const [documentos, setDocumentos] = useState<GpvDocumento[]>([]);
  const [pessoaId, setPessoaId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [tipoDoc, setTipoDoc] = useState<TipoDoc>("contrato");
  const [titulo, setTitulo] = useState("");
  const [vinculoIdDoc, setVinculoIdDoc] = useState("");

  useEffect(() => {
    supabase.from("gpv_pessoas").select("id, full_name").eq("is_active", true).order("full_name")
      .then(({ data }) => setPessoas((data as GpvPessoa[]) ?? []));
  }, []);

  useEffect(() => {
    if (!pessoaId) return;
    supabase.from("gpv_vinculos").select("id, cargo, tipo_vinculo_id, gpv_tipos_vinculo(nome)")
      .eq("pessoa_id", pessoaId).eq("status", "ativo")
      .then(({ data }) => setVinculos((data as unknown as GpvVinculo[]) ?? []));
    loadDocs(pessoaId);
  }, [pessoaId]);

  async function loadDocs(id: string) {
    const { data } = await supabase.from("gpv_documentos").select("*").eq("pessoa_id", id).order("created_at", { ascending: false });
    setDocumentos((data as GpvDocumento[]) ?? []);
  }

  async function upload() {
    if (!file || !pessoaId || !titulo) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `pessoas/${pessoaId}/docs/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("gpv").upload(path, file);
      if (upErr) throw upErr;
      await supabase.from("gpv_documentos").insert({
        pessoa_id: pessoaId, vinculo_id: vinculoIdDoc || null,
        tipo_doc: tipoDoc, titulo, storage_path: path,
        size_bytes: file.size, mime_type: file.type,
      });
      setFile(null); setTitulo("");
      loadDocs(pessoaId);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro no upload");
    } finally { setUploading(false); }
  }

  async function openDoc(path: string) {
    const { data } = await supabase.storage.from("gpv").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function removeDoc(doc: GpvDocumento) {
    if (!confirm("Apagar este documento?")) return;
    await supabase.storage.from("gpv").remove([doc.storage_path]);
    await supabase.from("gpv_documentos").delete().eq("id", doc.id);
    loadDocs(pessoaId);
  }

  return (
    <div className="space-y-4">
      <Field label="Selecionar pessoa">
        <select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm max-w-xs">
          <option value="">— Selecione —</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </Field>

      {pessoaId && (
        <>
          {/* Uploader */}
          <Card className="border-2 border-dashed border-gold/30 bg-gold/5">
            <CardContent className="pt-4 space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-gold">Adicionar documento</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo de documento">
                  <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value as TipoDoc)}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                    {Object.entries(TIPO_DOC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Vínculo (opcional)">
                  <select value={vinculoIdDoc} onChange={(e) => setVinculoIdDoc(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                    <option value="">— Sem vínculo específico —</option>
                    {vinculos.map((v) => (
                      <option key={v.id} value={v.id}>{v.cargo ?? "Sem cargo"}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Título *">
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Contrato de prestação de serviços" />
              </Field>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.xml" />
              <Button onClick={upload} disabled={!file || !titulo || uploading} size="sm" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />{uploading ? "Enviando…" : "Enviar documento"}
              </Button>
            </CardContent>
          </Card>

          {/* Lista de documentos */}
          <div className="space-y-1.5">
            {documentos.length === 0 && <p className="text-sm italic text-muted">Nenhum documento cadastrado.</p>}
            {documentos.map((d) => (
              <div key={d.id} className="flex items-center gap-2 rounded-md border bg-card p-2.5">
                <FileText className="h-4 w-4 shrink-0 text-gold" />
                <div className="flex-1 min-w-0">
                  <button onClick={() => openDoc(d.storage_path)}
                    className="block w-full truncate text-left text-sm text-navy hover:underline font-medium">
                    {d.titulo}
                  </button>
                  <p className="text-[10px] uppercase tracking-wider text-muted">
                    {TIPO_DOC_LABELS[d.tipo_doc]} · {new Date(d.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button onClick={() => removeDoc(d)} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {!pessoaId && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <FolderOpen className="h-8 w-8 text-muted mx-auto mb-2" />
            <p className="text-sm text-muted">Selecione uma pessoa para gerenciar documentos.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ABA 6 — CONFIGURAÇÕES
// ══════════════════════════════════════════════════════════════

function ConfiguracoesTab({ churches }: { churches: { id: string; name: string }[] }) {
  const [tipos, setTipos] = useState<GpvTipoVinculo[]>([]);
  const [formas, setFormas] = useState<GpvFormaRemuneracao[]>([]);
  const [novoTipo, setNovoTipo] = useState({ nome: "", categoria: "outro" as CategoriaVinculo, church_id: "" });
  const [novaForma, setNovaForma] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [tRes, fRes] = await Promise.all([
      supabase.from("gpv_tipos_vinculo").select("*").eq("is_active", true).order("nome"),
      supabase.from("gpv_formas_remuneracao").select("*").eq("is_active", true).order("nome"),
    ]);
    setTipos((tRes.data as GpvTipoVinculo[]) ?? []);
    setFormas((fRes.data as GpvFormaRemuneracao[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addTipo() {
    if (!novoTipo.nome.trim()) return;
    setBusy(true);
    await supabase.from("gpv_tipos_vinculo").insert({
      nome: novoTipo.nome.trim(), categoria: novoTipo.categoria,
      church_id: novoTipo.church_id || null,
    });
    setNovoTipo({ nome: "", categoria: "outro", church_id: "" });
    setBusy(false); load();
  }

  async function addForma() {
    if (!novaForma.trim()) return;
    setBusy(true);
    await supabase.from("gpv_formas_remuneracao").insert({ nome: novaForma.trim() });
    setNovaForma(""); setBusy(false); load();
  }

  async function desativarTipo(id: string) {
    if (!confirm("Desativar este tipo de vínculo?")) return;
    await supabase.from("gpv_tipos_vinculo").update({ is_active: false }).eq("id", id);
    load();
  }

  async function desativarForma(id: string) {
    if (!confirm("Desativar esta forma de remuneração?")) return;
    await supabase.from("gpv_formas_remuneracao").update({ is_active: false }).eq("id", id);
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Tipos de vínculo */}
      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipos de Vínculo</CardTitle>
            <CardDescription>Parametrize os tipos disponíveis no sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Input value={novoTipo.nome} onChange={(e) => setNovoTipo((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Nome do tipo (ex: Auxiliar de ministério)" />
              <div className="grid gap-2 sm:grid-cols-2">
                <select value={novoTipo.categoria}
                  onChange={(e) => setNovoTipo((p) => ({ ...p, categoria: e.target.value as CategoriaVinculo }))}
                  className="h-9 rounded-md border bg-background px-2 text-sm">
                  {Object.entries(CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={novoTipo.church_id}
                  onChange={(e) => setNovoTipo((p) => ({ ...p, church_id: e.target.value }))}
                  className="h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="">Global (todas)</option>
                  {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <Button onClick={addTipo} disabled={busy || !novoTipo.nome.trim()} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Adicionar tipo
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {tipos.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-navy">{t.nome}</span>
                    <span className="ml-2 rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] font-bold text-gold">
                      {CATEGORIA_LABELS[t.categoria]}
                    </span>
                    {!t.church_id && <span className="ml-1 text-[10px] text-muted">global</span>}
                  </div>
                  <Button onClick={() => desativarTipo(t.id)} variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted hover:text-destructive">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formas de remuneração */}
      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Formas de Remuneração</CardTitle>
            <CardDescription>Tipos de pagamento disponíveis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={novaForma} onChange={(e) => setNovaForma(e.target.value)}
                placeholder="Nova forma (ex: Ajuda missionária extra)" />
              <Button onClick={addForma} disabled={busy || !novaForma.trim()} size="sm" className="gap-1 shrink-0">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {formas.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                  <span className="text-sm text-navy">{f.nome}</span>
                  <Button onClick={() => desativarForma(f.id)} variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted hover:text-destructive">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MASTER — GpvAdmin
// ══════════════════════════════════════════════════════════════

export function GpvAdmin() {
  const { data: churches = [] } = useChurches();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-gold" />
            Gestão de Pessoas e Vínculos
          </CardTitle>
          <CardDescription>
            Cadastro único de pessoas · Vínculos e remunerações · Pagamentos · Histórico · GED
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="pessoas">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="pessoas" className="gap-1.5"><Users className="h-3.5 w-3.5" />Pessoas</TabsTrigger>
          <TabsTrigger value="vinculos" className="gap-1.5"><Link2 className="h-3.5 w-3.5" />Vínculos</TabsTrigger>
          <TabsTrigger value="pagamentos" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" />Pagamentos</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5"><Clock className="h-3.5 w-3.5" />Histórico</TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5"><FolderOpen className="h-3.5 w-3.5" />Documentos</TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-1.5"><Settings className="h-3.5 w-3.5" />Configurações</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="pessoas"><PessoasTab churches={churches} /></TabsContent>
          <TabsContent value="vinculos"><VinculosTab churches={churches} /></TabsContent>
          <TabsContent value="pagamentos"><PagamentosTab /></TabsContent>
          <TabsContent value="historico"><HistoricoTab /></TabsContent>
          <TabsContent value="documentos"><DocumentosTab /></TabsContent>
          <TabsContent value="configuracoes"><ConfiguracoesTab churches={churches} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
