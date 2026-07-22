"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, Pencil, X, Globe, MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useChurches, useSectors, useNucleos, useDistricts } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { logAudit } from "@/services/audit";
import type { Church } from "@/types/domain";

const communitySchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório"),
  slug: z.string().trim().min(2, "Slug obrigatório")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen"),
  type: z.enum(["sede","nucleo","igreja_local"]).default("sede"),
  parent_id: z.string().uuid().optional().or(z.literal("")),
  parent_territorial_level: z.enum(["nucleo","distrito","setor"]).optional().or(z.literal("")),
  parent_territorial_id: z.string().uuid().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  short_description: z.string().trim().optional().or(z.literal("")),
  logo_url: z.string().url("URL inválida").optional().or(z.literal("")),
  banner_url: z.string().url("URL inválida").optional().or(z.literal("")),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor hex inválida").optional().or(z.literal("")),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor hex inválida").optional().or(z.literal("")),
  site_url: z.string().url("URL inválida").optional().or(z.literal("")),
  whatsapp_phone: z.string().trim().optional().or(z.literal("")),
  // C13b
  phone_primary: z.string().trim().optional().or(z.literal("")),
  phone_secondary: z.string().trim().optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido").optional().or(z.literal("")),
  numero: z.string().trim().optional().or(z.literal("")),
  complemento: z.string().trim().optional().or(z.literal("")),
  referencia: z.string().trim().optional().or(z.literal("")),
  founded_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().or(z.literal("")),
  status_admin: z.enum(["ativa","em_implantacao","inativa"]).default("ativa"),
  observations: z.string().trim().optional().or(z.literal("")),
});
type CommunityInput = z.infer<typeof communitySchema>;

