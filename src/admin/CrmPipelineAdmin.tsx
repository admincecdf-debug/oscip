"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Workflow, Mail, Phone, MapPin, ArrowRight, Trash2,
  Building2, Clock, ChevronDown, ChevronUp, User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePipeline, useChurches, useCells, useLgSuggestions } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { updatePipelineStage, deletePipeline, acceptLgSuggestion } from "@/services/pipeline";
import { logAudit } from "@/services/audit";
import type { PipelineStage, PipelineIntent, VisitorPipeline, Church } from "@/types/domain";

export const STAGE_LABELS: Record<PipelineStage, string> = {
  novo: "Novo",
  aguardando_contato: "Aguardando contato",
  contato_realizado: "Contato realizado",
  convidado_culto: "Convidado p/ culto",
  convidado_life_group: "Convidado p/ Life Group",
  participou: "Participou",
  discipulado: "Discipulado",
  consolidacao: "Consolidação",
  batizado: "Batizado",
  membro: "Membro",
  servo: "Servo",
  lider: "Líder",
};

export const STAGE_COLORS: Record<PipelineStage, string> = {
  novo: "bg-gold/15 text-gold border-gold/30",
  aguardando_contato: "bg-yellow-50 text-yellow-700 border-yellow-200",
  contato_realizado: "bg-blue-50 text-blue-700 border-blue-200",
  convidado_culto: "bg-blue-100 text-blue-800 border-blue-300",
  convidado_life_group: "bg-indigo-50 text-indigo-700 border-indigo-200",
  participou: "bg-purple-50 text-purple-700 border-purple-200",
  discipulado: "bg-pink-50 text-pink-700 border-pink-200",
  consolidacao: "bg-orange-50 text-orange-700 border-orange-200",
  batizado: "bg-cyan-50 text-cyan-700 border-cyan-200",
  membro: "bg-green-50 text-green-700 border-green-200",
  servo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lider: "bg-navy text-white border-navy",
};

export const INTENT_LABELS: Record<PipelineIntent, string> = {
  lifegroup: "Life Group",
  discipulado: "Discipulado",
  acompanhamento_pastoral: "Acompanhamento pastoral",
  visita: "Visita",
  conhecer: "Conhecer",
  batismo: "Batismo",
  servir: "Servir",
  outro: "Outro",
};

const STAGES: PipelineStage[] = [
  "novo","aguardando_contato","contato_realizado","convidado_culto",
  "convidado_life_group","participou","discipulado","consolidacao",
  "batizado","membro","servo","lider",
];

