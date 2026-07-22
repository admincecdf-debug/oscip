"use client";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2, Network, ChevronRight, ChevronDown, Pencil, ArrowRight, Trash2,
  AlertTriangle, Users, Heart, FileText, Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useChurches } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { getChurchDependencies, moveChurch, deleteChurch } from "@/services/community";
import { logAudit } from "@/services/audit";
import type { Church, ChurchDependencies } from "@/types/domain";

const TYPE_LABELS: Record<string, string> = {
  sede: "Sede", nucleo: "Núcleo", igreja_local: "Igreja Local",
};
const TYPE_COLORS: Record<string, string> = {
  sede: "bg-gold/15 text-gold border-gold/30",
  nucleo: "bg-blue-50 text-blue-700 border-blue-200",
  igreja_local: "bg-green-50 text-green-700 border-green-200",
};
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ativa:          { label: "Ativa",          cls: "bg-green-50 text-green-700 border-green-200" },
  em_implantacao: { label: "Em Implantação", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  inativa:        { label: "Inativa",        cls: "bg-gray-100 text-gray-600 border-gray-300" },
};

interface LifeGroup { id: string; name: string; church_id: string; status_lg?: string; is_active: boolean; }

interface TreeNode {
  church: Church;
  children: TreeNode[];
  level: number;
}