export function CommunitiesAdmin() {
  const { data: churches = [] } = useChurches();
  const { data: sectors = [] } = useSectors();
  const { data: nucleos = [] } = useNucleos();
  const { data: districts = [] } = useDistricts();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Church | null>(null);
  const [err, setErr] = useState("");

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<CommunityInput>({
      resolver: zodResolver(communitySchema),
      defaultValues: { type: "sede", primary_color: "#0E2A47", secondary_color: "#C9A227", parent_territorial_level: "setor" },
    });
  const slugWatch = watch("slug");
  const territorialLevelWatch = watch("parent_territorial_level");

  function startEdit(c: Church) {
    setEditing(c); setErr("");
    reset({
      name: c.name,
      slug: c.slug ?? "",
      type: c.type,
      parent_id: c.parent_id ?? "",
      parent_territorial_level: c.parent_level ?? "setor",
      parent_territorial_id: c.parent_territorial_id ?? c.sector_id ?? "",
      state: c.state ?? "",
      city: c.city ?? "",
      address: c.address ?? "",
      short_description: c.short_description ?? "",
      logo_url: c.logo_url ?? "",
      banner_url: c.banner_url ?? "",
      primary_color: c.primary_color ?? "#0E2A47",
      secondary_color: c.secondary_color ?? "#C9A227",
      site_url: c.site_url ?? "",
      whatsapp_phone: c.whatsapp_phone ?? "",
      phone_primary: c.phone_primary ?? "",
      phone_secondary: c.phone_secondary ?? "",
      email: c.email ?? "",
      cep: c.cep ?? "",
      numero: c.numero ?? "",
      complemento: c.complemento ?? "",
      referencia: c.referencia ?? "",
      founded_at: c.founded_at ?? "",
      status_admin: (c.status_admin as "ativa") ?? "ativa",
      observations: c.observations ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() {
    setEditing(null);
    reset({ type: "sede", primary_color: "#0E2A47", secondary_color: "#C9A227", status_admin: "ativa", parent_territorial_level: "setor" });
  }

  async function onSubmit(v: CommunityInput) {
    setErr("");
    try {
      const payload = {
        name: v.name, slug: v.slug, type: v.type,
        parent_id: v.parent_id || null,
        parent_level: v.parent_territorial_level || null,
        parent_territorial_id: v.parent_territorial_id || null,
        // sector_id (coluna legada) fica em sincronia só quando o nível escolhido é Setor
        sector_id: v.parent_territorial_level === "setor" ? (v.parent_territorial_id || null) : null,
        state: v.state || null, city: v.city || null, address: v.address || null,
        short_description: v.short_description || null,
        logo_url: v.logo_url || null, banner_url: v.banner_url || null,
        primary_color: v.primary_color || null, secondary_color: v.secondary_color || null,
        site_url: v.site_url || null, whatsapp_phone: v.whatsapp_phone || null,
        phone_primary: v.phone_primary || null,
        phone_secondary: v.phone_secondary || null,
        email: v.email || null,
        cep: v.cep || null,
        numero: v.numero || null,
        complemento: v.complemento || null,
        referencia: v.referencia || null,
        founded_at: v.founded_at || null,
        status_admin: v.status_admin || "ativa",
        observations: v.observations || null,
        is_active: v.status_admin !== "inativa",
      };
      console.log("[CommunitiesAdmin] Payload:", payload);

      if (editing) {
        const { error } = await supabase.from("churches").update(payload).eq("id", editing.id);
        if (error) {
          console.error("[CommunitiesAdmin] UPDATE error:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
          throw error;
        }
        await logAudit(supabase, "update", "churches", editing.id, { name: v.name });
      } else {
        const { data, error } = await supabase.from("churches").insert(payload).select().single();
        if (error) {
          console.error("[CommunitiesAdmin] INSERT error:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
          throw error;
        }
        console.log("[CommunitiesAdmin] Created:", data?.id);
        await logAudit(supabase, "insert", "churches", data.id, { name: v.name });
      }
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["churches"] });
      qc.invalidateQueries({ queryKey: ["active-community"] });
    } catch (e: unknown) {
      console.error("[CommunitiesAdmin] Erro completo ao salvar comunidade:", e);
      setErr(friendlyError(e));
    }
  }

  async function remove(c: Church) {
    if (!confirm(`Apagar comunidade "${c.name}"?\n\nIsso pode quebrar referências em conteúdos vinculados a ela.`)) return;
    try {
      const { error } = await supabase.from("churches").delete().eq("id", c.id);
      if (error) {
        console.error("[CommunitiesAdmin] DELETE error:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
        throw error;
      }
      await logAudit(supabase, "delete", "churches", c.id, { name: c.name });
      qc.invalidateQueries({ queryKey: ["churches"] });
    } catch (e: unknown) {
      console.error("[CommunitiesAdmin] Erro ao apagar:", e);
      alert(friendlyError(e));
    }
  }

  // Filtra sedes para serem possíveis "pais" no select
  const possibleParents = churches.filter((c) => c.type === "sede" && c.id !== editing?.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{editing ? "Editar comunidade" : "Nova comunidade"}</CardTitle>
              <CardDescription>{editing ? `Alterando: ${editing.name}` : "Sede, núcleo ou igreja local"}</CardDescription>
            </div>
            {editing && <Button onClick={cancelEdit} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Cancelar</Button>}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome" error={errors.name?.message}>
                <Input {...register("name")} placeholder="CEC Brasília" />
              </Field>
              <Field label="Slug (subdomínio)" error={errors.slug?.message}>
                <Input {...register("slug")} placeholder="brasilia" />
              </Field>
            </div>
            {slugWatch && (
              <p className="text-xs text-muted">URL pública: <code className="rounded bg-navy-50 px-1 py-0.5">{slugWatch}.cecfamily.com.br</code></p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo">
                <select {...register("type")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="sede">Sede</option>
                  <option value="nucleo">Núcleo</option>
                  <option value="igreja_local">Igreja Local</option>
                </select>
              </Field>
              <Field label="Comunidade Mãe (legado — só para dados antigos)">
                <select {...register("parent_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">— Nenhuma —</option>
                  {possibleParents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>

            <div className="rounded-md border bg-navy-50/40 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-navy-600">Posição na Estrutura Territorial (MEO-001)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nível de vínculo">
                  <select {...register("parent_territorial_level")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="setor">Setor (padrão)</option>
                    <option value="distrito">Distrito (pula o Setor)</option>
                    <option value="nucleo">Núcleo (pula Distrito e Setor)</option>
                  </select>
                </Field>
                <Field label={territorialLevelWatch === "nucleo" ? "Núcleo" : territorialLevelWatch === "distrito" ? "Distrito" : "Setor"} error={errors.parent_territorial_id?.message}>
                  <select {...register("parent_territorial_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">— Sem vínculo definido ainda —</option>
                    {(territorialLevelWatch === "nucleo" ? nucleos : territorialLevelWatch === "distrito" ? districts : sectors)
                      .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
              </div>
              <p className="mt-2 text-xs text-muted">
                É esse vínculo que posiciona a Igreja Local na árvore Estado → Núcleo → Distrito → Setor.
                Pode pular níveis (ex: ligar direto ao Núcleo se não tiver Distrito/Setor cadastrado).
              </p>
            </div>

            <Field label="Descrição curta" error={errors.short_description?.message}>
              <Input {...register("short_description")} placeholder="Frase que aparece no footer e meta tags" />
            </Field>

            {/* Endereço estruturado */}
            <div className="rounded-xl border bg-navy-50/30 p-3 space-y-3">
              <Label className="block font-bold uppercase tracking-wider text-navy-600 text-xs">Endereço</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="CEP" error={errors.cep?.message}>
                  <Input {...register("cep")} placeholder="00000-000" maxLength={9} />
                </Field>
                <Field label="Estado">
                  <Input {...register("state")} placeholder="DF" maxLength={3} />
                </Field>
                <Field label="Cidade">
                  <Input {...register("city")} placeholder="Brasília" />
                </Field>
              </div>
              <Field label="Logradouro">
                <Input {...register("address")} placeholder="Rua, Avenida..." />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Número">
                  <Input {...register("numero")} placeholder="123" />
                </Field>
                <Field label="Complemento">
                  <Input {...register("complemento")} placeholder="Sala, andar..." />
                </Field>
              </div>
              <Field label="Ponto de referência">
                <Input {...register("referencia")} placeholder="Em frente ao mercado X" />
              </Field>
            </div>

            {/* Contato */}
            <div className="rounded-xl border bg-gold/5 p-3 space-y-3">
              <Label className="block font-bold uppercase tracking-wider text-gold text-xs">Contato</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Telefone principal">
                  <Input {...register("phone_primary")} placeholder="(00) 0000-0000" />
                </Field>
                <Field label="Telefone secundário">
                  <Input {...register("phone_secondary")} placeholder="(00) 0000-0000" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="WhatsApp">
                  <Input {...register("whatsapp_phone")} placeholder="(00) 90000-0000" />
                </Field>
                <Field label="E-mail" error={errors.email?.message}>
                  <Input type="email" {...register("email")} placeholder="contato@comunidade.com" />
                </Field>
              </div>
            </div>

            {/* Informações administrativas */}
            <div className="rounded-xl border bg-card p-3 space-y-3">
              <Label className="block font-bold uppercase tracking-wider text-navy-600 text-xs">Informações administrativas</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Data de fundação" error={errors.founded_at?.message}>
                  <Input type="date" {...register("founded_at")} />
                </Field>
                <Field label="Situação">
                  <select {...register("status_admin")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="ativa">🟢 Ativa</option>
                    <option value="em_implantacao">🟡 Em Implantação</option>
                    <option value="inativa">⚪ Inativa</option>
                  </select>
                </Field>
              </div>
              <Field label="Observações">
                <textarea {...register("observations")} rows={2}
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  placeholder="Observações livres" />
              </Field>
            </div>

            <details className="rounded-md border bg-navy-50/50 p-3" open>
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-navy-600">Identidade visual</summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Logo (URL)" error={errors.logo_url?.message}>
                    <Input {...register("logo_url")} placeholder="https://..." />
                  </Field>
                  <Field label="Banner (URL)" error={errors.banner_url?.message}>
                    <Input {...register("banner_url")} placeholder="https://..." />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Cor primária (hex)" error={errors.primary_color?.message}>
                    <Input {...register("primary_color")} placeholder="#0E2A47" />
                  </Field>
                  <Field label="Cor secundária (hex)" error={errors.secondary_color?.message}>
                    <Input {...register("secondary_color")} placeholder="#C9A227" />
                  </Field>
                </div>
              </div>
            </details>

            <details className="rounded-md border bg-navy-50/50 p-3">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-navy-600">Contato</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Site externo" error={errors.site_url?.message}>
                  <Input {...register("site_url")} placeholder="https://..." />
                </Field>
                <Field label="WhatsApp" error={errors.whatsapp_phone?.message}>
                  <Input {...register("whatsapp_phone")} placeholder="(61) 90000-0000" />
                </Field>
              </div>
            </details>

            {err && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-line">
                {err}
                <p className="mt-1 text-[11px] opacity-70">Detalhes técnicos foram registrados no console do navegador (F12 → Console).</p>
              </div>
            )}
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {editing ? "Salvando…" : "Criando…"}
                </>
              ) : (
                <><Plus className="h-4 w-4" />{editing ? "Salvar alterações" : "Criar comunidade"}</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <h3 className="font-display text-lg text-navy">Comunidades ({churches.length})</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {churches.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            {c.banner_url && <img src={c.banner_url} alt="" className="aspect-[3/1] w-full object-cover" />}
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                {c.logo_url && <img src={c.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />}
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-navy">{c.name}</b>
                  <p className="text-[11px] text-muted">
                    <span className="font-bold uppercase">{c.type}</span>
                    {c.slug && <> · <code className="rounded bg-navy-50 px-1">{c.slug}</code></>}
                    {(c.city || c.state) && <> · {[c.city, c.state].filter(Boolean).join(", ")}</>}
                  </p>
                  {c.short_description && <p className="mt-1 text-xs text-muted line-clamp-2">{c.short_description}</p>}
                  {c.parent_territorial_id ? (
                    <p className="mt-1 text-[11px] text-muted">
                      📍 {(c.parent_level === "nucleo" ? nucleos : c.parent_level === "distrito" ? districts : sectors)
                        .find((p) => p.id === c.parent_territorial_id)?.name ?? "—"}
                      {c.parent_level && c.parent_level !== "setor" && (
                        <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">
                          direto no {c.parent_level === "nucleo" ? "Núcleo" : "Distrito"}
                        </span>
                      )}
                    </p>
                  ) : c.sector_id ? (
                    <p className="mt-1 text-[11px] text-muted">📍 {sectors.find((s) => s.id === c.sector_id)?.name ?? "Setor"}</p>
                  ) : (
                    <p className="mt-1 text-[11px] font-semibold text-amber-600">⚠ Sem Setor vinculado (fora da árvore MEO-001)</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {c.site_url && <a href={c.site_url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-gold hover:underline"><Globe className="h-3 w-3" />Site</a>}
                    {c.whatsapp_phone && <span className="flex items-center gap-0.5 text-muted"><MessageCircle className="h-3 w-3" />{c.whatsapp_phone}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button asChild variant="navy" size="sm">
                    <Link href={`/organizacional/comunidades/${c.id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
                  </Button>
                  <Button onClick={() => startEdit(c)} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button onClick={() => remove(c)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
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

/**
 * Traduz erros do Postgres/Supabase em mensagens amigáveis ao usuário.
 * Mantém o detalhe técnico no console.error (já feito antes de chamar isto).
 */
function friendlyError(e: unknown): string {
  if (typeof e !== "object" || e === null) return "Não foi possível salvar. Tente novamente.";
  const err = e as { code?: string; message?: string; details?: string; hint?: string };
  const msg = (err.message ?? "").toLowerCase();

  // Códigos Postgres conhecidos
  switch (err.code) {
    case "23505": // unique_violation
      if (msg.includes("slug")) return "Já existe uma comunidade com esse slug. Escolha outro.";
      return "Já existe uma comunidade com esses dados. Verifique os campos.";
    case "23503": // foreign_key_violation
      return "Comunidade pai inválida. Selecione outra ou deixe vazio.";
    case "23502": // not_null_violation
      return `Campo obrigatório ausente${err.details ? `: ${err.details}` : ""}.`;
    case "42501": // insufficient_privilege (RLS)
      return "Você não tem permissão para criar comunidades. Confirme que seu cargo é apóstolo ou pastor.";
    case "PGRST301": // RLS no Supabase
      return "Permissão negada pelo banco. RLS pode estar bloqueando.";
  }

  // Sem código? Tenta inferir do texto
  if (msg.includes("row-level security") || msg.includes("permission") || msg.includes("policy")) {
    return "Permissão negada. Seu usuário não tem acesso para criar comunidades.";
  }
  if (msg.includes("duplicate")) return "Já existe uma comunidade com esses dados.";

  // Mensagem genérica amigável + dica de ver console
  return `Não foi possível criar a comunidade. Verifique os dados ou tente novamente.${err.message ? `\n(${err.message})` : ""}`;
}