export function CrmPipelineAdmin() {
  const [stageFilter, setStageFilter] = useState<PipelineStage | "">("");
  const [churchFilter, setChurchFilter] = useState<string>("");
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const { data: items = [] } = usePipeline({ stage: stageFilter || undefined, communityId: churchFilter || null });
  const { data: churches = [] } = useChurches();
  const churchMap = new Map(churches.map((c) => [c.id, c]));

  // Contagem por estágio (pra mostrar nos chips)
  const allByStage = usePipeline({ communityId: churchFilter || null }).data ?? [];
  const counts = STAGES.reduce<Record<PipelineStage, number>>((acc, st) => {
    acc[st] = allByStage.filter((i) => i.stage === st).length;
    return acc;
  }, {} as Record<PipelineStage, number>);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5 text-gold" />CRM Pastoral</CardTitle>
          <CardDescription>Pipeline de relacionamento com novos visitantes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {churches.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted">Comunidade</Label>
              <select value={churchFilter} onChange={(e) => setChurchFilter(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:w-72">
                <option value="">Todas as comunidades</option>
                {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted">Estágio</Label>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setStageFilter("")}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition ${stageFilter === "" ? "bg-navy text-white border-navy" : "bg-card text-muted border-border hover:border-navy/30"}`}>
                Todos ({allByStage.length})
              </button>
              {STAGES.map((st) => (
                <button key={st} onClick={() => setStageFilter(st)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition ${stageFilter === st ? "bg-navy text-white border-navy" : "bg-card text-muted border-border hover:border-navy/30"}`}>
                  {STAGE_LABELS[st]} ({counts[st]})
                </button>
              ))}
            </div>
          </div>

          {/* Toggle de visualização */}
          <div className="flex items-center justify-end gap-1 border-t pt-3">
            <span className="mr-2 text-[11px] font-bold uppercase tracking-wider text-muted">Visualizar:</span>
            <button onClick={() => setView("lista")}
              className={`rounded-md px-3 py-1 text-xs font-bold transition ${view === "lista" ? "bg-navy text-white" : "bg-card text-muted hover:bg-navy-50"}`}>
              Lista
            </button>
            <button onClick={() => setView("kanban")}
              className={`rounded-md px-3 py-1 text-xs font-bold transition ${view === "kanban" ? "bg-navy text-white" : "bg-card text-muted hover:bg-navy-50"}`}>
              Kanban
            </button>
          </div>
        </CardContent>
      </Card>

      {view === "lista" ? (
        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm italic text-muted">Nenhum visitante neste estágio.</p>}
          {items.map((it) => <PipelineCard key={it.id} item={it} church={it.community_id ? churchMap.get(it.community_id) : undefined} />)}
        </div>
      ) : (
        <PipelineKanban items={stageFilter ? items : allByStage} stages={STAGES} stageLabels={STAGE_LABELS} stageColors={STAGE_COLORS} churchMap={churchMap} />
      )}
    </div>
  );
}

export function PipelineCard({ item: it, church }: { item: VisitorPipeline; church?: Church }) {
  const qc = useQueryClient();
  const { data: cells = [] } = useCells();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(it.internal_notes ?? "");
  const lg = it.life_group_id ? cells.find((c) => c.id === it.life_group_id) : null;

  async function moveTo(stage: PipelineStage) {
    setBusy(true);
    try {
      await updatePipelineStage(supabase, it.id, stage, notes !== (it.internal_notes ?? "") ? notes : undefined);
      await logAudit(supabase, "update", "visitor_pipeline", it.id, { stage });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["acolhimento"] });
      qc.invalidateQueries({ queryKey: ["pending-counts"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm("Apagar esta entrada do pipeline? O usuário continua existindo, mas perde o rastro de relacionamento.")) return;
    try {
      await deletePipeline(supabase, it.id);
      await logAudit(supabase, "delete", "visitor_pipeline", it.id);
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["acolhimento"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  // Próximo estágio "lógico" (para botão de avanço rápido)
  const idx = STAGES.indexOf(it.stage);
  const next = idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-navy">{it.full_name}</b>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STAGE_COLORS[it.stage]}`}>{STAGE_LABELS[it.stage]}</span>
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">{INTENT_LABELS[it.intent]}</span>
              {lg && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700 border border-purple-200">
                  LG: {lg.name}
                </span>
              )}
              {church && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-bold uppercase text-navy">
                  <Building2 className="h-2.5 w-2.5" />{church.name}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
              {it.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{it.phone}</span>}
              {it.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{it.email}</span>}
              {(it.city || it.state) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[it.city, it.state].filter(Boolean).join(", ")}</span>}
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(it.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
          <Button onClick={() => setExpanded((e) => !e)} variant="ghost" size="sm" className="gap-1">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <Timeline item={it} />

            {/* M6 — Sugestão automática de LG, só se ainda não tem LG */}
            {!it.life_group_id && <LgSuggestionBlock pipelineId={it.id} />}

            <div>
              <Label className="mb-1 block text-xs uppercase tracking-wider text-muted">Notas internas</Label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                className="w-full rounded-md border bg-background p-3 text-sm"
                placeholder="Observações pastorais sobre esta pessoa…" />
            </div>

            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wider text-muted">Mover para estágio</Label>
              <div className="flex flex-wrap gap-1.5">
                {next && (
                  <Button onClick={() => moveTo(next)} disabled={busy} size="sm" className="gap-1">
                    Avançar → {STAGE_LABELS[next]} <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
                {STAGES.filter((s) => s !== it.stage && s !== next).map((s) => (
                  <Button key={s} onClick={() => moveTo(s)} disabled={busy} variant="outline" size="sm">
                    {STAGE_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={remove} variant="destructive" size="sm" className="gap-1"><Trash2 className="h-3.5 w-3.5" />Apagar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Timeline({ item: it }: { item: VisitorPipeline }) {
  const milestones = [
    { label: "Cadastrado",          date: it.created_at },
    { label: "Primeiro contato",    date: it.first_contact_at },
    { label: "Convite Life Group",  date: it.life_group_invite_at },
    { label: "Discipulado iniciado", date: it.discipleship_started_at },
    { label: "Batismo",             date: it.baptism_date },
    { label: "Tornou-se membro",    date: it.member_date },
  ];
  const reached = milestones.filter((m) => m.date);

  if (reached.length === 1) return null;

  return (
    <div>
      <Label className="mb-2 block text-xs uppercase tracking-wider text-muted">Linha do tempo</Label>
      <ol className="space-y-1.5 text-xs">
        {reached.map((m, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-gold" />
            <b className="text-navy">{m.label}</b>
            <span className="text-muted">— {new Date(m.date!).toLocaleDateString("pt-BR")}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ============================================================
// PIPELINE KANBAN — visualização alternativa em colunas
// ============================================================
function PipelineKanban({ items, stages, stageLabels, stageColors, churchMap }: {
  items: VisitorPipeline[];
  stages: PipelineStage[];
  stageLabels: Record<PipelineStage, string>;
  stageColors: Record<PipelineStage, string>;
  churchMap: Map<string, Church>;
}) {
  const qc = useQueryClient();

  async function moveTo(id: string, stage: PipelineStage) {
    try {
      await updatePipelineStage(supabase, id, stage);
      await logAudit(supabase, "update", "visitor_pipeline", id, { stage });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["acolhimento"] });
      qc.invalidateQueries({ queryKey: ["pending-counts"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  const byStage = stages.reduce<Record<PipelineStage, VisitorPipeline[]>>((acc, st) => {
    acc[st] = items.filter((i) => i.stage === st);
    return acc;
  }, {} as Record<PipelineStage, VisitorPipeline[]>);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {stages.map((st) => {
          const stItems = byStage[st];
          return (
            <div key={st} className="w-64 shrink-0">
              <div className={`rounded-t-lg border-2 border-b-0 px-3 py-2 ${stageColors[st]}`}>
                <div className="flex items-center justify-between">
                  <b className="text-[10px] font-bold uppercase tracking-wider">{stageLabels[st]}</b>
                  <span className="rounded-full bg-white/40 px-2 py-0.5 text-[10px] font-bold">{stItems.length}</span>
                </div>
              </div>
              <div className="min-h-[200px] rounded-b-lg border-2 border-t-0 border-border bg-navy-50/30 p-2 space-y-1.5">
                {stItems.length === 0 ? (
                  <p className="py-4 text-center text-[11px] italic text-muted">vazio</p>
                ) : (
                  stItems.map((it) => <KanbanCard key={it.id} item={it} stages={stages} stageLabels={stageLabels} church={it.community_id ? churchMap.get(it.community_id) : undefined} onMove={moveTo} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ item: it, stages, stageLabels, church, onMove }: {
  item: VisitorPipeline;
  stages: PipelineStage[];
  stageLabels: Record<PipelineStage, string>;
  church?: Church;
  onMove: (id: string, stage: PipelineStage) => void;
}) {
  const [open, setOpen] = useState(false);
  const idx = stages.indexOf(it.stage);
  const next = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null;

  return (
    <div className="rounded-md border bg-card p-2 text-xs hover:shadow-md transition">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left">
        <b className="block truncate text-navy">{it.full_name}</b>
        <p className="truncate text-[10px] text-muted">{INTENT_LABELS[it.intent]}</p>
        {church && <p className="truncate text-[10px] text-muted">🏢 {church.name}</p>}
        {(it.city || it.state) && <p className="truncate text-[10px] text-muted">📍 {[it.city, it.state].filter(Boolean).join(", ")}</p>}
      </button>
      {open && (
        <div className="mt-2 border-t pt-2 space-y-1">
          {it.phone && (
            <a href={`https://wa.me/${it.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
              className="block rounded bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700 hover:bg-green-100 text-center">
              WhatsApp · {it.phone}
            </a>
          )}
          {next && (
            <button onClick={() => onMove(it.id, next)}
              className="block w-full rounded bg-navy px-2 py-1 text-[10px] font-bold text-white hover:bg-navy-600">
              Avançar → {stageLabels[next]}
            </button>
          )}
          <details className="text-[10px]">
            <summary className="cursor-pointer text-muted hover:text-navy">Mover para…</summary>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {stages.filter((s) => s !== it.stage && s !== next).map((s) => (
                <button key={s} onClick={() => onMove(it.id, s)}
                  className="rounded bg-card px-1.5 py-1 text-[9px] font-semibold text-navy border hover:bg-navy-50">
                  {stageLabels[s]}
                </button>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// ============================================================
// M6 — Bloco de sugestões automáticas de LG
// ============================================================
function LgSuggestionBlock({ pipelineId }: { pipelineId: string }) {
  const qc = useQueryClient();
  const { data: suggestions = [], isLoading } = useLgSuggestions(pipelineId);
  const [busy, setBusy] = useState<string | null>(null);

  async function accept(lgId: string) {
    setBusy(lgId);
    try {
      await acceptLgSuggestion(supabase, pipelineId, lgId);
      await logAudit(supabase, "update", "visitor_pipeline", pipelineId, { suggested_lg_accepted: lgId });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["acolhimento"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(null); }
  }

  return (
    <div className="rounded-md border-2 border-dashed border-gold/40 bg-gold/5 p-3">
      <Label className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-gold">
        🤖 Sugestão automática de Life Group
      </Label>
      {isLoading ? (
        <p className="text-xs italic text-muted">Calculando…</p>
      ) : suggestions.length === 0 ? (
        <p className="text-xs italic text-muted">Nenhum LG disponível para sugerir nesta comunidade.</p>
      ) : (
        <div className="space-y-1.5">
          {suggestions.map((s, idx) => (
            <div key={s.lg_id} className="flex items-start gap-2 rounded-md border bg-card p-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">
                #{idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <b className="text-sm text-navy">{s.lg_name}</b>
                  <span className="rounded-full bg-navy-50 px-1.5 py-0.5 text-[10px] font-bold text-navy">
                    Match {Math.round(s.adjusted_score)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted">{s.reason}</p>
              </div>
              <button onClick={() => accept(s.lg_id)} disabled={busy !== null}
                className="shrink-0 rounded-md bg-gold px-2.5 py-1 text-[11px] font-bold text-navy hover:bg-gold/80 disabled:opacity-50">
                {busy === s.lg_id ? "..." : "Aceitar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
