"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Church } from "@/types/domain";

/** Slug padrao quando nao houver subdominio (localhost, preview, ou dominio raiz). */
const DEFAULT_SLUG = "manaus";

/** Lista de hosts que NAO sao subdominios de comunidade (deve usar default). */
const NON_COMMUNITY_HOSTS = new Set([
  "localhost", "127.0.0.1", "0.0.0.0",
  "www", "app", "admin", "api", "vercel",
]);

/**
 * Detecta o slug da comunidade a partir do hostname:
 *  - brasilia.cecfamily.com.br -> "brasilia"
 *  - manaus.cecfamily.com.br -> "manaus"
 *  - localhost -> DEFAULT_SLUG
 *  - cecfamily.com.br (sem sub) -> DEFAULT_SLUG
 *  - cec-painel.vercel.app -> DEFAULT_SLUG
 * Roda apenas no cliente (window).
 */
export function detectCommunitySlug(): string {
  if (typeof window === "undefined") return DEFAULT_SLUG;
  const host = window.location.hostname.toLowerCase();
  // IP puro
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return DEFAULT_SLUG;
  const parts = host.split(".");
  if (parts.length < 3) return DEFAULT_SLUG; // ex.com, ex.com.br => sem subdominio
  const sub = parts[0];
  if (NON_COMMUNITY_HOSTS.has(sub)) return DEFAULT_SLUG;
  // Vercel preview: <something>.vercel.app -> usa default
  if (host.endsWith(".vercel.app")) return DEFAULT_SLUG;
  return sub;
}

/** Busca a comunidade ativa pelo slug. Retorna fallback se nao achar. */
export async function resolveCommunity(sb: SupabaseClient): Promise<Church | null> {
  const slug = detectCommunitySlug();
  try {
    // Tenta pelo slug detectado
    const { data, error } = await sb.from("churches").select("*").eq("slug", slug).maybeSingle();
    if (!error && data) return data as Church;
  } catch { /* ignore */ }
  // Fallback: pega a sede ativa
  try {
    const { data } = await sb.from("churches").select("*").eq("type", "sede").limit(1).maybeSingle();
    return (data as Church) ?? null;
  } catch { return null; }
}

/** Helper: monta um Church "default" quando nao conseguimos resolver. */
export function fallbackCommunity(): Church {
  return {
    id: "",
    name: "CEC",
    type: "sede",
    parent_id: null,
    sector_id: null,
    address: null,
    city: null,
    state: null,
    slug: DEFAULT_SLUG,
    pastor_id: null,
    logo_url: null,
    banner_url: null,
    primary_color: "#0E2A47",
    secondary_color: "#C9A227",
    short_description: null,
    site_url: null,
    whatsapp_phone: null,
    is_active: true,
  };
}

// ============================================================
// C13b — Estrutura Organizacional
// ============================================================
import type { ChurchDependencies } from "@/types/domain";

export async function getChurchDependencies(sb: SupabaseClient, churchId: string): Promise<ChurchDependencies | null> {
  try {
    const { data, error } = await sb.rpc("church_dependencies", { p_church_id: churchId });
    if (error || !data) return null;
    return data as ChurchDependencies;
  } catch { return null; }
}

export async function moveChurch(sb: SupabaseClient, churchId: string, newParentId: string | null): Promise<void> {
  const { error } = await sb.rpc("move_church", {
    p_church_id: churchId,
    p_new_parent_id: newParentId,
  });
  if (error) throw error;
}

export async function deleteChurch(sb: SupabaseClient, churchId: string): Promise<void> {
  const { error } = await sb.from("churches").delete().eq("id", churchId);
  if (error) throw error;
}
