"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AreaConsolidadoRow, AccessibleArea } from "@/types/domain";

export async function getAreaConsolidado(sb: SupabaseClient, areaId: string, month: number, year: number): Promise<AreaConsolidadoRow[]> {
  const { data, error } = await sb.rpc("relatorio_area_consolidado", { p_area_id: areaId, p_month: month, p_year: year });
  if (error) { console.error("[relmda] getAreaConsolidado", error); return []; }
  return (data ?? []) as AreaConsolidadoRow[];
}

export async function listAccessibleAreas(sb: SupabaseClient): Promise<AccessibleArea[]> {
  const { data, error } = await sb.rpc("list_accessible_areas");
  if (error) { console.error("[relmda] listAccessibleAreas", error); return []; }
  return (data ?? []) as AccessibleArea[];
}
