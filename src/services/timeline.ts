import type { SupabaseClient } from "@supabase/supabase-js";
import type { PastoralTimeline, RecentEvolution, TimelineEventType } from "@/types/domain";

/** Linha do tempo espiritual de um membro. */
export async function listMemberTimeline(sb: SupabaseClient, memberId: string | null): Promise<PastoralTimeline[]> {
  if (!memberId) return [];
  try {
    const { data, error } = await sb.from("pastoral_timeline")
      .select("*").eq("member_id", memberId).order("event_date", { ascending: false });
    if (error) return [];
    return (data ?? []) as PastoralTimeline[];
  } catch { return []; }
}

/** Membros que avançaram de etapa nos últimos N dias (para o botão "Parabenizar por evolução"). */
export async function listRecentEvolutions(sb: SupabaseClient, days = 7): Promise<RecentEvolution[]> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data, error } = await sb.from("pastoral_timeline")
      .select("id, member_id, from_stage, to_stage, event_date, members(full_name, phone, church_id)")
      .eq("event_type", "mudanca_etapa")
      .eq("is_progression", true)
      .gte("event_date", since.toISOString().slice(0, 10))
      .order("event_date", { ascending: false });
    if (error) { console.error("[recent-evolutions]", error); return []; }
    return (data ?? []).map((r: any) => ({
      id: r.id, member_id: r.member_id, from_stage: r.from_stage, to_stage: r.to_stage,
      event_date: r.event_date,
      full_name: r.members?.full_name ?? "—", phone: r.members?.phone ?? null, church_id: r.members?.church_id ?? null,
    })) as RecentEvolution[];
  } catch { return []; }
}

/** Registra manualmente um marco de maturidade (ADR-001, Pilar II) na timeline do membro. */
export async function registerMilestone(
  sb: SupabaseClient,
  payload: { member_id: string; milestone_key: string; event_type: TimelineEventType; title: string; event_date: string; description?: string | null }
): Promise<void> {
  const { error } = await sb.from("pastoral_timeline").insert({
    member_id: payload.member_id,
    event_type: payload.event_type,
    milestone_key: payload.milestone_key,
    title: payload.title,
    description: payload.description ?? null,
    event_date: payload.event_date,
  });
  if (error) throw error;
}
