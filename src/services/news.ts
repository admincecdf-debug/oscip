import type { SupabaseClient } from "@supabase/supabase-js";
import type { News, NewsCategory } from "@/types/domain";

export async function listPublicNews(sb: SupabaseClient, category?: NewsCategory, churchId?: string | null): Promise<News[]> {
  let q = sb.from("news").select("*")
    .eq("is_published", true)
    .lte("published_at", new Date().toISOString())
    .order("sort_order", { ascending: true });
  if (category) q = q.eq("category", category);
  if (churchId) q = q.or(`church_id.eq.${churchId},church_id.is.null`);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as News[];
}
export async function listAllNews(sb: SupabaseClient): Promise<News[]> {
  const { data, error } = await sb.from("news").select("*").order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as News[];
}
export async function getNewsBySlug(sb: SupabaseClient, slug: string): Promise<News | null> {
  const { data, error } = await sb.from("news").select("*").eq("slug", slug).maybeSingle();
  if (error) return null;
  return (data as News) ?? null;
}
export async function createNews(sb: SupabaseClient, input: Partial<News>): Promise<News> {
  const { data, error } = await sb.from("news").insert(input).select().single();
  if (error) throw error;
  return data as News;
}
export async function updateNews(sb: SupabaseClient, id: string, patch: Partial<News>): Promise<void> {
  const { error } = await sb.from("news").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteNews(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("news").delete().eq("id", id);
  if (error) throw error;
}
/** Gera slug a partir do titulo (basico, sem dependencias). */
export function slugify(text: string): string {
  return text.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function swapNewsOrder(sb: SupabaseClient, a: News, b: News): Promise<void> {
  const { error: e1 } = await sb.from("news").update({ sort_order: b.sort_order }).eq("id", a.id);
  if (e1) throw e1;
  const { error: e2 } = await sb.from("news").update({ sort_order: a.sort_order }).eq("id", b.id);
  if (e2) throw e2;
}
