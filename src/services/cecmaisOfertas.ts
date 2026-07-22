"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CECmaisOferta, CECmaisOfertaInput, CECmaisCategoriaSlug } from "@/types/domain";

export async function listOfertas(sb: SupabaseClient, categoria?: CECmaisCategoriaSlug): Promise<CECmaisOferta[]> {
  let q = sb.from("cecmais_ofertas").select("*").eq("is_active", true).order("created_at", { ascending: false });
  if (categoria) q = q.eq("categoria", categoria);
  const { data, error } = await q;
  if (error) { console.error("[cecmais] listOfertas", error); return []; }
  return (data ?? []) as CECmaisOferta[];
}

export async function listAllOfertasAdmin(sb: SupabaseClient): Promise<CECmaisOferta[]> {
  const { data, error } = await sb.from("cecmais_ofertas").select("*").order("created_at", { ascending: false });
  if (error) { console.error("[cecmais] listAllOfertasAdmin", error); return []; }
  return (data ?? []) as CECmaisOferta[];
}

export async function getOferta(sb: SupabaseClient, id: string): Promise<CECmaisOferta | null> {
  const { data, error } = await sb.from("cecmais_ofertas").select("*").eq("id", id).maybeSingle();
  if (error) { console.error("[cecmais] getOferta", error); return null; }
  return data as CECmaisOferta | null;
}

export async function createOferta(sb: SupabaseClient, input: CECmaisOfertaInput): Promise<CECmaisOferta> {
  const { data, error } = await sb.from("cecmais_ofertas").insert(input).select().single();
  if (error) throw error;
  return data as CECmaisOferta;
}

export async function updateOferta(sb: SupabaseClient, id: string, input: CECmaisOfertaInput): Promise<void> {
  const { error } = await sb.from("cecmais_ofertas").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteOferta(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("cecmais_ofertas").delete().eq("id", id);
  if (error) throw error;
}

export const OFERTA_TIPO_LABELS: Record<CECmaisOferta["tipo"], string> = {
  produto: "Produto",
  conteudo_digital: "Conteúdo Digital",
  curso: "Curso",
  assinatura: "Assinatura",
  servico_plano: "Serviço/Plano",
};

/** Rótulo do botão de ação principal — reflete a 1ª etapa do fluxo de cada tipo (Seção 12). */
export const OFERTA_CTA_LABELS: Record<CECmaisOferta["tipo"], string> = {
  produto: "Comprar",
  conteudo_digital: "Comprar ou liberar",
  curso: "Matricular-se",
  assinatura: "Escolher plano",
  servico_plano: "Simular",
};
