"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Heart, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { discipleshipAdminSchema, type DiscipleshipAdminInput } from "@/schemas";
import { useAllMembers, useAllDiscipleships } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { createDiscipleship, endDiscipleship, deleteDiscipleship } from "@/services/discipleship";
import { logAudit } from "@/services/audit";

const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-green-50 text-green-700 border-green-200",
  pausado: "bg-yellow-50 text-yellow-700 border-yellow-200",
  concluido: "bg-navy-50 text-navy border-border",
  desistente: "bg-red-50 text-red-700 border-red-200",
};

export function DiscipleshipAdmin() {
  const { data: members = [] } = useAllMembers();
  const { data: discs = [] } = useAllDiscipleships();
  const qc = useQueryClient();
  const [err, setErr] = useState("");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<DiscipleshipAdminInput>({ resolver: zodResolver(discipleshipAdminSchema) });

  const memberMap = new Map(members.map((m) => [m.id, m]));

  async function onSubmit(v: DiscipleshipAdminInput) {
    setErr("");
    try {
      const created = await createDiscipleship(supabase, {
        discipler_id: v.discipler_id,
        disciple_id: v.disciple_id,
        current_module: v.current_module || undefined,
        notes: v.notes || undefined,
      });
      await logAudit(supabase, "insert", "discipleship", created.id);
      reset();
      qc.invalidateQueries({ queryKey: ["all-discipleships"] });
    } catch (e: unknown) {
      // erro mais comum: já existe par ativo
      const msg = e instanceof Error ? e.message : "Erro ao criar par";
      setErr(msg.includes("duplicate") ? "Este discípulo já está em discipulado ativo." : msg);
    }
  }
  async function end(id: string, status: "concluido" | "pausado" | "desistente") {
    try {
      await endDiscipleship(supabase, id, status);
      await logAudit(supabase, "update", "discipleship", id, { status });
      qc.invalidateQueries({ queryKey: ["all-discipleships"] });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro");
    }
  }
  async function remove(id: string) {
    if (!confirm("Remover este par de discipulado?")) return;
    try {
      await deleteDiscipleship(supabase, id);
      await logAudit(supabase, "delete", "discipleship", id);
      qc.invalidateQueries({ queryKey: ["all-discipleships"] });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro");
    }
  }

  const ativos = discs.filter((d) => d.status === "ativo");
  const arquivados = discs.filter((d) => d.status !== "ativo");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-gold" />Novo par de discipulado</CardTitle>
          <CardDescription>Vincule um discipulador a um discípulo</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length < 2 ? (
            <p className="text-sm italic text-muted">
              Cadastre pelo menos 2 membros (na aba "Membros") antes de criar discipulados.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Discipulador" error={errors.discipler_id?.message}>
                  <select {...register("discipler_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">— Selecione —</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </Field>
                <Field label="Discípulo" error={errors.disciple_id?.message}>
                  <select {...register("disciple_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">— Selecione —</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Módulo atual" error={errors.current_module?.message}>
                <Input {...register("current_module")} placeholder="Ex: Trilha 1 - Novo Convertido" />
              </Field>
              <Field label="Notas" error={errors.notes?.message}>
                <textarea {...register("notes")} rows={2} className="w-full rounded-md border bg-background p-3 text-sm" placeholder="Observações pastorais" />
              </Field>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" disabled={isSubmitting} className="gap-2"><Plus className="h-4 w-4" />Criar par</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-2 font-display text-lg text-navy">Discipulados ativos ({ativos.length})</h3>
        <div className="space-y-2">
          {ativos.length === 0 && <p className="text-sm italic text-muted">Nenhum par ativo.</p>}
          {ativos.map((d) => {
            const er = memberMap.get(d.discipler_id);
            const ee = memberMap.get(d.disciple_id);
            return (
              <Card key={d.id}>
                <CardContent className="flex items-center justify-between gap-3 pt-4">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <b className="text-navy">{er?.full_name ?? "—"}</b>
                      <span className="text-muted"> → </span>
                      <b className="text-navy">{ee?.full_name ?? "—"}</b>
                    </p>
                    {d.current_module && <p className="text-xs text-muted">{d.current_module}</p>}
                    <p className="text-[11px] text-muted">Iniciado em {new Date(d.started_on).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button onClick={() => end(d.id, "concluido")} variant="outline" size="sm">Concluir</Button>
                    <Button onClick={() => end(d.id, "pausado")} variant="outline" size="sm">Pausar</Button>
                    <Button onClick={() => remove(d.id)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {arquivados.length > 0 && (
        <div>
          <h3 className="mb-2 font-display text-lg text-muted">Histórico ({arquivados.length})</h3>
          <div className="space-y-2">
            {arquivados.map((d) => {
              const er = memberMap.get(d.discipler_id);
              const ee = memberMap.get(d.disciple_id);
              return (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 opacity-70">
                  <div>
                    <p className="text-sm">
                      <b>{er?.full_name ?? "—"}</b> → <b>{ee?.full_name ?? "—"}</b>
                    </p>
                    <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[d.status]}`}>{d.status}</span>
                  </div>
                  <Button onClick={() => remove(d.id)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
