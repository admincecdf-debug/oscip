"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberRelationship, FamilyRelationshipType } from "@/types/domain";

export async function listMemberRelationships(sb: SupabaseClient, memberId: string): Promise<MemberRelationship[]> {
  const { data, error } = await sb.from("member_relationships").select("*").eq("member_id", memberId).order("created_at");
  if (error) { console.error("[family] listMemberRelationships", error); return []; }
  return (data ?? []) as MemberRelationship[];
}

export async function addMemberRelationship(sb: SupabaseClient, input: {
  member_id: string; related_member_id?: string | null; relationship_type: FamilyRelationshipType;
  related_name: string; related_phone?: string; notes?: string;
}): Promise<void> {
  const { error } = await sb.from("member_relationships").insert(input);
  if (error) throw error;
}

export async function removeMemberRelationship(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("member_relationships").delete().eq("id", id);
  if (error) throw error;
}

export const RELATIONSHIP_LABELS: Record<FamilyRelationshipType, string> = {
  pai: "Pai", mae: "Mãe", conjuge: "Cônjuge", filho: "Filho(a)",
  irmao: "Irmão(ã)", responsavel_legal: "Responsável legal", outro: "Outro",
};
