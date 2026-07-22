"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberRelocation, RelocateMemberInput } from "@/types/domain";

export async function relocateMember(sb: SupabaseClient, input: RelocateMemberInput): Promise<string> {
  const { data, error } = await sb.rpc("relocate_member", {
    p_member_id: input.member_id,
    p_to_church_id: input.to_church_id,
    p_to_life_group_id: input.to_life_group_id ?? null,
    p_reason: input.reason,
    p_notes: input.notes ?? null,
    p_previous_function: input.previous_function ?? null,
    p_new_function: input.new_function ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function listMemberRelocations(sb: SupabaseClient, memberId: string): Promise<MemberRelocation[]> {
  const { data, error } = await sb
    .from("member_relocations_view")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[relocations] list", error); return []; }
  return (data ?? []) as MemberRelocation[];
}
