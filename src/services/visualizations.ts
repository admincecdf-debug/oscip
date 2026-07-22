"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LgGenealogyNode, OrgDashboardKpis, GrowthMonthlyRow, CityExpansion, StateExpansion,
} from "@/types/domain";

// ============================================================
// GENEALOGIA
// ============================================================
export async function getLgGenealogy(sb: SupabaseClient): Promise<LgGenealogyNode[]> {
  const { data, error } = await sb.from("lg_genealogy").select("*").order("generation").order("name");
  if (error) { console.error("[genealogy]", error); return []; }
  return (data ?? []) as LgGenealogyNode[];
}

// ============================================================
// DASHBOARD ORGANIZACIONAL
// ============================================================
export async function getOrgKpis(sb: SupabaseClient): Promise<OrgDashboardKpis | null> {
  const { data, error } = await sb.from("org_dashboard_kpis").select("*").maybeSingle();
  if (error) { console.error("[org kpis]", error); return null; }
  return data as OrgDashboardKpis | null;
}

export async function getGrowthMonthly(sb: SupabaseClient): Promise<GrowthMonthlyRow[]> {
  const { data, error } = await sb.from("org_growth_monthly").select("*");
  if (error) { console.error("[growth]", error); return []; }
  return (data ?? []) as GrowthMonthlyRow[];
}

// ============================================================
// MAPA DE EXPANSÃO
// ============================================================
export async function getExpansionCities(sb: SupabaseClient): Promise<CityExpansion[]> {
  const { data, error } = await sb.from("expansion_map_cities").select("*");
  if (error) { console.error("[expansion cities]", error); return []; }
  return (data ?? []) as CityExpansion[];
}

export async function getExpansionStates(sb: SupabaseClient): Promise<StateExpansion[]> {
  const { data, error } = await sb.from("expansion_map_states").select("*");
  if (error) { console.error("[expansion states]", error); return []; }
  return (data ?? []) as StateExpansion[];
}
