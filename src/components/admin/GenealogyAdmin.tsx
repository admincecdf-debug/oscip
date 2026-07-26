"use client";
import { useState, useMemo } from "react";
import { GitBranch, ChevronRight, ChevronDown, Calendar, Users, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLgGenealogy, useChurches } from "@/hooks/use-queries";
import type { LgGenealogyNode } from "@/types/domain";

interface TreeNode extends LgGenealogyNode { children: TreeNode[]; }

function buildGenealogyTree(nodes: LgGenealogyNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  nodes.forEach(n => byId.set(n.id, { ...n, children: [] }));
  const roots: TreeNode[] = [];
  nodes.forEach(n => {
    const node = byId.get(n.id)!;
    if (n.mother_cell_id && byId.has(n.mother_cell_id)) {
      byId.get(n.mother_cell_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  em_formacao:      { label: "Em Formação",      cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  ativo:            { label: "Ativo",            cls: "bg-green-50 text-green-700 border-green-200" },
  em_multiplicacao: { label: "Em Multiplicação", cls: "bg-gold/15 text-gold border-gold/30" },
  multiplicado:     { label: "Multiplicado",     cls: "bg-purple-50 text-purple-700 border-purple-200" },
  encerrado:        { label: "Encerrado",        cls: "bg-gray-100 text-gray-600 border-gray-300" },
};

export function GenealogyAdmin({ initialChurchId = "" }: { initialChurchId?: string } = {}) {
  const { data: nodes = [], isLoading } = useLgGenealogy();
  const { data: churches = [] } = useChurches();
  const churchMap = new Map(churches.map(c => [c.id, c]));
  const [churchFilter, setChurchFilter] = useState<string>(initialChurchId);

  const filtered = churchFilter
    ? nodes.filter(n => n.church_id === churchFilter)
    : nodes;

  const tree = useMemo(() => buildGenealogyTree(filtered), [filtered]);

  // Stats globais
  const stats = useMemo(() => {
    const roots = nodes.filter(n => !n.mother_cell_id).length;
    const withChildren = nodes.filter(n => n.direct_children_count > 0).length;
    const totalChildren = nodes.filter(n => n.mother_cell_id).length;
    const maxGen = Math.max(0, ...nodes.map(n => n.generation));
    return { roots, withChildren, totalChildren, maxGen };
  }, [nodes]);

  if (isLoading) {
    return <p className="py-8 text-center text-sm italic text-muted">Carregando genealogia…</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-gold" />Genealogia Ministerial</CardTitle>
          <CardDescription>
            Árvore de multiplicação dos Life Groups. Cada LG nascido de uma multiplicação aparece como filho do LG original.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Stats */}
          <div className="grid gap-2 sm:grid-cols-4">
            <Stat label="LGs raiz" value={stats.roots} sub="sem mãe registrada" />
            <Stat label="Multiplicadores" value={stats.withChildren} sub="já geraram filhos" />
            <Stat label="LGs filhos" value={stats.totalChildren} sub="nascidos de multiplicação" />
            <Stat label="Gerações" value={stats.maxGen + 1} sub="profundidade da árvore" />
          </div>

          {/* Filtro por comunidade */}
          {churches.length > 1 && (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-muted">Filtrar por comunidade</label>
              <select value={churchFilter} onChange={(e) => setChurchFilter(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:w-72">
                <option value="">Todas as comunidades</option>
                {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Árvore */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Árvore de multiplicação</CardTitle>
          <CardDescription>Clique para expandir/colapsar cada nó</CardDescription>
        </CardHeader>
        <CardContent>
          {tree.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-muted">
              Nenhum Life Group {churchFilter && "nesta comunidade "}cadastrado ainda.
            </p>
          ) : (
            <div className="space-y-1">
              {tree.map(n => <GenNode key={n.id} node={n} churchMap={churchMap} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GenNode({ node, churchMap }: { node: TreeNode; churchMap: Map<string, { name: string }> }) {
  const [open, setOpen] = useState(node.generation < 2);  // Abre primeiras 2 gerações por padrão
  const hasKids = node.children.length > 0;
  const church = node.church_id ? churchMap.get(node.church_id) : null;
  const statusCfg = node.status_lg ? STATUS_LABELS[node.status_lg] : null;

  return (
    <div>
      <div
        className="flex items-start gap-2 rounded-md border bg-card p-2.5 hover:bg-navy-50/30"
        style={{ marginLeft: `${node.generation * 1.5}rem` }}>
        {hasKids ? (
          <button onClick={() => setOpen(o => !o)} className="text-muted hover:text-navy">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <GitBranch className="h-4 w-4 shrink-0 text-gold" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <b className="text-sm text-navy">{node.name}</b>
            {node.generation === 0 && (
              <span className="rounded-md border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gold">
                <Crown className="mr-0.5 inline h-2.5 w-2.5" />Raiz
              </span>
            )}
            {statusCfg && (
              <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusCfg.cls}`}>
                {statusCfg.label}
              </span>
            )}
            {node.direct_children_count > 0 && (
              <span className="rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-green-700">
                {node.direct_children_count} filho{node.direct_children_count > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            {church && <span>🏢 {church.name}</span>}
            <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{node.members_count} membros</span>
            {node.founded_at && (
              <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />
                Fundado em {new Date(node.founded_at).toLocaleDateString("pt-BR")}
              </span>
            )}
            <span className="text-[10px] uppercase">G{node.generation}</span>
          </div>
        </div>
      </div>

      {open && hasKids && (
        <div className="mt-1 space-y-1">
          {node.children.map(child => <GenNode key={child.id} node={child} churchMap={churchMap} />)}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="text-2xl font-bold text-navy">{value}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  );
}
