import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ministry, MinistryMember, MinistryPost, MinistryRole } from "@/types/domain";

// ============================================================
// MINISTRIES
// ============================================================
export async function listMinistries(sb: SupabaseClient, churchId?: string | null): Promise<Ministry[]> {
  let q = sb.from("ministries").select("*").order("name");
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as Ministry[];
}

export async function getMinistry(sb: SupabaseClient, id: string): Promise<Ministry | null> {
  const { data, error } = await sb.from("ministries").select("*").eq("id", id).maybeSingle();
  if (error) return null;
  return data as Ministry | null;
}

export async function createMinistry(sb: SupabaseClient, input: Partial<Ministry>): Promise<Ministry> {
  const { data, error } = await sb.from("ministries").insert(input).select().single();
  if (error) throw error;
  return data as Ministry;
}
export async function updateMinistry(sb: SupabaseClient, id: string, patch: Partial<Ministry>): Promise<void> {
  const { error } = await sb.from("ministries").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteMinistry(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("ministries").delete().eq("id", id);
  if (error) throw error;
}

/** Lista os ministérios do usuário autenticado (via RPC my_ministries). */
export async function listMyMinistries(sb: SupabaseClient): Promise<Ministry[]> {
  try {
    const { data, error } = await sb.rpc("my_ministries");
    if (error || !data) return [];
    return data as Ministry[];
  } catch { return []; }
}

// ============================================================
// MINISTRY MEMBERS
// ============================================================
export async function listMinistriesByMember(sb: SupabaseClient, memberId: string) {
  const { data, error } = await sb
    .from("ministry_members")
    .select("*, ministries(name, color, icon)")
    .eq("member_id", memberId)
    .order("joined_at", { ascending: false });
  if (error) { console.error("[ministries] listMinistriesByMember", error); return []; }
  return (data ?? []).map((r: any) => ({
    id: r.id, ministry_id: r.ministry_id, role: r.role, joined_at: r.joined_at, is_active: r.is_active,
    ministry_name: r.ministries?.name as string, ministry_color: r.ministries?.color as string | null,
  }));
}

export async function listMinistryMembers(sb: SupabaseClient, ministryId: string): Promise<MinistryMember[]> {
  const { data, error } = await sb.from("ministry_members").select("*").eq("ministry_id", ministryId);
  if (error) return [];
  return (data ?? []) as MinistryMember[];
}

export async function addMinistryMember(sb: SupabaseClient, ministryId: string, memberId: string, role: MinistryRole = "membro"): Promise<void> {
  const { error } = await sb.from("ministry_members").insert({
    ministry_id: ministryId, member_id: memberId, role,
  });
  if (error) throw error;
}

export async function updateMinistryMemberRole(sb: SupabaseClient, id: string, role: MinistryRole): Promise<void> {
  const { error } = await sb.from("ministry_members").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function removeMinistryMember(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("ministry_members").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// MINISTRY POSTS
// ============================================================
export async function listMinistryPosts(sb: SupabaseClient, ministryId?: string | null): Promise<MinistryPost[]> {
  let q = sb.from("ministry_posts").select("*").order("published_at", { ascending: false });
  if (ministryId) q = q.eq("ministry_id", ministryId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as MinistryPost[];
}

export async function createMinistryPost(sb: SupabaseClient, input: Partial<MinistryPost>): Promise<MinistryPost> {
  const { data, error } = await sb.from("ministry_posts").insert(input).select().single();
  if (error) throw error;
  return data as MinistryPost;
}

export async function deleteMinistryPost(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("ministry_posts").delete().eq("id", id);
  if (error) throw error;
}
