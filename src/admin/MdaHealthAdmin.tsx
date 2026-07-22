"use client";
import { useState, useMemo } from "react";
import {
  Activity, ChevronRight, ChevronDown, Building2, Network, Map as MapIcon,
  Users, Heart, Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMdaHealth } from "@/hooks/use-queries";
import type { MdaHealthRow, MdaStatus } from "@/types/domain";

// ============================================================
// CONFIG VISUAL
// ============================================================
const STATUS_CFG: Record<MdaStatus | "none", { label: string; emoji: string; bg: string; border: string; text: string }> = {
  saudavel:  { label: "Saudável",       emoji: "🟢", bg: "bg-green-50",  border: "border-green-300",  text: "text-green-700"  },
  atencao:   { label: "Atenção",        emoji: "🟡", bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-700" },
  necessita: { label: "Necessita apoio", emoji: "🔴", bg: "bg-red-50",    border: "border-red-300",    text: "text-red-700"    },
  none:      { label: "Sem dados",       emoji: "⚪", bg: "bg-gray-50",   border: "border-gray-200",   text: "text-gray-500"   },
};

function StatusBadge({ status }: { status: MdaStatus | null | undefined }) {
  const cfg = STATUS_CFG[status ?? "none"];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span>{cfg.emoji}</span>{cfg.label}
    </span>
  );
}

// ============================================================
// AGREGAÇÃO HIERÁRQUICA (lê linhas chatas e monta a árvore)
// ============================================================
interface LgNode { id: string; name: string; status: MdaStatus | null; members: number; lastReport: string | null; statusLg: string | null; }
interface SectorNode { id: string; name: string; status: MdaStatus; lgs: LgNode[]; }
interface AreaNode { id: string; name: string; status: MdaStatus; sectors: SectorNode[]; }
interface DistrictNode { id: string; name: string; status: MdaStatus; areas: AreaNode[]; }
interface ChurchNode { id: string; name: string; type: string; status: MdaStatus; districts: DistrictNode[]; }

