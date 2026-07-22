import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicPrayerRequest, VisitRequest, ContactStatus, PendingCounts } from "@/types/domain";

// ---------- Pedidos de oracao ----------
export interface PrayerFormInput {
  full_name: string; email?: string; phone?: string;
  city?: string; request: string; honeypot?: string;
  church_id?: string | null;
}
export async function submitPrayer(sb: SupabaseClient, input: PrayerFormInput): Promise<void> {
  if (input.honeypot && input.honeypot.trim() !== "") return; // anti-spam
  const { error } = await sb.from("public_prayer_requests").insert({
    full_name: input.full_name,
    email: input.email || null,
    phone: input.phone || null,
    city: input.city || null,
    request: input.request,
    church_id: input.church_id || null,
  });
  if (error) throw error;
}
export async function listPrayerRequests(sb: SupabaseClient, status?: ContactStatus): Promise<PublicPrayerRequest[]> {
  let q = sb.from("public_prayer_requests").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as PublicPrayerRequest[];
}
export async function updatePrayerStatus(sb: SupabaseClient, id: string, status: ContactStatus, notes?: string): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (notes !== undefined) patch.internal_notes = notes;
  const { error } = await sb.from("public_prayer_requests").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------- Visitas ----------
export interface VisitFormInput {
  full_name: string; email?: string; phone: string;
  city?: string; address?: string; best_time?: string; reason?: string;
  honeypot?: string; church_id?: string | null;
}
export async function submitVisit(sb: SupabaseClient, input: VisitFormInput): Promise<void> {
  if (input.honeypot && input.honeypot.trim() !== "") return;
  const { error } = await sb.from("visit_requests").insert({
    full_name: input.full_name,
    email: input.email || null,
    phone: input.phone,
    city: input.city || null,
    address: input.address || null,
    best_time: input.best_time || null,
    reason: input.reason || null,
    church_id: input.church_id || null,
  });
  if (error) throw error;
}
export async function listVisitRequests(sb: SupabaseClient, status?: ContactStatus): Promise<VisitRequest[]> {
  let q = sb.from("visit_requests").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as VisitRequest[];
}
export async function updateVisitStatus(sb: SupabaseClient, id: string, status: ContactStatus, notes?: string): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (notes !== undefined) patch.internal_notes = notes;
  const { error } = await sb.from("visit_requests").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------- Badges ----------
export async function getPendingCounts(sb: SupabaseClient): Promise<PendingCounts> {
  try {
    const { data, error } = await sb.rpc("get_pending_counts");
    if (error || !data) return { prayer_pending: 0, visit_pending: 0, pipeline_new: 0 };
    const row = Array.isArray(data) ? data[0] : data;
    return {
      prayer_pending: Number(row?.prayer_pending ?? 0),
      visit_pending: Number(row?.visit_pending ?? 0),
      pipeline_new: Number(row?.pipeline_new ?? 0),
    };
  } catch { return { prayer_pending: 0, visit_pending: 0, pipeline_new: 0 }; }
}
