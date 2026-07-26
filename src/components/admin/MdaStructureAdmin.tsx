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
import {
  districtSchema, areaSchema, sectorSchema,
  type DistrictInput, type AreaInput, type SectorInput,
} from "@/schemas";
import { useDistricts, useAreas, useSectors, useNucleos, useStates, useAllMembers } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import * as Ch from "@/services/churches";
import { logAudit } from "@/services/audit";
import type { District, Area, Sector } from "@/types/domain";
import { MdaStructure } from "./MdaStructure";
import { StatesSection, NucleosSection } from "./StatesNucleosAdmin";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Cadastro da Estrutura MDA (Igreja → Distrito → Área → Setor → Life Group).
 * Antes desse componente só existia a árvore de resumo (MdaStructure.tsx),
 * sem nenhum formulário de cadastro — Distrito/Área/Setor só podiam ser
 * criados direto no banco. Life Group já tem seu próprio CRUD (CellsAdmin.tsx).
 */
export function MdaStructureAdmin() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="estados" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="estados">Estados</TabsTrigger>
          <TabsTrigger value="nucleos">Núcleos</TabsTrigger>
          <TabsTrigger value="distritos">Distritos</TabsTrigger>
          <TabsTrigger value="areas">Áreas</TabsTrigger>
          <TabsTrigger value="setores">Setores</TabsTrigger>
        </TabsList>
        <TabsContent value="estados"><StatesSection /></TabsContent>
        <TabsContent value="nucleos"><NucleosSection /></TabsContent>
        <TabsContent value="distritos"><DistrictsSection /></TabsContent>
        <TabsContent value="areas"><AreasSection /></TabsContent>
        <TabsContent value="setores"><SectorsSection /></TabsContent>
      </Tabs>
      <MdaStructure />
    </div>
  );
}

