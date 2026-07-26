"use client";
import { useMemo, useState } from "react";
import { ChevronRight, Network, Users, Flame, ArrowLeft, Landmark, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useMdaHealth } from "@/hooks/use-queries";
import type { MdaHealthRow, MdaStatus } from "@/types/domain";

type Level = "nacional" | "estado" | "nucleo" | "distrito" | "setor" | "igreja" | "lg";
const LEVEL_ORDER: Level[] = ["nacional", "estado", "nucleo", "distrito", "setor", "igreja", "lg"];

interface PathStep { level: Level; id: string | null; name: string; }

interface NodeCard {
  id: string;
  level: Level; // nível REAL do filho (pode não ser o "próximo" fixo, se pulou nível)
  name: string;
  health: MdaStatus | null;
  childrenCount: number;
  membersCount: number;
  extra?: string;
}

const HEALTH_STYLE: Record<MdaStatus, { emoji: string; bg: string; border: string; text: string; label: string }> = {
  saudavel:  { emoji: "🟢", bg: "bg-green-50",  border: "border-green-300",  text: "text-green-700",  label: "Saudável" },
  atencao:   { emoji: "🟡", bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-700", label: "Atenção" },
  necessita: { emoji: "🔴", bg: "bg-red-50",    border: "border-red-300",    text: "text-red-700",    label: "Necessita apoio" },
};
const LEVEL_LABEL: Record<Level, string> = {
  nacional: "Nacional", estado: "Estado", nucleo: "Núcleo", distrito: "Distrito",
  setor: "Setor", igreja: "Igreja Local", lg: "Life Group",
};
const LEVEL_CHILD_LABEL: Record<Level, string> = {
  nacional: "estado(s)", estado: "unidade(s)", nucleo: "unidade(s)", distrito: "unidade(s)",
  setor: "igreja(s) local(is)", igreja: "life group(s)", lg: "",
};
const LEVEL_ICON: Record<Level, React.ReactNode> = {
  nacional: <MapPin size={16} />, estado: <MapPin size={16} />, nucleo: <Network size={16} />,
  distrito: <Network size={16} />, setor: <Network size={16} />, igreja: <Landmark size={16} />, lg: <Flame size={16} />,
};

// Pra cada linha (LG) da view, devolve o id/nome/saúde daquele nível específico —
// ou null se esse nível foi PULADO na árvore daquela igreja (níveis flexíveis).
function fieldForLevel(row: MdaHealthRow, level: Level): { id: string; name: string; health: MdaStatus | null } | null {
  switch (level) {
    case "estado": return row.state_id ? { id: row.state_id, name: row.state_name ?? "Estado", health: row.state_health } : null;
    case "nucleo": return row.nucleo_id ? { id: row.nucleo_id, name: row.nucleo_name ?? "Núcleo", health: row.nucleo_health } : null;
    case "distrito": return row.district_id ? { id: row.district_id, name: row.district_name ?? "Distrito", health: row.district_health } : null;
    case "setor": return row.sector_id ? { id: row.sector_id, name: row.sector_name ?? "Setor", health: row.sector_health } : null;
    case "igreja": return row.church_id ? { id: row.church_id, name: row.church_name ?? "Igreja", health: row.church_health } : null;
    case "lg": return row.lg_id ? { id: row.lg_id, name: row.lg_name ?? "Life Group", health: row.lg_health } : null;
    default: return null;
  }
}

// Acha o próximo nível que REALMENTE existe pra essa linha, a partir de um índice —
// é isso que permite pular Núcleo/Distrito/Setor sem a linha "desaparecer" do drill-down.
function nextExistingLevel(row: MdaHealthRow, fromIndex: number): { level: Level; data: { id: string; name: string; health: MdaStatus | null } } | null {
  for (let i = fromIndex; i < LEVEL_ORDER.length; i++) {
    const lvl = LEVEL_ORDER[i];
    const data = fieldForLevel(row, lvl);
    if (data) return { level: lvl, data };
  }
  return null;
}

export function HierarchyExplorer() {
  const { data: rows = [], isLoading } = useMdaHealth();
  const [path, setPath] = useState<PathStep[]>([{ level: "nacional", id: null, name: "Comunidade Evangélica Cristã" }]);
  const current = path[path.length - 1];

  const cards = useMemo(() => buildCards(rows, current), [rows, current]);
  const currentLg = current.level === "lg" ? rows.find((r) => r.lg_id === current.id) : null;

  function drillInto(card: NodeCard) {
    setPath((p) => [...p, { level: card.level, id: card.id, name: card.name }]);
  }
  function jumpTo(index: number) {
    setPath((p) => p.slice(0, index + 1));
  }

  if (isLoading) {
    return <p className="py-6 text-center text-sm italic text-muted">Carregando estrutura…</p>;
  }
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm italic text-muted">Sem dados de estrutura territorial ainda.</p>;
  }

  return (
    <div className="space-y-3">
      <nav className="flex flex-wrap items-center gap-1 text-xs text-muted">
        {path.length > 1 && (
          <button onClick={() => jumpTo(path.length - 2)} className="mr-1 flex items-center gap-1 rounded border px-1.5 py-0.5 hover:bg-muted/30">
            <ArrowLeft size={11} /> Voltar
          </button>
        )}
        {path.map((step, i) => (
          <span key={`${step.level}-${step.id ?? "root"}`} className="flex items-center gap-1">
            <button
              onClick={() => jumpTo(i)}
              disabled={i === path.length - 1}
              className={i === path.length - 1 ? "font-semibold text-navy" : "hover:underline"}
            >
              {step.name}
            </button>
            {i < path.length - 1 && <ChevronRight size={11} />}
          </span>
        ))}
      </nav>

      {current.level === "lg" && currentLg ? (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <Flame size={16} className="text-gold" />
              <b className="text-navy">{currentLg.lg_name}</b>
              {currentLg.lg_health && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${HEALTH_STYLE[currentLg.lg_health].bg} ${HEALTH_STYLE[currentLg.lg_health].border} ${HEALTH_STYLE[currentLg.lg_health].text}`}>
                  {HEALTH_STYLE[currentLg.lg_health].emoji} {HEALTH_STYLE[currentLg.lg_health].label}
                </span>
              )}
            </div>
            <p className="text-xs text-muted">Status: {currentLg.lg_status_lg ?? "—"}</p>
            <p className="text-xs text-muted">Membros: {currentLg.lg_members_count ?? 0}</p>
            <p className="text-xs text-muted">
              Último relatório: {currentLg.lg_last_report_date ? new Date(currentLg.lg_last_report_date).toLocaleDateString("pt-BR") : "nunca"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <button key={`${c.level}-${c.id}`} onClick={() => drillInto(c)} className="text-left">
              <Card className={`h-full transition hover:shadow-md hover:-translate-y-0.5 ${c.health ? `border-l-4 ${HEALTH_STYLE[c.health].border}` : ""}`}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-navy-600">
                      {LEVEL_ICON[c.level]}
                      <div>
                        <b className="text-sm text-navy">{c.name}</b>
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{LEVEL_LABEL[c.level]}</span>
                      </div>
                    </div>
                    {c.health && <span className="text-sm">{HEALTH_STYLE[c.health].emoji}</span>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
                    {c.level !== "lg" && (
                      <span>{c.childrenCount} {LEVEL_CHILD_LABEL[c.level]}</span>
                    )}
                    <span className="flex items-center gap-0.5"><Users size={11} /> {c.membersCount}</span>
                  </div>
                  {c.extra && <p className="mt-1 text-[10px] text-muted">{c.extra}</p>}
                </CardContent>
              </Card>
            </button>
          ))}
          {cards.length === 0 && (
            <p className="col-span-full py-4 text-center text-xs italic text-muted">Nada cadastrado neste nível ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}

function buildCards(rows: MdaHealthRow[], current: PathStep): NodeCard[] {
  const currentIndex = LEVEL_ORDER.indexOf(current.level);

  // Escopa as linhas ao nó atual (por id do próprio nível atual)
  const scoped = current.level === "nacional" ? rows : rows.filter((r) => {
    const f = fieldForLevel(r, current.level);
    return f?.id === current.id;
  });

  if (current.level === "lg") return []; // folha, não tem mais filhos

  const groups = new Map<string, { level: Level; name: string; health: MdaStatus | null; rows: MdaHealthRow[] }>();

  for (const r of scoped) {
    const next = nextExistingLevel(r, currentIndex + 1);
    if (!next) continue; // essa linha não tem mais nenhum nível abaixo do atual (raro, mas defensivo)
    const key = `${next.level}:${next.data.id}`;
    if (!groups.has(key)) groups.set(key, { level: next.level, name: next.data.name, health: next.data.health, rows: [] });
    groups.get(key)!.rows.push(r);
  }

  const cards: NodeCard[] = [];
  for (const [key, group] of groups) {
    const id = key.split(":").slice(1).join(":");
    const childIndex = LEVEL_ORDER.indexOf(group.level);
    // Conta "netos": quantos filhos diretos (do próximo nível existente) esse grupo tem
    const grandChildKeys = new Set<string>();
    for (const r of group.rows) {
      const grandChild = nextExistingLevel(r, childIndex + 1);
      if (grandChild) grandChildKeys.add(`${grandChild.level}:${grandChild.data.id}`);
    }
    cards.push({
      id, level: group.level, name: group.name, health: group.health,
      childrenCount: group.level === "igreja" ? grandChildKeys.size : grandChildKeys.size,
      membersCount: group.rows.reduce((s, r) => s + (r.lg_members_count ?? 0), 0),
      extra: group.level === "igreja" && grandChildKeys.size === 0 ? "sem Life Groups ainda" : undefined,
    });
  }
  return cards.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
