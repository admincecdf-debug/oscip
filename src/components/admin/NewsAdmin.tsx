"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, X, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { newsSchema, type NewsInput } from "@/schemas";
import { useAllNews, useChurches, useMyProfile } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { createNews, updateNews, deleteNews, slugify, swapNewsOrder } from "@/services/news";
import { logAudit } from "@/services/audit";
import type { News, NewsCategory } from "@/types/domain";

const ROLE_LABELS: Record<string, string> = {
  apostolo: "Apóstolo", pastor: "Pastor", supervisor: "Supervisor",
  lider: "Líder", anfitriao: "Anfitrião", discipulador: "Discipulador", membro: "Membro",
};

const CATEGORIES: { value: NewsCategory; label: string }[] = [
  { value: "minha_comunidade", label: "Minha comunidade" },
  { value: "cec_manaus",       label: "CEC Manaus" },
  { value: "cec_brasilia",     label: "CEC Brasília" },
  { value: "geral",            label: "Gerais" },
];

export function NewsAdmin() {
  const { data: news = [] } = useAllNews();
  const { data: churches = [] } = useChurches();
  const { data: myProfile } = useMyProfile();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<News | null>(null);
  const [err, setErr] = useState("");
  const [churchId, setChurchId] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState<string>("");

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<NewsInput>({ resolver: zodResolver(newsSchema), defaultValues: { category: "geral", is_published: false } });

  const title = watch("title");
  const isPublishedNow = watch("is_published");

  function startEdit(n: News) {
    setEditing(n); setErr("");
    setChurchId(n.church_id ?? "");
    setScheduledAt(n.published_at && new Date(n.published_at) > new Date() ? n.published_at.slice(0, 16) : "");
    reset({
      title: n.title, category: n.category,
      summary: n.summary ?? "", body: n.body ?? "",
      cover_url: n.cover_url ?? "", author_name: n.author_name ?? "",
      is_published: n.is_published,
      meta_title: n.meta_title ?? "", meta_description: n.meta_description ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() { setEditing(null); setChurchId(""); setScheduledAt(""); reset({ category: "geral", is_published: false }); }

  async function onSubmit(v: NewsInput) {
    setErr("");
    try {
      const authorLabel = myProfile
        ? `${myProfile.full_name}${ROLE_LABELS[myProfile.role] ? ` (${ROLE_LABELS[myProfile.role]})` : ""}`
        : (v.author_name || null);
      const churchName = churches.find((c) => c.id === (churchId || myProfile?.church_id))?.name;
      const payload: Partial<News> = {
        slug: slugify(v.title),
        title: v.title, category: v.category,
        summary: v.summary || null, body: v.body || null,
        cover_url: v.cover_url || null,
        author_name: authorLabel ? `${authorLabel}${churchName ? ` — ${churchName}` : ""}` : null,
        is_published: v.is_published,
        published_at: v.is_published ? (scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString()) : null,
        meta_title: v.meta_title || v.title,
        meta_description: v.meta_description || v.summary || null,
        og_image_url: v.cover_url || null,
        church_id: churchId || null,
      };
      if (editing) {
        await updateNews(supabase, editing.id, payload);
        await logAudit(supabase, "update", "news", editing.id, { title: v.title });
      } else {
        const next_order = news.length > 0 ? Math.max(...news.map((n) => n.sort_order)) + 1 : 0;
        const created = await createNews(supabase, { ...payload, sort_order: next_order });
        await logAudit(supabase, "insert", "news", created.id, { title: v.title });
      }
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["all-news"] });
      qc.invalidateQueries({ queryKey: ["public-news"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      setErr(msg.includes("duplicate") ? "Já existe uma notícia com este título. Mude o título e tente novamente." : msg);
    }
  }

  async function togglePublish(n: News) {
    try {
      await updateNews(supabase, n.id, {
        is_published: !n.is_published,
        published_at: !n.is_published ? new Date().toISOString() : null,
      });
      await logAudit(supabase, "update", "news", n.id, { action: !n.is_published ? "publish" : "unpublish" });
      qc.invalidateQueries({ queryKey: ["all-news"] });
      qc.invalidateQueries({ queryKey: ["public-news"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }
  async function move(n: News, sortedList: News[], dir: "up" | "down") {
    const idx = sortedList.findIndex((x) => x.id === n.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedList.length) return;
    try {
      await swapNewsOrder(supabase, sortedList[idx], sortedList[swapIdx]);
      qc.invalidateQueries({ queryKey: ["all-news"] });
      qc.invalidateQueries({ queryKey: ["public-news"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }
  async function remove(n: News) {
    if (!confirm(`Apagar notícia "${n.title}"?`)) return;
    try {
      await deleteNews(supabase, n.id);
      await logAudit(supabase, "delete", "news", n.id, { title: n.title });
      qc.invalidateQueries({ queryKey: ["all-news"] });
      qc.invalidateQueries({ queryKey: ["public-news"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{editing ? "Editar notícia" : "Nova notícia"}</CardTitle>
              <CardDescription>{editing ? `Alterando: ${editing.title}` : "Categorize, escreva e publique"}</CardDescription>
            </div>
            {editing && <Button onClick={cancelEdit} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Cancelar</Button>}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="Publicar para qual comunidade?">
              <select value={churchId} onChange={(e) => setChurchId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Global (todas as comunidades) —</option>
                {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Título" error={errors.title?.message}>
              <Input {...register("title")} placeholder="Ex: Conferência de Avivamento 2026" />
            </Field>
            {title && <p className="text-xs text-muted">URL amigável: <code className="rounded bg-navy-50 px-1 py-0.5">/{slugify(title)}</code></p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Categoria">
                <select {...register("category")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Autor (automático)">
                <Input disabled value={myProfile ? `${myProfile.full_name}${ROLE_LABELS[myProfile.role] ? ` (${ROLE_LABELS[myProfile.role]})` : ""}` : "Carregando…"} />
              </Field>
            </div>
            <Field label="Resumo (chamada da home)" error={errors.summary?.message}>
              <textarea {...register("summary")} rows={2}
                className="w-full rounded-md border bg-background p-3 text-sm" maxLength={200}
                placeholder="Frase curta que aparece no card (até 200 caracteres)" />
            </Field>
            <Field label="Imagem de capa (URL)" error={errors.cover_url?.message}>
              <Input {...register("cover_url")} placeholder="https://..." />
            </Field>
            <Field label="Conteúdo">
              <textarea {...register("body")} rows={5}
                className="w-full rounded-md border bg-background p-3 text-sm"
                placeholder="Texto completo da notícia" />
            </Field>

            <details className="rounded-md border bg-navy-50/50 p-3">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-navy-600">SEO (opcional)</summary>
              <div className="mt-3 space-y-2">
                <Field label="Meta título (aparece no Google)">
                  <Input {...register("meta_title")} placeholder="Por padrão usa o título" />
                </Field>
                <Field label="Meta descrição">
                  <textarea {...register("meta_description")} rows={2} maxLength={160}
                    className="w-full rounded-md border bg-background p-3 text-sm"
                    placeholder="Até 160 caracteres. Por padrão usa o resumo." />
                </Field>
              </div>
            </details>

            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("is_published")} className="h-4 w-4 accent-gold" />
              <span className="text-sm font-semibold text-navy-600">Publicar</span>
            </label>
            {isPublishedNow && (
              <Field label="Data programada de publicação (opcional — deixe em branco pra publicar agora)">
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </Field>
            )}

            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Plus className="h-4 w-4" />{editing ? "Salvar alterações" : "Criar notícia"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <h3 className="font-display text-lg text-navy">Notícias ({news.length})</h3>
      <div className="space-y-2">
        {news.length === 0 && <p className="text-sm italic text-muted">Nenhuma notícia criada ainda.</p>}
        {[...news].sort((a, b) => a.sort_order - b.sort_order).map((n, idx, sortedList) => {
          const cat = CATEGORIES.find((c) => c.value === n.category)?.label ?? n.category;
          return (
            <div key={n.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => move(n, sortedList, "up")} disabled={idx === 0} className="text-muted-foreground hover:text-navy disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => move(n, sortedList, "down")} disabled={idx === sortedList.length - 1} className="text-muted-foreground hover:text-navy disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <b className="truncate text-navy">{n.title}</b>
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">{cat}</span>
                  {!n.is_published && <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">Rascunho</span>}
                </div>
                {n.summary && <p className="truncate text-xs text-muted">{n.summary}</p>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {n.author_name ? `Publicado por ${n.author_name} · ` : ""}
                  Cadastrada em {new Date(n.created_at).toLocaleDateString("pt-BR")} às {new Date(n.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {n.published_at && (
                    new Date(n.published_at) > new Date()
                      ? ` · Agendada para ${new Date(n.published_at).toLocaleDateString("pt-BR")} às ${new Date(n.published_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                      : ` · Publicada em ${new Date(n.published_at).toLocaleDateString("pt-BR")} às ${new Date(n.published_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                  )}
                </p>
              </div>
              <Button onClick={() => togglePublish(n)} variant="outline" size="sm" title={n.is_published ? "Despublicar" : "Publicar"}>
                {n.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button onClick={() => startEdit(n)} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button onClick={() => remove(n)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          );
        })}
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