function buildTree(rows: MdaHealthRow[]): ChurchNode[] {
  const churches = new Map<string, ChurchNode>();

  for (const r of rows) {
    // Igreja
    if (!churches.has(r.church_id)) {
      churches.set(r.church_id, {
        id: r.church_id, name: r.church_name, type: r.church_type,
        status: r.church_health, districts: [],
      });
    }
    const ch = churches.get(r.church_id)!;

    if (!r.district_id) continue;
    let dist = ch.districts.find(d => d.id === r.district_id);
    if (!dist) {
      dist = { id: r.district_id, name: r.district_name!, status: r.district_health!, areas: [] };
      ch.districts.push(dist);
    }

    if (!r.area_id) continue;
    let area = dist.areas.find(a => a.id === r.area_id);
    if (!area) {
      area = { id: r.area_id, name: r.area_name!, status: r.area_health!, sectors: [] };
      dist.areas.push(area);
    }

    if (!r.sector_id) continue;
    let sector = area.sectors.find(s => s.id === r.sector_id);
    if (!sector) {
      sector = { id: r.sector_id, name: r.sector_name!, status: r.sector_health!, lgs: [] };
      area.sectors.push(sector);
    }

    if (!r.lg_id) continue;
    if (!sector.lgs.find(l => l.id === r.lg_id)) {
      sector.lgs.push({
        id: r.lg_id, name: r.lg_name!, status: r.lg_health,
        members: r.lg_members_count ?? 0,
        lastReport: r.lg_last_report_date,
        statusLg: r.lg_status_lg,
      });
    }
  }

  return Array.from(churches.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export function MdaHealthAdmin() {
  const { data: rows = [], isLoading } = useMdaHealth();

  const tree = useMemo(() => buildTree(rows), [rows]);

  // Resumo geral por nível
  const summary = useMemo(() => {
    const c = { saudavel: 0, atencao: 0, necessita: 0 };
    const d = { saudavel: 0, atencao: 0, necessita: 0 };
    const a = { saudavel: 0, atencao: 0, necessita: 0 };
    const s = { saudavel: 0, atencao: 0, necessita: 0 };
    const l = { saudavel: 0, atencao: 0, necessita: 0, none: 0 };
    const seen = { c: new Set<string>(), d: new Set<string>(), a: new Set<string>(), s: new Set<string>(), l: new Set<string>() };
    for (const r of rows) {
      if (!seen.c.has(r.church_id)) { c[r.church_health]++; seen.c.add(r.church_id); }
      if (r.district_id && r.district_health && !seen.d.has(r.district_id)) { d[r.district_health]++; seen.d.add(r.district_id); }
      if (r.area_id && r.area_health && !seen.a.has(r.area_id)) { a[r.area_health]++; seen.a.add(r.area_id); }
      if (r.sector_id && r.sector_health && !seen.s.has(r.sector_id)) { s[r.sector_health]++; seen.s.add(r.sector_id); }
      if (r.lg_id && !seen.l.has(r.lg_id)) {
        if (r.lg_health) l[r.lg_health]++; else l.none++;
        seen.l.add(r.lg_id);
      }
    }
    return { churches: c, districts: d, areas: a, sectors: s, lgs: l };
  }, [rows]);

  if (isLoading) {
    return <p className="py-8 text-center text-sm italic text-muted">Calculando saúde da rede…</p>;
  }

  if (tree.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Activity className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 text-sm text-muted">Sem dados na estrutura MDA ainda.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-gold" />Saúde da Rede MDA</CardTitle>
          <CardDescription>
            Classificação 🟢🟡🔴 calculada automaticamente a partir dos relatórios semanais.
            Cada nível agrega a saúde dos níveis subordinados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border-l-4 border-l-blue-500 bg-blue-50 p-3 text-xs text-blue-900">
            <b>Regras:</b> LG é avaliado pelo último relatório semanal (saúde do líder + frequência).
            Setor herda dos LGs, Área dos Setores, Distrito das Áreas, Igreja dos Distritos.
            Se algum filho está 🔴, o pai vira 🔴; se algum está 🟡, vira 🟡; senão 🟢.
          </div>
        </CardContent>
      </Card>

      {/* Cards de resumo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard title="Igrejas" icon={<Building2 />} counts={summary.churches} />
        <SummaryCard title="Distritos" icon={<MapIcon />} counts={summary.districts} />
        <SummaryCard title="Áreas" icon={<Network />} counts={summary.areas} />
        <SummaryCard title="Setores" icon={<Users />} counts={summary.sectors} />
        <SummaryCard title="Life Groups" icon={<Heart />} counts={summary.lgs} />
      </div>

      {/* Árvore expansível */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Árvore hierárquica</CardTitle>
          <CardDescription>Clique para expandir cada nível</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {tree.map(ch => <ChurchTreeNode key={ch.id} church={ch} />)}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTES
// ============================================================
function SummaryCard({ title, icon, counts }: {
  title: string;
  icon: React.ReactNode;
  counts: { saudavel: number; atencao: number; necessita: number; none?: number };
}) {
  const total = counts.saudavel + counts.atencao + counts.necessita + (counts.none ?? 0);
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-navy-600">
            <span className="text-gold [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
            <p className="text-xs font-bold uppercase tracking-wider">{title}</p>
          </div>
          <b className="font-display text-lg text-navy">{total}</b>
        </div>
        <div className="mt-2 flex gap-2 text-[11px]">
          {counts.saudavel > 0 && <span className="text-green-700">🟢 {counts.saudavel}</span>}
          {counts.atencao > 0 && <span className="text-yellow-700">🟡 {counts.atencao}</span>}
          {counts.necessita > 0 && <span className="text-red-700">🔴 {counts.necessita}</span>}
          {(counts.none ?? 0) > 0 && <span className="text-gray-500">⚪ {counts.none}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function ChurchTreeNode({ church }: { church: ChurchNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 rounded-md border bg-card p-2.5 hover:bg-navy-50/30 text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
        <Building2 className="h-4 w-4 shrink-0 text-gold" />
        <b className="flex-1 truncate text-sm text-navy">{church.name}</b>
        <StatusBadge status={church.status} />
      </button>
      {open && church.districts.length > 0 && (
        <div className="mt-1 ml-6 space-y-1">
          {church.districts.map(d => <DistrictTreeNode key={d.id} district={d} />)}
        </div>
      )}
      {open && church.districts.length === 0 && (
        <p className="ml-10 mt-1 text-[11px] italic text-muted">Sem distritos cadastrados</p>
      )}
    </div>
  );
}

function DistrictTreeNode({ district }: { district: DistrictNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 rounded-md border bg-card p-2 hover:bg-navy-50/30 text-left">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
        <MapIcon className="h-3.5 w-3.5 shrink-0 text-gold" />
        <b className="flex-1 truncate text-[13px] text-navy">Distrito · {district.name}</b>
        <StatusBadge status={district.status} />
      </button>
      {open && (
        <div className="mt-1 ml-6 space-y-1">
          {district.areas.map(a => <AreaTreeNode key={a.id} area={a} />)}
        </div>
      )}
    </div>
  );
}

function AreaTreeNode({ area }: { area: AreaNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 rounded-md border bg-card p-2 hover:bg-navy-50/30 text-left">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
        <Network className="h-3.5 w-3.5 shrink-0 text-gold" />
        <b className="flex-1 truncate text-[13px] text-navy">Área · {area.name}</b>
        <StatusBadge status={area.status} />
      </button>
      {open && (
        <div className="mt-1 ml-6 space-y-1">
          {area.sectors.map(s => <SectorTreeNode key={s.id} sector={s} />)}
        </div>
      )}
    </div>
  );
}

function SectorTreeNode({ sector }: { sector: SectorNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 rounded-md border bg-card p-2 hover:bg-navy-50/30 text-left">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
        <Users className="h-3.5 w-3.5 shrink-0 text-gold" />
        <b className="flex-1 truncate text-[13px] text-navy">Setor · {sector.name}</b>
        <StatusBadge status={sector.status} />
      </button>
      {open && (
        <div className="mt-1 ml-6 space-y-1">
          {sector.lgs.map(lg => <LgLeafNode key={lg.id} lg={lg} />)}
        </div>
      )}
    </div>
  );
}

function LgLeafNode({ lg }: { lg: LgNode }) {
  const daysSinceReport = lg.lastReport ? Math.floor((Date.now() - new Date(lg.lastReport).getTime()) / 86400000) : null;
  return (
    <div className="flex items-start gap-2 rounded-md border bg-card p-2">
      <Heart className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[13px] text-navy">{lg.name}</b>
        <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-muted">
          <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{lg.members} membros</span>
          {lg.lastReport ? (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              Último relatório: {new Date(lg.lastReport).toLocaleDateString("pt-BR")}
              {daysSinceReport !== null && daysSinceReport > 14 && <b className="text-yellow-700"> ({daysSinceReport}d)</b>}
            </span>
          ) : (
            <span className="text-yellow-700">⚠️ Sem relatório</span>
          )}
        </div>
      </div>
      <StatusBadge status={lg.status} />
    </div>
  );
}
