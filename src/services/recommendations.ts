"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberRecommendation } from "@/types/domain";

export async function getMemberRecommendations(sb: SupabaseClient, memberId: string): Promise<MemberRecommendation[]> {
  const { data, error } = await sb.rpc("member_recommendations", { p_member_id: memberId });
  if (error) { console.error("[recommendations] getMemberRecommendations", error); return []; }
  return (data ?? []) as MemberRecommendation[];
}

export const PRIORITY_CONFIG: Record<MemberRecommendation["priority"], { color: string; icon: string }> = {
  critico: { color: "border-red-300 bg-red-50 text-red-700", icon: "🔴" },
  atencao: { color: "border-amber-300 bg-amber-50 text-amber-700", icon: "🟡" },
  info: { color: "border-blue-300 bg-blue-50 text-blue-700", icon: "🔵" },
};
