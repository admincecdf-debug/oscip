"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronRight, Globe, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStates, useNucleos, useDistricts } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { logAudit } from "@/services/audit";
import {
  listStates, createState, updateState, deleteState,
  listNucleos, createNucleo, updateNucleo, deleteNucleo,
} from "@/services/churches";
import type { State, Nucleo } from "@/types/domain";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ESTADOS
// ══════════════════════════════════════════════════════════════
function EstadosTab() {
  const qc = useQueryClient();
  const { data: states = [] } = useStates();
  const { data: nucleos = [] } = useNucleos();
  const { data: districts = [] } = useDistricts();
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<State | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", uf: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function openNew() { setF({ name: "", uf: "" }); setEditing(null); setForm(true); }
  function openEdit(s: State) { setF({ name: s.name, uf: s.uf }); setEditing(s); setForm(true); }

  async function save() {
    if (!f.name.trim() || !f.uf.trim()) { setErr("Nome e UF são obrigatórios."); return; }
    setBusy(true); setErr("");
    try {
      if (editing) {
        await updateState(supabase, editing.id, { name: f.name.trim(), uf: f.uf.trim().toUpperCase() });
        await logAudit(supabase, "update", "states", editing.id, { name: f.name });
      } else {
        const created = await createState(supabase, { name: f.name.trim(), uf: f.uf.trim().toUpperCase() });
        await logAudit(supabase, "insert", "states", created.id, { name: f.name });
      }
      qc.invalidateQueries({ queryKey: ["states"] });
      setForm(false); setEditing(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setBusy(false); }
  }

  async function remove(s: State) {
    const n = nucleos.filter(n => n.state_id === s.id).length;
    if (n > 0) { alert(`Este estado tem ${n} núcleo(s). Remova-os primeiro.`); return; }
    if (!confirm(`Desativar o estado "${s.name}"?`)) return;
    await deleteState(supabase, s.id);
    await logAudit(supabase, "update", "states", s.id, { action: "desativar" });
    qc.invalidateQueries({ queryKey: ["states"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{states.length} estado(s) cadastrado(s)</p>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />Novo estado</Button>
      </div>

      {form && (
        <Card className="border-2 border-dashed border-gold/40 bg-gold/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <b className="text-navy">{editing ? "Editar estado" : "Novo estado"}</b>
              <Button onClick={() => { setForm(false); setEditing(null); }} variant="ghost" size="sm"><X className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome *"><Input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Amazonas" /></Field>
              <Field label="UF *"><Input value={f.uf} onChange={e => setF(p => ({ ...p, uf: e.target.value }))} placeholder="AM" maxLength={2} className="uppercase" /></Field>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Criar estado"}</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {states.length === 0 && <p className="text-sm italic text-muted">Nenhum estado cadastrado.</p>}
        {states.map(s => {
          const stateNucleos = nucleos.filter(n => n.state_id === s.id);
          const isOpen = expanded === s.id;
          return (
            <Card key={s.id} className="border-l-4 border-l-gold">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setExpanded(isOpen ? null : s.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted shrink-0" />}
                    <Globe className="h-4 w-4 text-gold shrink-0" />
                    <div>
                      <p className="font-semibold text-navy">{s.name}</p>
                      <p className="text-xs text-muted">UF: {s.uf} · {stateNucleos.length} núcleo(s)</p>
                    </div>
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <Button onClick={() => openEdit(s)} variant="outline" size="sm" className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                    <Button onClick={() => remove(s)} variant="destructive" size="sm" className="h-7 w-7 p-0"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>

                {isOpen && stateNucleos.length > 0 && (
                  <div className="mt-3 ml-10 space-y-1 border-l border-gold/30 pl-3">
                    {stateNucleos.map(n => {
                      const nd = districts.filter(d => d.nucleo_id === n.id);
                      return (
                        <div key={n.id} className="text-sm">
                          <span className="font-medium text-navy">{n.name}</span>
                          <span className="text-xs text-muted ml-2">({nd.length} distrito(s))</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// NÚCLEOS
// ══════════════════════════════════════════════════════════════
function NucleosTab() {
  const qc = useQueryClient();
  const { data: states = [] } = useStates();
  const { data: nucleos = [] } = useNucleos();
  const { data: districts = [] } = useDistricts();
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<Nucleo | null>(null);
  const [filterState, setFilterState] = useState<string>("");
  const [f, setF] = useState({ state_id: "", name: "", leader_id: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const filtered = filterState ? nucleos.filter(n => n.state_id === filterState) : nucleos;

  function openNew() { setF({ state_id: states[0]?.id ?? "", name: "", leader_id: "" }); setEditing(null); setForm(true); }
  function openEdit(n: Nucleo) { setF({ state_id: n.state_id, name: n.name, leader_id: n.leader_id ?? "" }); setEditing(n); setForm(true); }

  async function save() {
    if (!f.name.trim()) { setErr("Nome obrigatório."); return; }
    if (!f.state_id) { setErr("Selecione um estado."); return; }
    setBusy(true); setErr("");
    try {
      if (editing) {
        await updateNucleo(supabase, editing.id, {
          name: f.name.trim(), state_id: f.state_id,
          leader_id: f.leader_id || null,
        });
        await logAudit(supabase, "update", "nucleos", editing.id, { name: f.name });
      } else {
        const created = await createNucleo(supabase, {
          name: f.name.trim(), state_id: f.state_id,
          leader_id: f.leader_id || null,
        });
        await logAudit(supabase, "insert", "nucleos", created.id, { name: f.name });
      }
      qc.invalidateQueries({ queryKey: ["nucleos"] });
      setForm(false); setEditing(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setBusy(false); }
  }

  async function remove(n: Nucleo) {
    const nd = districts.filter(d => d.nucleo_id === n.id).length;
    if (nd > 0) { alert(`Este núcleo tem ${nd} distrito(s). Remova-os primeiro.`); return; }
    if (!confirm(`Desativar o núcleo "${n.name}"?`)) return;
    await deleteNucleo(supabase, n.id);
    await logAudit(supabase, "update", "nucleos", n.id, { action: "desativar" });
    qc.invalidateQueries({ queryKey: ["nucleos"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px]">
          <Label className="mb-1 block text-xs uppercase text-muted">Filtrar por estado</Label>
          <select value={filterState} onChange={e => setFilterState(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Todos os estados</option>
            {states.map(s => <option key={s.id} value={s.id}>{s.name} ({s.uf})</option>)}
          </select>
        </div>
        <Button onClick={openNew} className="gap-2 self-end"><Plus className="h-4 w-4" />Novo núcleo</Button>
      </div>

      {form && (
        <Card className="border-2 border-dashed border-gold/40 bg-gold/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <b className="text-navy">{editing ? "Editar núcleo" : "Novo núcleo"}</b>
              <Button onClick={() => { setForm(false); setEditing(null); }} variant="ghost" size="sm"><X className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome *">
                <Input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Núcleo Leste" />
              </Field>
              <Field label="Estado *">
                <select value={f.state_id} onChange={e => setF(p => ({ ...p, state_id: e.target.value }))}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Selecione —</option>
                  {states.map(s => <option key={s.id} value={s.id}>{s.name} ({s.uf})</option>)}
                </select>
              </Field>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Criar núcleo"}</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm italic text-muted">Nenhum núcleo cadastrado.</p>}
        {filtered.map(n => {
          const state = states.find(s => s.id === n.state_id);
          const nd = districts.filter(d => d.nucleo_id === n.id);
          return (
            <Card key={n.id} className="border-l-4 border-l-blue-400">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-navy">{n.name}</p>
                    <p className="text-xs text-muted">
                      {state ? `${state.name} (${state.uf})` : "—"} · {nd.length} distrito(s)
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button onClick={() => openEdit(n)} variant="outline" size="sm" className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                    <Button onClick={() => remove(n)} variant="destructive" size="sm" className="h-7 w-7 p-0"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MASTER
// ══════════════════════════════════════════════════════════════
export function StatesNucleoAdmin() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-gold" />Estados e Núcleos
          </CardTitle>
          <CardDescription>
            Estrutura territorial MEO-001 — Estados → Núcleos → Distritos → Setores → Igrejas Locais → Life Groups
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="estados">
        <TabsList>
          <TabsTrigger value="estados"><Globe className="mr-1.5 h-3.5 w-3.5" />Estados</TabsTrigger>
          <TabsTrigger value="nucleos"><Building2 className="mr-1.5 h-3.5 w-3.5" />Núcleos</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="estados"><EstadosTab /></TabsContent>
          <TabsContent value="nucleos"><NucleosTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
