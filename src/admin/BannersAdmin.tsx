"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, X, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { bannerSchema, type BannerInput } from "@/schemas";
import { useAllBanners, useChurches } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import {
  createBanner, updateBanner, deleteBanner, swapBannerOrder,
} from "@/services/banners";
import { logAudit } from "@/services/audit";
import type { Banner } from "@/types/domain";

function toIsoOrNull(local: string | undefined | null): string | null {
  if (!local || !local.trim()) return null;
  try { return new Date(local).toISOString(); } catch { return null; }
}
function fromIsoToLocal(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    // Para datetime-local: YYYY-MM-DDTHH:MM
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
}

export function BannersAdmin() {
  const { data: banners = [] } = useAllBanners();
  const { data: churches = [] } = useChurches();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Banner | null>(null);
  const [err, setErr] = useState("");
  const [churchId, setChurchId] = useState<string>("");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<BannerInput>({ resolver: zodResolver(bannerSchema), defaultValues: { is_active: true } });

  function startEdit(b: Banner) {
    setEditing(b); setErr("");
    setChurchId(((b as Banner & { church_id?: string | null }).church_id) ?? "");
    reset({
      title: b.title,
      subtitle: b.subtitle ?? "",
      image_url: b.image_url ?? "",
      cta_label: b.cta_label ?? "",
      cta_url: b.cta_url ?? "",
      is_active: b.is_active,
      starts_at: fromIsoToLocal(b.starts_at),
      ends_at: fromIsoToLocal(b.ends_at),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() { setEditing(null); setChurchId(""); reset({ is_active: true }); }

  async function onSubmit(v: BannerInput) {
    setErr("");
    try {
      const next_order = banners.length > 0 ? Math.max(...banners.map((b) => b.sort_order)) + 1 : 0;
      const payload: Partial<Banner> & { church_id?: string | null } = {
        title: v.title,
        subtitle: v.subtitle || null,
        image_url: v.image_url || null,
        cta_label: v.cta_label || null,
        cta_url: v.cta_url || null,
        is_active: v.is_active,
        starts_at: toIsoOrNull(v.starts_at),
        ends_at: toIsoOrNull(v.ends_at),
        church_id: churchId || null,
      };
      if (editing) {
        await updateBanner(supabase, editing.id, payload);
        await logAudit(supabase, "update", "banners", editing.id, { title: v.title });
      } else {
        payload.sort_order = next_order;
        const created = await createBanner(supabase, payload);
        await logAudit(supabase, "insert", "banners", created.id, { title: v.title });
      }
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["all-banners"] });
      qc.invalidateQueries({ queryKey: ["active-banners"] });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }
  async function toggleActive(b: Banner) {
    try {
      await updateBanner(supabase, b.id, { is_active: !b.is_active });
      await logAudit(supabase, "update", "banners", b.id, { action: !b.is_active ? "activate" : "deactivate" });
      qc.invalidateQueries({ queryKey: ["all-banners"] });
      qc.invalidateQueries({ queryKey: ["active-banners"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }
  async function remove(b: Banner) {
    if (!confirm(`Apagar banner "${b.title}"?`)) return;
    try {
      await deleteBanner(supabase, b.id);
      await logAudit(supabase, "delete", "banners", b.id, { title: b.title });
      qc.invalidateQueries({ queryKey: ["all-banners"] });
      qc.invalidateQueries({ queryKey: ["active-banners"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }
  async function move(b: Banner, dir: "up" | "down") {
    const sorted = [...banners].sort((a, c) => a.sort_order - c.sort_order);
    const idx = sorted.findIndex((x) => x.id === b.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    try {
      await swapBannerOrder(supabase, sorted[idx], sorted[swapIdx]);
      qc.invalidateQueries({ queryKey: ["all-banners"] });
      qc.invalidateQueries({ queryKey: ["active-banners"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  const sorted = [...banners].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{editing ? "Editar banner" : "Novo banner"}</CardTitle>
              <CardDescription>{editing ? `Alterando: ${editing.title}` : "Imagem de fundo, título, botão e agendamento opcional"}</CardDescription>
            </div>
            {editing && <Button onClick={cancelEdit} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Cancelar</Button>}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="Exibir em qual comunidade?">
              <select value={churchId} onChange={(e) => setChurchId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Global (todas as comunidades) —</option>
                {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Título" error={errors.title?.message}>
              <Input {...register("title")} placeholder="Ex: Conferência de Avivamento 2026" />
            </Field>
            <Field label="Subtítulo" error={errors.subtitle?.message}>
              <textarea {...register("subtitle")} rows={2}
                className="w-full rounded-md border bg-background p-3 text-sm"
                placeholder="Frase explicativa (opcional)" />
            </Field>
            <Field label="Imagem de fundo (URL)" error={errors.image_url?.message}>
              <Input {...register("image_url")} placeholder="https://..." />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Texto do botão"><Input {...register("cta_label")} placeholder="Ex: Inscreva-se" /></Field>
              <Field label="Link do botão" error={errors.cta_url?.message}><Input {...register("cta_url")} placeholder="https://..." /></Field>
            </div>

            <details className="rounded-md border bg-navy-50/50 p-3">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-navy-600">Agendamento (opcional)</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Aparecer a partir de"><Input type="datetime-local" {...register("starts_at")} /></Field>
                <Field label="Encerrar em"><Input type="datetime-local" {...register("ends_at")} /></Field>
              </div>
              <p className="mt-2 text-[11px] text-muted">Deixe vazio para o banner ficar ativo o tempo todo (enquanto marcado como ativo).</p>
            </details>

            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("is_active")} className="h-4 w-4 accent-gold" />
              <span className="text-sm font-semibold text-navy-600">Ativo (aparece na home)</span>
            </label>

            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Plus className="h-4 w-4" />{editing ? "Salvar alterações" : "Criar banner"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <h3 className="font-display text-lg text-navy">Banners ({sorted.length})</h3>
      <p className="text-xs text-muted">A ordem abaixo é a ordem em que aparecem no carousel da home.</p>

      <div className="space-y-2">
        {sorted.length === 0 && <p className="text-sm italic text-muted">Nenhum banner criado. A página pública usará o hero padrão.</p>}
        {sorted.map((b, idx) => (
          <Card key={b.id} className={!b.is_active ? "opacity-60" : ""}>
            <CardContent className="flex items-center gap-3 pt-4">
              {b.image_url && <img src={b.image_url} alt="" className="h-14 w-24 rounded object-cover" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <b className="truncate text-navy">{b.title}</b>
                  {!b.is_active && <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">Inativo</span>}
                  {(b.starts_at || b.ends_at) && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">Agendado</span>}
                </div>
                {b.subtitle && <p className="truncate text-xs text-muted">{b.subtitle}</p>}
                {b.cta_label && <p className="text-[11px] text-muted">CTA: {b.cta_label}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <Button onClick={() => move(b, "up")}   variant="ghost" size="sm" disabled={idx === 0}            className="h-7 w-7 p-0"><ChevronUp className="h-3.5 w-3.5" /></Button>
                <Button onClick={() => move(b, "down")} variant="ghost" size="sm" disabled={idx === sorted.length-1} className="h-7 w-7 p-0"><ChevronDown className="h-3.5 w-3.5" /></Button>
              </div>
              <Button onClick={() => toggleActive(b)} variant="outline" size="sm" title={b.is_active ? "Desativar" : "Ativar"}>
                {b.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button onClick={() => startEdit(b)} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button onClick={() => remove(b)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
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
