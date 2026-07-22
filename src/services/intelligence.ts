"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LgScoreMinisterial, LgRanking, RetentionFunnel, RetentionFunnelByChurch, LgReliabilityIndex, ReliabilitySummary, MonthlyConsolidation, GrowthVariation } from "@/types/domain";
export async function getLgScores(sb: SupabaseClient, churchId?: string): Promise<LgScoreMinisterial[]> {
  let q = sb.from("lg_score_ministerial").select("*").order("score_total", { ascending: false });
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[lg_score]", error); return []; }
  return (data ?? []) as LgScoreMinisterial[];
}
export async function getLgRankings(sb: SupabaseClient, churchId?: string): Promise<LgRanking[]> {
  let q = sb.from("lg_rankings").select("*").order("rank_geral");
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[lg_rankings]", error); return []; }
  return (data ?? []) as LgRanking[];
}
export async function getRetentionFunnel(sb: SupabaseClient): Promise<RetentionFunnel | null> {
  const { data, error } = await sb.from("retention_funnel").select("*").single();
  if (error) { console.error("[retention_funnel]", error); return null; }
  return data as RetentionFunnel;
}
export async function getRetentionFunnelByChurch(sb: SupabaseClient): Promise<RetentionFunnelByChurch[]> {
  const { data, error } = await sb.from("retention_funnel_by_church").select("*").order("total", { ascending: false });
  if (error) { console.error("[retention_funnel_church]", error); return []; }
  return (data ?? []) as RetentionFunnelByChurch[];
}
export async function getLgReliability(sb: SupabaseClient, churchId?: string): Promise<LgReliabilityIndex[]> {
  let q = sb.from("lg_reliability_index").select("*").order("total_flags", { ascending: false });
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[reliability]", error); return []; }
  return (data ?? []) as LgReliabilityIndex[];
}
export async function getReliabilitySummary(sb: SupabaseClient): Promise<ReliabilitySummary | null> {
  const { data, error } = await sb.from("reliability_summary").select("*").single();
  if (error) { console.error("[reliability_summary]", error); return null; }
  return data as ReliabilitySummary;
}
export async function getMonthlyConsolidation(sb: SupabaseClient, opts?: { churchId?: string; mes?: string }): Promise<MonthlyConsolidation[]> {
  let q = sb.from("monthly_consolidation").select("*").order("mes", { ascending: false });
  if (opts?.churchId) q = q.eq("church_id", opts.churchId);
  if (opts?.mes)      q = q.eq("mes_label", opts.mes);
  const { data, error } = await q;
  if (error) { console.error("[monthly_consolidation]", error); return []; }
  return (data ?? []) as MonthlyConsolidation[];
}
export async function getGrowthVariation(sb: SupabaseClient): Promise<GrowthVariation[]> {
  const { data, error } = await sb.from("growth_variation").select("*").order("mes");
  if (error) { console.error("[growth_variation]", error); return []; }
  return (data ?? []) as GrowthVariation[];
}
