"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScopeMetrics, LgWithHealth } from "@/types/domain";

type Level = "national" | "church_tree" | "church" | "district" | "area" | "sector";

export async function getScopeMetrics(sb: SupabaseClient, level: Level, id?: string | null): Promise<ScopeMetrics | null> {
  try {
    let rpcName: string;
    const params: Record<string, string> = {};
    switch (level) {
      case "national":     rpcName = "national_metrics"; break;
      case "church_tree":  rpcName = "church_tree_metrics"; if (id) params.p_church_id = id; break;
      case "church":       rpcName = "church_metrics"; if (id) params.p_church_id = id; break;
      case "district":     rpcName = "district_metrics"; if (id) params.p_district_id = id; break;
      case "area":         rpcName = "area_metrics"; if (id) params.p_area_id = id; break;
      case "sector":       rpcName = "sector_metrics"; if (id) params.p_sector_id = id; break;
    }
    const { data, error } = await sb.rpc(rpcName, params);
    if (error || !data) return null;
    return data as ScopeMetrics;
  } catch { return null; }
}

export async function listLgsWithHealth(sb: SupabaseClient, churchId?: string | null): Promise<LgWithHealth[]> {
  try {
    const { data, error } = await sb.rpc("lgs_with_health", churchId ? { p_church_id: churchId } : {});
    if (error || !data) return [];
    return data as LgWithHealth[];
  } catch { return []; }
}
