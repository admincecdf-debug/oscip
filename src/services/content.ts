import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sermon, EventItem } from "@/types/domain";

export async function listPublicSermons(sb: SupabaseClient, churchId?: string | null): Promise<Sermon[]> {
  let q = sb.from("sermons").select("*").eq("is_published", true).order("published_at", { ascending: false });
  if (churchId) q = q.or(`church_id.eq.${churchId},church_id.is.null`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Sermon[];
}
export async function listPublicEvents(sb: SupabaseClient, churchId?: string | null): Promise<EventItem[]> {
  let q = sb.from("events").select("*").eq("is_published", true).order("starts_at");
  if (churchId) q = q.or(`church_id.eq.${churchId},church_id.is.null`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as EventItem[];
}
export async function listSermons(sb: SupabaseClient) {
  const { data, error } = await sb.from("sermons").select("*").eq("is_published", true).order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Sermon[];
}
export async function listEvents(sb: SupabaseClient) {
  const { data, error } = await sb.from("events").select("*").order("starts_at");
  if (error) throw error;
  return (data ?? []) as EventItem[];
}
export function youtubeId(url: string): string | null {
  const ps = [/[?&]v=([A-Za-z0-9_-]{11})/, /youtu\.be\/([A-Za-z0-9_-]{11})/, /\/shorts\/([A-Za-z0-9_-]{11})/, /\/embed\/([A-Za-z0-9_-]{11})/];
  for (const p of ps) { const m = url.match(p); if (m) return m[1]; }
  return null;
}
export function youtubeThumb(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
