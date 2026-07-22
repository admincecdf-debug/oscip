"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadershipAssignment, AssignLeadershipInput, LeadershipFunction, ScopeLevel } from "@/types/domain";

export async function listLeadershipAssignments(sb: SupabaseClient): Promise<LeadershipAssignment[]> {
  const { data, error } = await sb
    .from("leadership_assignments_view")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) { console.error("[leadership] list", error); return []; }
  return (data ?? []) as LeadershipAssignment[];
}

export async function assignLeadership(sb: SupabaseClient, input: AssignLeadershipInput): Promise<string> {
  const { data, error } = await sb.rpc("assign_leadership", {
    p_profile_id: input.profile_id,
    p_function_type: input.function_type,
    p_church_id: input.church_id ?? null,
    p_scope_level: input.scope_level ?? null,
    p_scope_id: input.scope_id ?? null,
    p_ministry_id: input.ministry_id ?? null,
    p_life_group_id: input.life_group_id ?? null,
    p_started_at: input.started_at ?? new Date().toISOString().slice(0, 10),
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function remanejarLideranca(
  sb: SupabaseClient,
  currentAssignmentId: string,
  newFunction: LeadershipFunction,
  opts: {
    churchId?: string | null; scopeLevel?: ScopeLevel | null; scopeId?: string | null;
    ministryId?: string | null; lifeGroupId?: string | null; effectiveDate?: string; notes?: string | null;
  }
): Promise<string> {
  const { data, error } = await sb.rpc("remanejar_lideranca", {
    p_current_assignment_id: currentAssignmentId,
    p_new_function_type: newFunction,
    p_new_church_id: opts.churchId ?? null,
    p_new_scope_level: opts.scopeLevel ?? null,
    p_new_scope_id: opts.scopeId ?? null,
    p_new_ministry_id: opts.ministryId ?? null,
    p_new_life_group_id: opts.lifeGroupId ?? null,
    p_effective_date: opts.effectiveDate ?? new Date().toISOString().slice(0, 10),
    p_notes: opts.notes ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function encerrarLideranca(sb: SupabaseClient, assignmentId: string, endedAt?: string): Promise<void> {
  const { error } = await sb.from("leadership_assignments")
    .update({ status: "encerrado", ended_at: endedAt ?? new Date().toISOString().slice(0, 10) })
    .eq("id", assignmentId);
  if (error) throw error;
}
