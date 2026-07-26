"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, UserCog, Plus, X, ArrowLeftRight, Ban, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useLeadershipAssignments, useAllMembers, useChurches, useMinistries, useCells,
  useStates, useNucleos, useDistricts, useSectors,
} from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { assignLeadership, remanejarLideranca, encerrarLideranca } from "@/services/leadership";
import type { LeadershipFunction, LeadershipAssignment, ScopeLevel } from "@/types/domain";

const FUNCTION_LABELS: Record<LeadershipFunction, string> = {
  apostolo: "Apóstolo", pastor_principal: "Pastor Principal", pastor_auxiliar: "Pastor Auxiliar",
  pastor_distrito: "Pastor de Distrito", supervisor_distrito: "Supervisor de Distrito",
  supervisor_area: "Supervisor de Área", supervisor_setor: "Supervisor de Setor",
  lider_lg: "Líder de Life Group", lider_auxiliar: "Líder Auxiliar", diacono: "Diácono",
  lider_ministerio: "Líder de Ministério", lider_louvor: "Líder de Louvor", lider_jovens: "Líder de Jovens",
  lider_casais: "Líder de Casais", lider_infantil: "Líder Infantil", lider_evangelismo: "Líder de Evangelismo",
  lider_missoes: "Líder de Missões", outro: "Outro",
};
const NEEDS_CHURCH: LeadershipFunction[] = ["pastor_principal","pastor_auxiliar","diacono"];
const NEEDS_SCOPE: LeadershipFunction[] = ["pastor_distrito","supervisor_distrito","supervisor_area","supervisor_setor"];
const NEEDS_LG: LeadershipFunction[] = ["lider_lg","lider_auxiliar"];
const NEEDS_MINISTRY: LeadershipFunction[] = ["lider_ministerio","lider_louvor","lider_jovens","lider_casais","lider_infantil","lider_evangelismo","lider_missoes"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

export function LeadershipAdmin() {
  const qc = useQueryClient();
  const { data: assignments = [], isLoading } = useLeadershipAssignments();
  const { data: members = [] } = useAllMembers();
  const { data: churches = [] } = useChurches();
  const { data: ministries = [] } = useMinistries();
  const { data: cells = [] } = useCells();
  const { data: states = [] } = useStates();
  const { data: nucleos = [] } = useNucleos();
  const { data: districts = [] } = useDistricts();
  const { data: sectors = [] } = useSectors();

  const SCOPE_OPTIONS: Record<string, { id: string; name: string }[]> = {
    estado: states.map(s => ({ id: s.id, name: `${s.name} (${s.uf})` })),
    nucleo: nucleos.map(n => ({ id: n.id, name: n.name })),
    distrito: districts.map(d => ({ id: d.id, name: d.name })),
    setor: sectors.map(s => ({ id: s.id, name: s.name })),
  };

  const [filterFunction, setFilterFunction] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ativo" | "encerrado" | "">("ativo");
  const [filterChurch, setFilterChurch] = useState("");

  const filtered = assignments.filter(a =>
    (!filterFunction || a.function_type === filterFunction) &&
    (!filterStatus || a.status === filterStatus) &&
    (!filterChurch || a.church_id === filterChurch)
  );

  const [openNew, setOpenNew] = useState(false);
  const [remanejando, setRemanejando] = useState<LeadershipAssignment | null>(null);

  async function handleEncerrar(a: LeadershipAssignment) {
    if (!confirm(`Encerrar a designação de ${a.profile_name} como ${FUNCTION_LABELS[a.function_type]}?`)) return;
    try {
      await encerrarLideranca(supabase, a.id);
      qc.invalidateQueries({ queryKey: ["leadership-assignments"] });
    } catch (e) {
      alert((e as { message?: string })?.message ?? "Erro ao encerrar");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><UserCog size={18} /> Liderança</CardTitle>
            <CardDescription>Pastores, supervisores, líderes e diáconos — com histórico de designações preservado.</CardDescription>
          </div>
          <Button onClick={() => setOpenNew(true)} className="gap-1.5"><Plus size={16} /> Designar</Button>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <select value={filterFunction} onChange={e => setFilterFunction(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
              <option value="">Todas as funções</option>
              {Object.entries(FUNCTION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select value={filterChurch} onChange={e => setFilterChurch(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
              <option value="">Todas as igrejas</option>
              {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as "ativo" | "encerrado" | "")} className="h-8 rounded-md border bg-background px-2 text-xs">
              <option value="ativo">Ativos</option>
              <option value="encerrado">Encerrados</option>
              <option value="">Todos</option>
            </select>
          </div>

          {isLoading ? (
            <p className="py-6 text-center text-sm italic text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm italic text-muted-foreground">Nenhuma designação encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Pessoa</th>
                    <th className="py-2 pr-3 font-medium">Função</th>
                    <th className="py-2 pr-3 font-medium">Unidade</th>
                    <th className="py-2 pr-3 font-medium">Início</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{a.profile_name}</td>
                      <td className="py-2 pr-3">{FUNCTION_LABELS[a.function_type]}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {a.church_name ?? a.life_group_name ?? a.ministry_name ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{new Date(a.started_at).toLocaleDateString("pt-BR")}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          a.status === "ativo" ? "border-green-300 bg-green-50 text-green-700" : "border-slate-300 bg-slate-50 text-slate-600"
                        }`}>
                          {a.status === "ativo" ? "Ativo" : `Encerrado${a.ended_at ? " em " + new Date(a.ended_at).toLocaleDateString("pt-BR") : ""}`}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right space-x-1">
                        {a.status === "ativo" && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => setRemanejando(a)} title="Remanejar">
                              <ArrowLeftRight size={14} />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleEncerrar(a)} title="Encerrar">
                              <Ban size={14} className="text-destructive" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {openNew && (
        <AssignDialog
          members={members} churches={churches} ministries={ministries} cells={cells}
          scopeOptions={SCOPE_OPTIONS}
          onClose={() => setOpenNew(false)}
          onSaved={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["leadership-assignments"] }); }}
        />
      )}
      {remanejando && (
        <RemanejarDialog
          assignment={remanejando} churches={churches} ministries={ministries} cells={cells}
          scopeOptions={SCOPE_OPTIONS}
          onClose={() => setRemanejando(null)}
          onSaved={() => { setRemanejando(null); qc.invalidateQueries({ queryKey: ["leadership-assignments"] }); }}
        />
      )}
    </div>
  );
}

// ── Dialog: nova designação ───────────────────────────────────────
function AssignDialog({ members, churches, ministries, cells, scopeOptions, onClose, onSaved }: {
  members: { id: string; full_name: string }[]; churches: { id: string; name: string }[];
  ministries: { id: string; name: string }[]; cells: { id: string; name: string }[];
  scopeOptions: Record<string, { id: string; name: string }[]>;
  onClose: () => void; onSaved: () => void;
}) {
  const [query, setQuery] = useState("");
  const [profileId, setProfileId] = useState("");
  const [profileName, setProfileName] = useState("");
  const [fn, setFn] = useState<LeadershipFunction>("lider_lg");
  const [churchId, setChurchId] = useState("");
  const [ministryId, setMinistryId] = useState("");
  const [lgId, setLgId] = useState("");
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel | "">("");
  const [scopeId, setScopeId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const filteredMembers = query.trim().length >= 2
    ? members.filter(m => m.full_name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];

  async function save() {
    if (!profileId) { setErr("Busque e selecione a pessoa."); return; }
    setBusy(true); setErr("");
    try {
      await assignLeadership(supabase, {
        profile_id: profileId, function_type: fn,
        church_id: NEEDS_CHURCH.includes(fn) ? (churchId || null) : null,
        scope_level: NEEDS_SCOPE.includes(fn) && scopeLevel ? (scopeLevel as ScopeLevel) : null,
        scope_id: NEEDS_SCOPE.includes(fn) && scopeLevel ? (scopeId || null) : null,
        ministry_id: NEEDS_MINISTRY.includes(fn) ? (ministryId || null) : null,
        life_group_id: NEEDS_LG.includes(fn) ? (lgId || null) : null,
        notes: notes || null,
      });
      onSaved();
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Erro ao designar. Confira se já não existe um Pastor Principal ativo nessa igreja.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Designar liderança</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Pessoa">
            {profileId ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                {profileName}
                <button onClick={() => { setProfileId(""); setProfileName(""); }}><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar pessoa pelo nome…" />
                {filteredMembers.length > 0 && (
                  <div className="mt-1 rounded-md border max-h-40 overflow-y-auto absolute z-10 w-full bg-background">
                    {filteredMembers.map(m => (
                      <button key={m.id} type="button" onClick={() => { setProfileId(m.id); setProfileName(m.full_name); setQuery(""); }}
                        className="flex w-full px-3 py-2 text-left text-sm hover:bg-accent">
                        {m.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>

          <Field label="Função">
            <select value={fn} onChange={e => setFn(e.target.value as LeadershipFunction)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {Object.entries(FUNCTION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>

          {NEEDS_CHURCH.includes(fn) && (
            <Field label="Igreja">
              <select value={churchId} onChange={e => setChurchId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Selecione —</option>
                {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          {NEEDS_SCOPE.includes(fn) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nível">
                <select value={scopeLevel} onChange={e => { setScopeLevel(e.target.value as ScopeLevel); setScopeId(""); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Selecione —</option>
                  <option value="distrito">Distrito</option>
                  <option value="nucleo">Núcleo</option>
                  <option value="setor">Setor</option>
                </select>
              </Field>
              {scopeLevel && (
                <Field label="Destino">
                  <select value={scopeId} onChange={e => setScopeId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">— Selecione —</option>
                    {(scopeOptions[scopeLevel] ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
          )}
          {NEEDS_LG.includes(fn) && (
            <Field label="Life Group">
              <select value={lgId} onChange={e => setLgId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Selecione —</option>
                {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          {NEEDS_MINISTRY.includes(fn) && (
            <Field label="Ministério">
              <select value={ministryId} onChange={e => setMinistryId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Selecione —</option>
                {ministries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          )}

          <Field label="Observações (opcional)">
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: designado pelo Conselho Pastoral" />
          </Field>

          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button onClick={save} disabled={busy} className="w-full">{busy ? "Salvando…" : "Confirmar designação"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: remanejamento ──────────────────────────────────────────
function RemanejarDialog({ assignment, churches, ministries, cells, scopeOptions, onClose, onSaved }: {
  assignment: LeadershipAssignment; churches: { id: string; name: string }[];
  ministries: { id: string; name: string }[]; cells: { id: string; name: string }[];
  scopeOptions: Record<string, { id: string; name: string }[]>;
  onClose: () => void; onSaved: () => void;
}) {
  const [fn, setFn] = useState<LeadershipFunction>(assignment.function_type);
  const [churchId, setChurchId] = useState(assignment.church_id ?? "");
  const [ministryId, setMinistryId] = useState(assignment.ministry_id ?? "");
  const [lgId, setLgId] = useState(assignment.life_group_id ?? "");
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel | "">(assignment.scope_level ?? "");
  const [scopeId, setScopeId] = useState(assignment.scope_id ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true); setErr("");
    try {
      await remanejarLideranca(supabase, assignment.id, fn, {
        churchId: NEEDS_CHURCH.includes(fn) ? (churchId || null) : null,
        scopeLevel: NEEDS_SCOPE.includes(fn) && scopeLevel ? (scopeLevel as ScopeLevel) : null,
        scopeId: NEEDS_SCOPE.includes(fn) && scopeLevel ? (scopeId || null) : null,
        ministryId: NEEDS_MINISTRY.includes(fn) ? (ministryId || null) : null,
        lifeGroupId: NEEDS_LG.includes(fn) ? (lgId || null) : null,
        notes: notes || null,
      });
      onSaved();
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Erro ao remanejar");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Remanejar {assignment.profile_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Encerra a designação atual ({FUNCTION_LABELS[assignment.function_type]}
            {assignment.church_name ? ` — ${assignment.church_name}` : ""}) e cria uma nova, preservando o histórico.
          </p>
          <Field label="Nova função">
            <select value={fn} onChange={e => setFn(e.target.value as LeadershipFunction)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {Object.entries(FUNCTION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          {NEEDS_CHURCH.includes(fn) && (
            <Field label="Nova igreja">
              <select value={churchId} onChange={e => setChurchId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Selecione —</option>
                {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          {NEEDS_SCOPE.includes(fn) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nível">
                <select value={scopeLevel} onChange={e => { setScopeLevel(e.target.value as ScopeLevel); setScopeId(""); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Selecione —</option>
                  <option value="distrito">Distrito</option>
                  <option value="nucleo">Núcleo</option>
                  <option value="setor">Setor</option>
                </select>
              </Field>
              {scopeLevel && (
                <Field label="Destino">
                  <select value={scopeId} onChange={e => setScopeId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">— Selecione —</option>
                    {(scopeOptions[scopeLevel] ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
          )}
          {NEEDS_LG.includes(fn) && (
            <Field label="Novo Life Group">
              <select value={lgId} onChange={e => setLgId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Selecione —</option>
                {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          {NEEDS_MINISTRY.includes(fn) && (
            <Field label="Novo ministério">
              <select value={ministryId} onChange={e => setMinistryId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Selecione —</option>
                {ministries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Motivo/observações">
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: transferência ministerial" />
          </Field>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button onClick={save} disabled={busy} className="w-full gap-1.5">
            <ArrowLeftRight size={16} /> {busy ? "Remanejando…" : "Confirmar remanejamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
