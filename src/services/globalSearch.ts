"use client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface GlobalSearchResult {
  result_type: "membro" | "igreja" | "life_group";
  id: string;
  title: string;
  subtitle: string;
  extra: string;
}

export async function globalSearch(sb: SupabaseClient, query: string): Promise<GlobalSearchResult[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await sb.rpc("global_search", { p_query: query });
  if (error) { console.error("[search] globalSearch", error); return []; }
  return (data ?? []) as GlobalSearchResult[];
}

export const RESULT_TYPE_LABELS: Record<GlobalSearchResult["result_type"], string> = {
  membro: "Pessoa", igreja: "Igreja", life_group: "Life Group",
};
