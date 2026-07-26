"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCecmaisOfertasAdmin } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { createOferta, updateOferta, deleteOferta, OFERTA_TIPO_LABELS } from "@/services/cecmaisOfertas";
import { CECMAIS_CATEGORIAS } from "@/lib/cecmais-categorias";
import { logAudit } from "@/services/audit";
import type { CECmaisOferta, CECmaisOfertaTipo, CECmaisCategoriaSlug } from "@/types/domain";

const TIPOS: CECmaisOfertaTipo[] = ["produto", "conteudo_digital", "curso", "assinatura", "servico_plano"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

export function CECmaisOfertasAdmin() {
  const qc = useQueryClient();
  const { data: ofertas = [] } = useCecmaisOfertasAdmin();
  const [editing, setEditing] = useState<CECmaisOferta | null>(null);
  const [open, setOpen] = useState(false);

  async function toggleActive(o: CECmaisOferta) {
    try {
      await updateOferta(supabase, o.id, { is_active: !o.is_active });
      await logAudit(supabase, "update", "cecmais_ofertas", o.id, { is_active: !o.is_active });
      qc.invalidateQueries({ queryKey: ["cecmais-ofertas-admin"] });
      qc.invalidateQueries({ queryKey: ["cecmais-ofertas"] });
    } catch (e) { alert((e as { message?: string })?.message ?? "Erro"); }
  }
  async function remove(o: CECmaisOferta) {
    if (!confirm(`Remover "${o.nome}"?`)) return;
    try {
      await deleteOferta(supabase, o.id);
      await logAudit(supabase, "delete", "cecmais_ofertas", o.id, { nome: o.nome });
      qc.invalidateQueries({ queryKey: ["cecmais-ofertas-admin"] });
      qc.invalidateQueries({ queryKey: ["cecmais-ofertas"] });
    } catch (e) { alert((e as { message?: string })?.message ?? "Erro ao remover"); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Ofertas — CECmais</CardTitle>
            <CardDescription>Catálogo de produtos, conteúdo digital, cursos, assinaturas e serviços/planos (Fase 3 — sem contratação online ainda).</CardDescription>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5"><Plus size={16} /> Nova oferta</Button>
        </CardHeader>
        <CardContent>
          {ofertas.length === 0 ? (
            <p className="py-6 text-center text-sm italic text-muted-foreground">Nenhuma oferta cadastrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {ofertas.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-md border bg-card p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <b className="text-navy">{o.nome}</b>
                      <span className="rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{OFERTA_TIPO_LABELS[o.tipo]}</span>
                      <span className="rounded border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {CECMAIS_CATEGORIAS.find((c) => c.slug === o.categoria)?.nome ?? o.categoria}
                      </span>
                      {!o.is_active && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Inativa</span>}
                    </div>
                    {o.descricao_curta && <p className="mt-0.5 text-xs text-muted-foreground">{o.descricao_curta}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => toggleActive(o)} variant="outline" size="sm">{o.is_active ? "Desativar" : "Ativar"}</Button>
                    <Button onClick={() => { setEditing(o); setOpen(true); }} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button onClick={() => remove(o)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {open && <OfertaForm oferta={editing} onClose={() => setOpen(false)} />}
    </div>
  );
}

function OfertaForm({ oferta, onClose }: { oferta: CECmaisOferta | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<CECmaisCategoriaSlug>(oferta?.categoria ?? "saude");
  const [tipo, setTipo] = useState<CECmaisOfertaTipo>(oferta?.tipo ?? "produto");
  const [nome, setNome] = useState(oferta?.nome ?? "");
  const [descricaoCurta, setDescricaoCurta] = useState(oferta?.descricao_curta ?? "");
  const [descricaoCompleta, setDescricaoCompleta] = useState(oferta?.descricao_completa ?? "");
  const [imagemUrl, setImagemUrl] = useState(oferta?.imagem_url ?? "");
  const [parceiroNome, setParceiroNome] = useState(oferta?.parceiro_nome ?? "");
  const [preco, setPreco] = useState(oferta?.preco?.toString() ?? "");
  const [estoque, setEstoque] = useState(oferta?.estoque?.toString() ?? "");
  const [cargaHoraria, setCargaHoraria] = useState(oferta?.carga_horaria_horas?.toString() ?? "");
  const [numeroModulos, setNumeroModulos] = useState(oferta?.numero_modulos?.toString() ?? "");
  const [emiteCertificado, setEmiteCertificado] = useState(oferta?.emite_certificado ?? false);
  const [precoRecorrente, setPrecoRecorrente] = useState(oferta?.preco_recorrente?.toString() ?? "");
  const [periodicidade, setPeriodicidade] = useState(oferta?.periodicidade ?? "mensal");
  const [permiteDependentes, setPermiteDependentes] = useState(oferta?.permite_dependentes ?? false);
  const [carenciaDias, setCarenciaDias] = useState(oferta?.carencia_dias?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!nome.trim()) { setErr("Nome é obrigatório."); return; }
    setBusy(true); setErr("");
    try {
      const payload = {
        categoria, tipo, nome: nome.trim(),
        descricao_curta: descricaoCurta || null, descricao_completa: descricaoCompleta || null,
        imagem_url: imagemUrl || null, parceiro_nome: parceiroNome || null,
        preco: preco ? Number(preco) : null,
        estoque: estoque ? Number(estoque) : null,
        carga_horaria_horas: cargaHoraria ? Number(cargaHoraria) : null,
        numero_modulos: numeroModulos ? Number(numeroModulos) : null,
        emite_certificado: emiteCertificado,
        preco_recorrente: precoRecorrente ? Number(precoRecorrente) : null,
        periodicidade: periodicidade || null,
        permite_dependentes: permiteDependentes,
        carencia_dias: carenciaDias ? Number(carenciaDias) : null,
      };
      if (oferta) {
        await updateOferta(supabase, oferta.id, payload);
        await logAudit(supabase, "update", "cecmais_ofertas", oferta.id, { nome });
      } else {
        const created = await createOferta(supabase, payload);
        await logAudit(supabase, "insert", "cecmais_ofertas", created.id, { nome });
      }
      qc.invalidateQueries({ queryKey: ["cecmais-ofertas-admin"] });
      qc.invalidateQueries({ queryKey: ["cecmais-ofertas"] });
      onClose();
    } catch (e) { setErr((e as { message?: string })?.message ?? "Erro ao salvar"); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{oferta ? "Editar oferta" : "Nova oferta"}</CardTitle>
          <Button onClick={onClose} variant="ghost" size="sm"><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Categoria">
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as CECmaisCategoriaSlug)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {CECMAIS_CATEGORIAS.map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}
              </select>
            </Field>
            <Field label="Tipo">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as CECmaisOfertaTipo)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {TIPOS.map((t) => <option key={t} value={t}>{OFERTA_TIPO_LABELS[t]}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Curso de Fundamentos Bíblicos" /></Field>
          <Field label="Descrição curta"><Input value={descricaoCurta} onChange={(e) => setDescricaoCurta(e.target.value)} /></Field>
          <Field label="Descrição completa">
            <textarea value={descricaoCompleta} onChange={(e) => setDescricaoCompleta(e.target.value)} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Imagem (URL)"><Input value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} placeholder="https://…" /></Field>
            <Field label="Parceiro (opcional)"><Input value={parceiroNome} onChange={(e) => setParceiroNome(e.target.value)} /></Field>
          </div>

          {(tipo === "produto" || tipo === "conteudo_digital") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Preço (R$)"><Input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} /></Field>
              {tipo === "produto" && <Field label="Estoque"><Input type="number" value={estoque} onChange={(e) => setEstoque(e.target.value)} /></Field>}
            </div>
          )}

          {tipo === "curso" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Carga horária (h)"><Input type="number" value={cargaHoraria} onChange={(e) => setCargaHoraria(e.target.value)} /></Field>
              <Field label="Nº de módulos"><Input type="number" value={numeroModulos} onChange={(e) => setNumeroModulos(e.target.value)} /></Field>
              <Field label="Certificado">
                <select value={emiteCertificado ? "sim" : "nao"} onChange={(e) => setEmiteCertificado(e.target.value === "sim")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="nao">Não emite</option><option value="sim">Emite</option>
                </select>
              </Field>
            </div>
          )}

          {(tipo === "assinatura" || tipo === "servico_plano") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Valor (R$)"><Input type="number" step="0.01" value={precoRecorrente} onChange={(e) => setPrecoRecorrente(e.target.value)} /></Field>
              <Field label="Periodicidade">
                <select value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="mensal">Mensal</option><option value="anual">Anual</option>
                </select>
              </Field>
              <Field label="Permite dependentes">
                <select value={permiteDependentes ? "sim" : "nao"} onChange={(e) => setPermiteDependentes(e.target.value === "sim")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="nao">Não</option><option value="sim">Sim</option>
                </select>
              </Field>
              <Field label="Carência (dias)"><Input type="number" value={carenciaDias} onChange={(e) => setCarenciaDias(e.target.value)} /></Field>
            </div>
          )}

          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button onClick={save} disabled={busy} className="w-full">{busy ? "Salvando…" : "Salvar oferta"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
