import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/domain";

export async function getMyProfile(sb: SupabaseClient): Promise<Profile | null> {
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await sb.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}