// ── Distritos ────────────────────────────────────────────────────
function DistrictsSection() {
  const { data: districts = [] } = useDistricts();
  const { data: nucleos = [] } = useNucleos();
  const { data: statesList = [] } = useStates();
  const { data: members = [] } = useAllMembers();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<District | null>(null);
  const [err, setErr] = useState("");
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } =
    useForm<DistrictInput>({ resolver: zodResolver(districtSchema), defaultValues: { parent_level: "nucleo" } });
  const parentLevel = watch("parent_level");

  function startEdit(d: District) {
    setEditing(d); setErr("");
    reset({ name: d.name, parent_level: d.parent_level, parent_id: d.parent_id, mother_id: d.mother_id ?? "", leader_id: d.leader_id ?? "" });
  }
  function cancelEdit() { setEditing(null); setErr(""); reset({ name: "", parent_level: "nucleo", parent_id: "", mother_id: "", leader_id: "" }); }

  async function onSubmit(v: DistrictInput) {
    setErr("");
    try {
      const payload = { name: v.name, parent_level: v.parent_level, parent_id: v.parent_id, mother_id: v.mother_id || null, leader_id: v.leader_id || null };
      if (editing) {
        await Ch.updateDistrict(supabase, editing.id, payload);
        await logAudit(supabase, "update", "districts", editing.id, { name: v.name });
      } else {
        const created = await Ch.createDistrict(supabase, payload);
        await logAudit(supabase, "insert", "districts", created.id, { name: v.name });
      }
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["districts"] });
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro ao salvar"); }
  }
  async function remove(d: District) {
    if (!confirm(`Remover o distrito "${d.name}"?\n\nSetores vinculados a ele podem ficar órfãos.`)) return;
    try {
      await Ch.deleteDistrict(supabase, d.id);
      await logAudit(supabase, "delete", "districts", d.id, { name: d.name });
      qc.invalidateQueries({ queryKey: ["districts"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro ao remover"); }
  }

  const parentOptions = parentLevel === "estado" ? statesList : nucleos;
  function parentName(d: District): string {
    const list = d.parent_level === "estado" ? statesList : nucleos;
    return list.find(x => x.id === d.parent_id)?.name ?? "—";
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{editing ? "Editar distrito" : "Cadastrar distrito"}</CardTitle>
              <CardDescription>Vincule a um Núcleo (padrão) ou direto a um Estado, pulando o Núcleo.</CardDescription>
            </div>
            {editing && <Button onClick={cancelEdit} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Cancelar</Button>}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="Nome do distrito" error={errors.name?.message}>
              <Input {...register("name")} placeholder="Ex: Distrito Centro" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nível do pai">
                <select {...register("parent_level")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="nucleo">Núcleo (padrão)</option>
                  <option value="estado">Estado (pula o Núcleo)</option>
                </select>
              </Field>
              <Field label={parentLevel === "estado" ? "Estado" : "Núcleo"} error={errors.parent_id?.message}>
                <select {...register("parent_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Selecione —</option>
                  {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Líder responsável (opcional)">
                <select {...register("leader_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Nenhum —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </Field>
              <Field label="Distrito-mãe (se for multiplicação)">
                <select {...register("mother_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Nenhum —</option>
                  {districts.filter(d => !editing || d.id !== editing.id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editing ? "Salvar alterações" : "Cadastrar distrito"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {districts.length === 0 && <p className="text-sm italic text-muted">Nenhum distrito cadastrado ainda.</p>}
        {districts.map(d => (
          <div key={d.id} className="flex items-center justify-between rounded-md border bg-card p-3">
            <div>
              <b className="text-navy">{d.name}</b>
              <p className="text-xs text-muted">
                {parentName(d)}
                {d.parent_level === "estado" && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">pulou Núcleo</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => startEdit(d)} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button onClick={() => remove(d)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Áreas ────────────────────────────────────────────────────────
function AreasSection() {
  const { data: areas = [] } = useAreas();
  const { data: districts = [] } = useDistricts();
  const { data: members = [] } = useAllMembers();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Area | null>(null);
  const [err, setErr] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<AreaInput>({ resolver: zodResolver(areaSchema) });

  function startEdit(a: Area) {
    setEditing(a); setErr("");
    reset({ name: a.name, district_id: a.district_id, mother_id: a.mother_id ?? "", leader_id: a.leader_id ?? "" });
  }
  function cancelEdit() { setEditing(null); setErr(""); reset({ name: "", district_id: "", mother_id: "", leader_id: "" }); }

  async function onSubmit(v: AreaInput) {
    setErr("");
    try {
      const payload = { name: v.name, district_id: v.district_id, mother_id: v.mother_id || null, leader_id: v.leader_id || null };
      if (editing) {
        await Ch.updateArea(supabase, editing.id, payload);
        await logAudit(supabase, "update", "areas", editing.id, { name: v.name });
      } else {
        const created = await Ch.createArea(supabase, payload);
        await logAudit(supabase, "insert", "areas", created.id, { name: v.name });
      }
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["areas"] });
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro ao salvar"); }
  }
  async function remove(a: Area) {
    if (!confirm(`Remover a área "${a.name}"?\n\nSetores vinculados a ela podem ficar órfãos.`)) return;
    try {
      await Ch.deleteArea(supabase, a.id);
      await logAudit(supabase, "delete", "areas", a.id, { name: a.name });
      qc.invalidateQueries({ queryKey: ["areas"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro ao remover"); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{editing ? "Editar área" : "Cadastrar área"}</CardTitle>
              <CardDescription>Vincule a um Distrito existente.</CardDescription>
            </div>
            {editing && <Button onClick={cancelEdit} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Cancelar</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {districts.length === 0 ? (
            <p className="text-sm italic text-amber-700">Cadastre ao menos um Distrito primeiro, na aba anterior.</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <Field label="Nome da área" error={errors.name?.message}>
                <Input {...register("name")} placeholder="Ex: Área Norte" />
              </Field>
              <Field label="Distrito" error={errors.district_id?.message}>
                <select {...register("district_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Selecione —</option>
                  {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Líder responsável (opcional)">
                  <select {...register("leader_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">— Nenhum —</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </Field>
                <Field label="Área-mãe (se for multiplicação)">
                  <select {...register("mother_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">— Nenhuma —</option>
                    {areas.filter(a => !editing || a.id !== editing.id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
              </div>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editing ? "Salvar alterações" : "Cadastrar área"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      <div className="space-y-2">
        {areas.length === 0 && <p className="text-sm italic text-muted">Nenhuma área cadastrada ainda.</p>}
        {areas.map(a => (
          <div key={a.id} className="flex items-center justify-between rounded-md border bg-card p-3">
            <div>
              <b className="text-navy">{a.name}</b>
              <p className="text-xs text-muted">{districts.find(d => d.id === a.district_id)?.name ?? "—"}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => startEdit(a)} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button onClick={() => remove(a)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Setores ──────────────────────────────────────────────────────
function SectorsSection() {
  const { data: sectors = [] } = useSectors();
  const { data: districts = [] } = useDistricts();
  const { data: nucleos = [] } = useNucleos();
  const { data: areas = [] } = useAreas();
  const { data: members = [] } = useAllMembers();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Sector | null>(null);
  const [err, setErr] = useState("");
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } =
    useForm<SectorInput>({ resolver: zodResolver(sectorSchema), defaultValues: { parent_level: "distrito" } });
  const parentLevel = watch("parent_level");

  function startEdit(s: Sector) {
    setEditing(s); setErr("");
    reset({ name: s.name, parent_level: s.parent_level, parent_id: s.parent_id, area_id: s.area_id ?? "", mother_id: s.mother_id ?? "", leader_id: s.leader_id ?? "" });
  }
  function cancelEdit() { setEditing(null); setErr(""); reset({ name: "", parent_level: "distrito", parent_id: "", area_id: "", mother_id: "", leader_id: "" }); }

  async function onSubmit(v: SectorInput) {
    setErr("");
    try {
      const payload = { name: v.name, parent_level: v.parent_level, parent_id: v.parent_id, area_id: v.area_id || null, mother_id: v.mother_id || null, leader_id: v.leader_id || null };
      if (editing) {
        await Ch.updateSector(supabase, editing.id, payload);
        await logAudit(supabase, "update", "sectors", editing.id, { name: v.name });
      } else {
        const created = await Ch.createSector(supabase, payload);
        await logAudit(supabase, "insert", "sectors", created.id, { name: v.name });
      }
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["sectors"] });
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro ao salvar"); }
  }
  async function remove(s: Sector) {
    if (!confirm(`Remover o setor "${s.name}"?\n\nIgrejas Locais vinculadas a ele podem ficar órfãs.`)) return;
    try {
      await Ch.deleteSector(supabase, s.id);
      await logAudit(supabase, "delete", "sectors", s.id, { name: s.name });
      qc.invalidateQueries({ queryKey: ["sectors"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro ao remover"); }
  }

  const parentOptions = parentLevel === "nucleo" ? nucleos : districts;
  function parentName(s: Sector): string {
    const list = s.parent_level === "nucleo" ? nucleos : districts;
    return list.find(x => x.id === s.parent_id)?.name ?? "—";
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{editing ? "Editar setor" : "Cadastrar setor"}</CardTitle>
              <CardDescription>Vincule a um Distrito (padrão) ou direto a um Núcleo, pulando o Distrito. Área é só genealogia (opcional).</CardDescription>
            </div>
            {editing && <Button onClick={cancelEdit} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Cancelar</Button>}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="Nome do setor" error={errors.name?.message}>
              <Input {...register("name")} placeholder="Ex: Setor 1" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nível do pai">
                <select {...register("parent_level")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="distrito">Distrito (padrão)</option>
                  <option value="nucleo">Núcleo (pula o Distrito)</option>
                </select>
              </Field>
              <Field label={parentLevel === "nucleo" ? "Núcleo" : "Distrito"} error={errors.parent_id?.message}>
                <select {...register("parent_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Selecione —</option>
                  {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Área (genealogia — opcional)">
              <select {...register("area_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Nenhuma —</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Líder responsável (opcional)">
                <select {...register("leader_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Nenhum —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </Field>
              <Field label="Setor-mãe (se for multiplicação)">
                <select {...register("mother_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Nenhum —</option>
                  {sectors.filter(s => !editing || s.id !== editing.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editing ? "Salvar alterações" : "Cadastrar setor"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {sectors.length === 0 && <p className="text-sm italic text-muted">Nenhum setor cadastrado ainda.</p>}
        {sectors.map(s => (
          <div key={s.id} className="flex items-center justify-between rounded-md border bg-card p-3">
            <div>
              <b className="text-navy">{s.name}</b>
              <p className="text-xs text-muted">
                {parentName(s)}
                {s.parent_level === "nucleo" && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">pulou Distrito</span>}
              </p>
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