function buildTree(churches: Church[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  churches.forEach(c => byId.set(c.id, { church: c, children: [], level: 0 }));
  const roots: TreeNode[] = [];
  churches.forEach(c => {
    const node = byId.get(c.id)!;
    if (c.parent_id && byId.has(c.parent_id)) {
      const parent = byId.get(c.parent_id)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const typeOrder = (t: string) => t === "sede" ? 0 : t === "nucleo" ? 1 : 2;
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const t = typeOrder(a.church.type) - typeOrder(b.church.type);
      if (t !== 0) return t;
      return a.church.name.localeCompare(b.church.name);
    });
    nodes.forEach(n => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function OrgStructureAdmin() {
  const { data: churches = [] } = useChurches();
  const [lifeGroups, setLifeGroups] = useState<LifeGroup[]>([]);
  const tree = buildTree(churches);
  const [moving, setMoving] = useState<Church | null>(null);
  const [deleting, setDeleting] = useState<{ church: Church; deps: ChurchDependencies } | null>(null);

  // Carrega todos os Life Groups uma vez
  useEffect(() => {
    supabase.from("life_groups").select("id, name, church_id, status_lg, is_active")
      .eq("is_active", true).order("name")
      .then(({ data }) => setLifeGroups((data as LifeGroup[]) ?? []));
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Network className="h-5 w-5 text-gold" />Estrutura Organizacional</CardTitle>
          <CardDescription>
            Hierarquia completa da CEC Brasil incluindo Life Groups em cada comunidade.
            Para criar novas comunidades, use a aba <b>Comunidades</b>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tree.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-muted">Nenhuma comunidade cadastrada ainda.</p>
          ) : (
            <div className="space-y-1">
              {tree.map(node => (
                <TreeNodeView key={node.church.id} node={node}
                  lifeGroups={lifeGroups}
                  onMove={setMoving}
                  onAskDelete={async (c) => {
                    const deps = await getChurchDependencies(supabase, c.id);
                    setDeleting({ church: c, deps: deps ?? { children: 0, life_groups: 0, members: 0, reports: 0, total: 0 } });
                  }} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {moving && <MoveDialog church={moving} churches={churches} onClose={() => setMoving(null)} />}
      {deleting && <DeleteDialog payload={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}

// ── Nó da árvore ─────────────────────────────────────────────
function TreeNodeView({ node, lifeGroups, onMove, onAskDelete }: {
  node: TreeNode;
  lifeGroups: LifeGroup[];
  onMove: (c: Church) => void;
  onAskDelete: (c: Church) => void;
}) {
  const [open, setOpen] = useState(true);
  const [showLgs, setShowLgs] = useState(false);
  const { church: c, children } = node;
  const status = c.status_admin ?? "ativa";
  const statusCfg = STATUS_LABELS[status];
  const myLgs = lifeGroups.filter(lg => lg.church_id === c.id);

  return (
    <div>
      <div className="flex items-center gap-2 rounded-md border bg-card p-2.5 hover:bg-navy-50/30"
        style={{ marginLeft: `${node.level * 1.5}rem` }}>

        {/* Toggle filhos */}
        {(children.length > 0 || myLgs.length > 0) ? (
          <button onClick={() => setOpen(o => !o)} className="text-muted hover:text-navy">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <Building2 className="h-4 w-4 shrink-0 text-gold" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <b className="truncate text-sm text-navy">{c.name}</b>
            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${TYPE_COLORS[c.type]}`}>
              {TYPE_LABELS[c.type]}
            </span>
            {statusCfg && (
              <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusCfg.cls}`}>
                {statusCfg.label}
              </span>
            )}
            {myLgs.length > 0 && (
              <button onClick={() => setShowLgs(s => !s)}
                className="flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-700 hover:bg-orange-100">
                <Flame className="h-3 w-3" />{myLgs.length} Life Group{myLgs.length > 1 ? "s" : ""}
              </button>
            )}
          </div>
          {(c.city || c.state) && (
            <p className="truncate text-[11px] text-muted">{[c.city, c.state].filter(Boolean).join(", ")}</p>
          )}
        </div>

        <div className="flex gap-1">
          <Button onClick={() => onMove(c)} variant="outline" size="sm" className="h-7 px-2 gap-1" title="Mover">
            <ArrowRight className="h-3 w-3" />Mover
          </Button>
          <Button onClick={() => onAskDelete(c)} variant="destructive" size="sm" className="h-7 px-2" title="Excluir">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Life Groups desta comunidade */}
      {open && showLgs && myLgs.length > 0 && (
        <div className="mt-0.5 space-y-0.5" style={{ marginLeft: `${(node.level + 1) * 1.5}rem` }}>
          {myLgs.map(lg => (
            <div key={lg.id} className="flex items-center gap-2 rounded-md border border-orange-100 bg-orange-50/50 px-3 py-1.5">
              <Flame className="h-3.5 w-3.5 shrink-0 text-orange-500" />
              <span className="text-sm text-navy">{lg.name}</span>
              {lg.status_lg && (
                <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                  {lg.status_lg.replace(/_/g, " ")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filhos */}
      {open && children.length > 0 && (
        <div className="mt-1 space-y-1">
          {children.map(child => (
            <TreeNodeView key={child.church.id} node={child}
              lifeGroups={lifeGroups}
              onMove={onMove} onAskDelete={onAskDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dialog Mover ─────────────────────────────────────────────
function MoveDialog({ church, churches, onClose }: { church: Church; churches: Church[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [selectedParent, setSelectedParent] = useState<string>(church.parent_id ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const candidates = churches.filter(c => {
    if (c.id === church.id) return false;
    if (church.type === "sede" && c.type !== "sede") return false;
    if (church.type === "nucleo" && c.type !== "sede") return false;
    if (church.type === "igreja_local" && !["sede","nucleo"].includes(c.type)) return false;
    return true;
  });

  async function save() {
    setErr(""); setBusy(true);
    try {
      await moveChurch(supabase, church.id, selectedParent || null);
      await logAudit(supabase, "update", "churches", church.id, { moved_to: selectedParent });
      qc.invalidateQueries({ queryKey: ["churches"] });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Mover comunidade</CardTitle>
          <CardDescription>Mover <b>{church.name}</b> para outra Comunidade Mãe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Nova Comunidade Mãe</Label>
          <select value={selectedParent} onChange={(e) => setSelectedParent(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            {church.type === "sede" && <option value="">— Sem Comunidade Mãe —</option>}
            {candidates.map(c => <option key={c.id} value={c.id}>{c.name} ({TYPE_LABELS[c.type]})</option>)}
          </select>
          {candidates.length === 0 && church.type !== "sede" && (
            <p className="text-xs text-yellow-700">
              {church.type === "nucleo" ? "Núcleos precisam de uma Sede." : "Igrejas Locais precisam de uma Sede ou Núcleo."}
            </p>
          )}
          {err && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={onClose} variant="outline">Cancelar</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Mover"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Dialog Apagar ─────────────────────────────────────────────
function DeleteDialog({ payload, onClose }: { payload: { church: Church; deps: ChurchDependencies }; onClose: () => void }) {
  const qc = useQueryClient();
  const { church, deps } = payload;
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const canDelete = deps.total === 0;

  async function confirmDelete() {
    setErr(""); setBusy(true);
    try {
      await deleteChurch(supabase, church.id);
      await logAudit(supabase, "delete", "churches", church.id, { name: church.name });
      qc.invalidateQueries({ queryKey: ["churches"] });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />Excluir comunidade
          </CardTitle>
          <CardDescription>Prestes a apagar <b>{church.name}</b>. Esta ação não pode ser desfeita.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {canDelete ? (
            <div className="rounded-md border-l-4 border-l-green-500 bg-green-50 p-3 text-sm text-green-800">
              Esta comunidade não tem vínculos. Pode ser excluída com segurança.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-md border-l-4 border-l-red-500 bg-red-50 p-3 text-sm text-red-800">
                <b>Não é possível excluir.</b> Existem vínculos que devem ser removidos antes:
              </div>
              <ul className="space-y-1.5 text-sm">
                {deps.children > 0 && <li className="flex items-center gap-2"><Building2 className="h-4 w-4 text-gold" /><b>{deps.children}</b> comunidade(s) filha(s)</li>}
                {deps.life_groups > 0 && <li className="flex items-center gap-2"><Heart className="h-4 w-4 text-gold" /><b>{deps.life_groups}</b> Life Group(s)</li>}
                {deps.members > 0 && <li className="flex items-center gap-2"><Users className="h-4 w-4 text-gold" /><b>{deps.members}</b> membro(s)</li>}
                {deps.reports > 0 && <li className="flex items-center gap-2"><FileText className="h-4 w-4 text-gold" /><b>{deps.reports}</b> relatório(s)</li>}
              </ul>
            </div>
          )}
          {err && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={onClose} variant="outline">Cancelar</Button>
            {canDelete && (
              <Button onClick={confirmDelete} disabled={busy} variant="destructive">
                {busy ? "Excluindo…" : "Confirmar exclusão"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
