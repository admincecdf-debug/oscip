"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { stateSchema, nucleoSchema, type StateInput, type NucleoInput } from "@/schemas";
import { useStates, useNucleos, useAllMembers } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import * as Ch from "@/services/churches";
import { logAudit } from "@/services/audit";
import type { State, Nucleo } from "@/types/domain";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function StatesNucleosAdmin() {
  return (
    <Tabs defaultValue="estados" className="space-y-4">
      <TabsList>
        <TabsTrigger value="estados">Estados</TabsTrigger>
        <TabsTrigger value="nucleos">Núcleos</TabsTrigger>
      </TabsList>
      <TabsContent value="estados"><StatesSection /></TabsContent>
      <TabsContent value="nucleos"><NucleosSection /></TabsContent>
    </Tabs>
  );
}

export function StatesSection() {
  const { data: states = [] } = useStates();
  const { data: nucleos = [] } = useNucleos();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<State | null>(null);
  const [err, setErr] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<StateInput>({ resolver: zodResolver(stateSchema) });

  function startEdit(s: State) { setEditing(s); setErr(""); reset({ name: s.name, uf: s.uf }); }
  function cancelEdit() { setEditing(null); setErr(""); reset({ name: "", uf: "" }); }

  async function onSubmit(v: StateInput) {
    setErr("");
    try {
      if (editing) {
        await Ch.updateState(supabase, editing.id, v);
        await logAudit(supabase, "update", "states", editing.id, { name: v.name });
      } else {
        const created = await Ch.createState(supabase, v);
        await logAudit(supabase, "insert", "states", created.id, { name: v.name });
      }
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["states"] });
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro ao salvar"); }
  }
  async function remove(s: State) {
    const hasChildren = nucleos.some((n) => n.state_id === s.id);
    if (hasChildren) { setErr(`"${s.name}" tem núcleos vinculados — remova os núcleos primeiro.`); return; }
    if (!confirm(`Remover o estado "${s.name}"?`)) return;
    try {
      await Ch.deleteState(supabase, s.id);
      await logAudit(supabase, "delete", "states", s.id, { name: s.name });
      qc.invalidateQueries({ queryKey: ["states"] });
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro ao remover"); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{editing ? "Editar estado" : "Cadastrar estado"}</CardTitle>
              <CardDescription>Nível mais alto da estrutura territorial (MEO-001).</CardDescription>
            </div>
            {editing && <Button onClick={cancelEdit} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Cancelar</Button>}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <Field label="Nome do estado" error={errors.name?.message}>
                <Input {...register("name")} placeholder="Ex: Distrito Federal" />
              </Field>
              <Field label="Sigla (UF)" error={errors.uf?.message}>
                <Input {...register("uf")} placeholder="DF" maxLength={2} className="uppercase" />
              </Field>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editing ? "Salvar alterações" : "Cadastrar estado"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {states.length === 0 && <p className="text-sm italic text-muted">Nenhum estado cadastrado ainda.</p>}
        {states.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border bg-card p-3">
            <div>
              <b className="text-navy">{s.name}</b>
              <span className="ml-2 rounded border px-1.5 py-0.5 text-[10px] font-bold text-muted">{s.uf}</span>
              <p className="text-xs text-muted">{nucleos.filter((n) => n.state_id === s.id).length} núcleo(s)</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => startEdit(s)} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button onClick={() => remove(s)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NucleosSection() {
  const { data: nucleos = [] } = useNucleos();
  const { data: states = [] } = useStates();
  const { data: members = [] } = useAllMembers();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Nucleo | null>(null);
  const [err, setErr] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<NucleoInput>({ resolver: zodResolver(nucleoSchema) });

  function startEdit(n: Nucleo) { setEditing(n); setErr(""); reset({ name: n.name, state_id: n.state_id, leader_id: n.leader_id ?? "" }); }
  function cancelEdit() { setEditing(null); setErr(""); reset({ name: "", state_id: "", leader_id: "" }); }

  async function onSubmit(v: NucleoInput) {
    setErr("");
    try {
      const payload = { name: v.name, state_id: v.state_id, leader_id: v.leader_id || null };
      if (editing) {
        await Ch.updateNucleo(supabase, editing.id, payload);
        await logAudit(supabase, "update", "nucleos", editing.id, { name: v.name });
      } else {
        const created = await Ch.createNucleo(supabase, payload);
        await logAudit(supabase, "insert", "nucleos", created.id, { name: v.name });
      }
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["nucleos"] });
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro ao salvar"); }
  }
  async function remove(n: Nucleo) {
    if (!confirm(`Remover o núcleo "${n.name}"?\n\nDistritos vinculados a ele podem ficar órfãos.`)) return;
    try {
      await Ch.deleteNucleo(supabase, n.id);
      await logAudit(supabase, "delete", "nucleos", n.id, { name: n.name });
      qc.invalidateQueries({ queryKey: ["nucleos"] });
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro ao remover"); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{editing ? "Editar núcleo" : "Cadastrar núcleo"}</CardTitle>
              <CardDescription>Agrupa Distritos dentro de um Estado.</CardDescription>
            </div>
            {editing && <Button onClick={cancelEdit} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Cancelar</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {states.length === 0 ? (
            <p className="text-sm italic text-amber-700">Cadastre ao menos um Estado primeiro, na aba anterior.</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <Field label="Nome do núcleo" error={errors.name?.message}>
                <Input {...register("name")} placeholder="Ex: Núcleo Brasília Centro" />
              </Field>
              <Field label="Estado" error={errors.state_id?.message}>
                <select {...register("state_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Selecione —</option>
                  {states.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.uf})</option>)}
                </select>
              </Field>
              <Field label="Supervisor de núcleo (opcional)">
                <select {...register("leader_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Nenhum —</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </Field>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editing ? "Salvar alterações" : "Cadastrar núcleo"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      <div className="space-y-2">
        {nucleos.length === 0 && <p className="text-sm italic text-muted">Nenhum núcleo cadastrado ainda.</p>}
        {nucleos.map((n) => (
          <div key={n.id} className="flex items-center justify-between rounded-md border bg-card p-3">
            <div>
              <b className="text-navy">{n.name}</b>
              <p className="text-xs text-muted">{states.find((s) => s.id === n.state_id)?.name ?? "—"}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => startEdit(n)} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button onClick={() => remove(n)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
