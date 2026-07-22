"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MdaHealthRow } from "@/types/domain";

export async function getMdaHealthDashboard(sb: SupabaseClient): Promise<MdaHealthRow[]> {
  const { data, error } = await sb.from("mda_health_dashboard").select("*");
  if (error) {
    console.error("[mdaHealth] error:", error);
    return [];
  }
  return (data ?? []) as MdaHealthRow[];
}
