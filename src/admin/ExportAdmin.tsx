"use client";
import { useState } from "react";
import {
  Download, FileSpreadsheet, FileText, Users,
  ClipboardList, Building2, Wallet, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChurches } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import {
  exportToExcel, exportToPDF,
  MEMBER_COLUMNS, WEEKLY_REPORT_COLUMNS,
  ASSET_COLUMNS, PROPERTY_COLUMNS, FINANCE_COLUMNS,
} from "@/lib/export";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const JOURNEY_LABELS: Record<string, string> = {
  visitante:"Visitante", novo_convertido:"Novo Convertido", consolidacao:"Consolidação",
  discipulado:"Discipulado", batismo:"Batismo", membro_ativo:"Membro Ativo",
  servo:"Servo", lider_formacao:"Líder em Formação", lider:"Líder",
  supervisor:"Supervisor", missionario:"Missionário",
};

// ── Card de exportação ────────────────────────────────────────
function ExportCard({
  title, description, icon, onExcel, onPDF, loading,
}: {
  title: string; description: string;
  icon: React.ReactNode;
  onExcel: () => Promise<void>;
  onPDF?: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-[#0E2A47]/10 shrink-0">{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#0E2A47]">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm" variant="outline"
              onClick={onExcel} disabled={loading}
              className="gap-1.5 border-green-600 text-green-700 hover:bg-green-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <FileSpreadsheet className="h-3.5 w-3.5"/>}
              Excel
            </Button>
            {onPDF && (
              <Button
                size="sm" variant="outline"
                onClick={onPDF} disabled={loading}
                className="gap-1.5 border-red-500 text-red-600 hover:bg-red-50"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <FileText className="h-3.5 w-3.5"/>}
                PDF
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// EXPORT ADMIN
// ══════════════════════════════════════════════════════════════
export function ExportAdmin() {
  const { data: churches = [] } = useChurches();
  const today = new Date();
  const [churchId, setChurchId] = useState("");
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState<string | null>(null);

  const churchName = churches.find(c => c.id === churchId)?.name ?? "Todas";

  async function run(key: string, fn: () => Promise<void>) {
    setLoading(key);
    try { await fn(); } catch (e) { console.error(e); alert("Erro ao exportar. Tente novamente."); }
    finally { setLoading(null); }
  }

  // ── Membros ──────────────────────────────────────────────
  async function exportMembrosExcel() {
    let q = supabase.from("members").select("*").order("full_name");
    if (churchId) q = q.eq("church_id", churchId);
    const { data } = await q;
    const rows = (data ?? []).map(m => ({
      ...m,
      journey_stage: JOURNEY_LABELS[m.journey_stage] ?? m.journey_stage,
      status: m.status === "ativo" ? "Ativo" : m.status === "inativo" ? "Inativo" : m.status,
    }));
    exportToExcel(rows, MEMBER_COLUMNS, `membros_${churchName}_${today.toISOString().slice(0,10)}`, "Membros");
  }

  async function exportMembrosPDF() {
    let q = supabase.from("members").select("*").order("full_name");
    if (churchId) q = q.eq("church_id", churchId);
    const { data } = await q;
    const rows = (data ?? []).map(m => ({
      ...m,
      journey_stage: JOURNEY_LABELS[m.journey_stage] ?? m.journey_stage,
      status: m.status === "ativo" ? "Ativo" : "Inativo",
    }));
    await exportToPDF({
      title: "Lista de Membros",
      subtitle: `${churchName} · ${rows.length} registros`,
      columns: MEMBER_COLUMNS,
      data: rows,
      filename: `membros_${churchName}_${today.toISOString().slice(0,10)}`,
      landscape: true,
    });
  }

  // ── Relatórios Semanais ──────────────────────────────────
  async function exportRelatoriosExcel() {
    const start = `${year}-${String(month).padStart(2,"0")}-01`;
    const next = month === 12 ? `${year+1}-01-01` : `${year}-${String(month+1).padStart(2,"0")}-01`;
    let q = supabase.from("meeting_reports")
      .select("*, life_groups(name)")
      .gte("meeting_date", start).lt("meeting_date", next)
      .order("meeting_date", { ascending: false });
    const { data } = await q;
    const rows = (data ?? []).map((r: Record<string, unknown> & { life_groups?: { name: string } | null }) => ({
      ...r,
      life_group_id: r.life_groups?.name ?? r.life_group_id,
    }));
    exportToExcel(rows, WEEKLY_REPORT_COLUMNS,
      `relatorios_semanais_${MONTHS[month-1]}_${year}`, "Relatórios");
  }

  async function exportRelatoriosPDF() {
    const start = `${year}-${String(month).padStart(2,"0")}-01`;
    const next = month === 12 ? `${year+1}-01-01` : `${year}-${String(month+1).padStart(2,"0")}-01`;
    const { data } = await supabase.from("meeting_reports")
      .select("*, life_groups(name)")
      .gte("meeting_date", start).lt("meeting_date", next)
      .order("meeting_date", { ascending: false });
    const rows = (data ?? []).map((r: Record<string, unknown> & { life_groups?: { name: string } | null }) => ({
      ...r,
      life_group_id: r.life_groups?.name ?? r.life_group_id,
    }));
    await exportToPDF({
      title: "Relatórios Semanais",
      subtitle: `${MONTHS[month-1]}/${year} · ${rows.length} relatórios`,
      columns: WEEKLY_REPORT_COLUMNS,
      data: rows,
      filename: `relatorios_semanais_${MONTHS[month-1]}_${year}`,
      landscape: true,
    });
  }

  // ── Bens Patrimoniais ───────────────────────────────────
  async function exportBensExcel() {
    let q = supabase.from("assets").select("*").eq("is_active", true).order("name");
    if (churchId) q = q.eq("church_id", churchId);
    const { data } = await q;
    exportToExcel(data ?? [], ASSET_COLUMNS,
      `bens_${churchName}_${today.toISOString().slice(0,10)}`, "Bens");
  }

  async function exportBensPDF() {
    let q = supabase.from("assets").select("*").eq("is_active", true).order("name");
    if (churchId) q = q.eq("church_id", churchId);
    const { data } = await q;
    await exportToPDF({
      title: "Inventário de Bens",
      subtitle: `${churchName} · ${(data ?? []).length} bens`,
      columns: ASSET_COLUMNS,
      data: data ?? [],
      filename: `bens_${churchName}_${today.toISOString().slice(0,10)}`,
      landscape: true,
    });
  }

  // ── Imóveis ─────────────────────────────────────────────
  async function exportImoveisExcel() {
    let q = supabase.from("properties").select("*").eq("is_active", true).order("name");
    if (churchId) q = q.eq("church_id", churchId);
    const { data } = await q;
    exportToExcel(data ?? [], PROPERTY_COLUMNS,
      `imoveis_${churchName}_${today.toISOString().slice(0,10)}`, "Imóveis");
  }

  // ── Financeiro ──────────────────────────────────────────
  async function exportFinanceiroExcel() {
    const start = `${year}-${String(month).padStart(2,"0")}-01`;
    const next = month === 12 ? `${year+1}-01-01` : `${year}-${String(month+1).padStart(2,"0")}-01`;
    let q = supabase.from("finances").select("*")
      .gte("occurred_on", start).lt("occurred_on", next)
      .order("occurred_on", { ascending: false });
    if (churchId) q = q.eq("church_id", churchId);
    const { data } = await q;
    exportToExcel(data ?? [], FINANCE_COLUMNS,
      `financeiro_${churchName}_${MONTHS[month-1]}_${year}`, "Financeiro");
  }

  async function exportFinanceiroPDF() {
    const start = `${year}-${String(month).padStart(2,"0")}-01`;
    const next = month === 12 ? `${year+1}-01-01` : `${year}-${String(month+1).padStart(2,"0")}-01`;
    let q = supabase.from("finances").select("*")
      .gte("occurred_on", start).lt("occurred_on", next)
      .order("occurred_on", { ascending: false });
    if (churchId) q = q.eq("church_id", churchId);
    const { data } = await q;
    await exportToPDF({
      title: "Relatório Financeiro",
      subtitle: `${churchName} · ${MONTHS[month-1]}/${year}`,
      columns: FINANCE_COLUMNS,
      data: data ?? [],
      filename: `financeiro_${churchName}_${MONTHS[month-1]}_${year}`,
    });
  }

  const isLoading = (key: string) => loading === key;

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center gap-2">
        <Download className="h-6 w-6 text-[#C9A227]"/>
        <div>
          <h2 className="text-xl font-bold text-[#0E2A47]">Central de Exportação</h2>
          <p className="text-xs text-muted-foreground">Excel (.xlsx) e PDF para todos os módulos</p>
        </div>
      </div>

      {/* Filtros globais */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs">Comunidade</Label>
              <Select value={churchId} onValueChange={setChurchId}>
                <SelectTrigger className="w-52 mt-1"><SelectValue placeholder="Todas as comunidades"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as comunidades</SelectItem>
                  {churches.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mês (relatórios/financeiro)</Label>
              <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                <SelectTrigger className="w-40 mt-1"><SelectValue/></SelectTrigger>
                <SelectContent>{MONTHS.map((m,i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Input type="number" min="2020" max="2100" value={year}
                onChange={e => setYear(Number(e.target.value))} className="w-24 mt-1 h-9"/>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Membros */}
      <div>
        <h3 className="text-sm font-bold text-[#0E2A47] mb-2 flex items-center gap-2">
          <Users className="h-4 w-4"/>Membros
        </h3>
        <ExportCard
          title="Lista de Membros"
          description={`Todos os membros ${churchId ? `de ${churchName}` : "de todas as comunidades"} com estágio, status e contato`}
          icon={<Users className="h-5 w-5 text-[#0E2A47]"/>}
          onExcel={() => run("membros-excel", exportMembrosExcel)}
          onPDF={() => run("membros-pdf", exportMembrosPDF)}
          loading={isLoading("membros-excel") || isLoading("membros-pdf")}
        />
      </div>

      {/* Relatórios */}
      <div>
        <h3 className="text-sm font-bold text-[#0E2A47] mb-2 flex items-center gap-2">
          <ClipboardList className="h-4 w-4"/>Relatórios Semanais
        </h3>
        <ExportCard
          title={`Relatórios de ${MONTHS[month-1]}/${year}`}
          description="Todos os relatórios semanais do período com presença, visitantes, decisões e discipulado"
          icon={<ClipboardList className="h-5 w-5 text-[#0E2A47]"/>}
          onExcel={() => run("relat-excel", exportRelatoriosExcel)}
          onPDF={() => run("relat-pdf", exportRelatoriosPDF)}
          loading={isLoading("relat-excel") || isLoading("relat-pdf")}
        />
      </div>

      {/* Patrimônio */}
      <div>
        <h3 className="text-sm font-bold text-[#0E2A47] mb-2 flex items-center gap-2">
          <Building2 className="h-4 w-4"/>Patrimônio
        </h3>
        <div className="space-y-2">
          <ExportCard
            title="Inventário de Bens"
            description="Lista completa de bens patrimoniais com categoria, condição, valor e número de série"
            icon={<Building2 className="h-5 w-5 text-[#0E2A47]"/>}
            onExcel={() => run("bens-excel", exportBensExcel)}
            onPDF={() => run("bens-pdf", exportBensPDF)}
            loading={isLoading("bens-excel") || isLoading("bens-pdf")}
          />
          <ExportCard
            title="Imóveis"
            description="Lista de imóveis com endereço, tipo de ocupação, proprietário e datas de contrato"
            icon={<Building2 className="h-5 w-5 text-[#0E2A47]"/>}
            onExcel={() => run("imoveis-excel", exportImoveisExcel)}
            loading={isLoading("imoveis-excel")}
          />
        </div>
      </div>

      {/* Financeiro */}
      <div>
        <h3 className="text-sm font-bold text-[#0E2A47] mb-2 flex items-center gap-2">
          <Wallet className="h-4 w-4"/>Financeiro
        </h3>
        <ExportCard
          title={`Lançamentos de ${MONTHS[month-1]}/${year}`}
          description="Todos os lançamentos financeiros do período com categoria, valor e descrição"
          icon={<Wallet className="h-5 w-5 text-[#0E2A47]"/>}
          onExcel={() => run("fin-excel", exportFinanceiroExcel)}
          onPDF={() => run("fin-pdf", exportFinanceiroPDF)}
          loading={isLoading("fin-excel") || isLoading("fin-pdf")}
        />
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        💡 Arquivos Excel abrem diretamente no Microsoft Excel e Google Sheets.
        PDFs são gerados com formatação CEC Family.
      </p>
    </div>
  );
}
