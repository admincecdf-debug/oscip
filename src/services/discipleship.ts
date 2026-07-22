import type { SupabaseClient } from "@supabase/supabase-js";
import type { Discipleship, Member } from "@/types/domain";

export async function getMyActiveDiscipleship(sb: SupabaseClient, myMemberId: string | null): Promise<{ disc: Discipleship; discipler: Member | null } | null> {
  if (!myMemberId) return null;
  try {
    const { data, error } = await sb.from("discipleship")
      .select("*").eq("disciple_id", myMemberId).eq("status", "ativo").maybeSingle();
    if (error || !data) return null;
    const disc = data as Discipleship;
    const { data: d } = await sb.from("members").select("*").eq("id", disc.discipler_id).maybeSingle();
    return { disc, discipler: (d as Member) ?? null };
  } catch { return null; }
}

export async function listMyDisciples(sb: SupabaseClient, myMemberId: string | null): Promise<Discipleship[]> {
  if (!myMemberId) return [];
  try {
    const { data, error } = await sb.from("discipleship")
      .select("*").eq("discipler_id", myMemberId).eq("status", "ativo");
    if (error) return [];
    return (data ?? []) as Discipleship[];
  } catch { return []; }
}

export async function listDisciplesWithNames(sb: SupabaseClient, discipleId: string): Promise<{ member_id: string; full_name: string }[]> {
  const { data, error } = await sb.from("discipleship").select("disciple_id").eq("discipler_id", discipleId).eq("status", "ativo");
  if (error || !data || data.length === 0) { if (error) console.error("[discipleship] listDisciplesWithNames", error); return []; }
  const ids = data.map((r) => r.disciple_id as string);
  const { data: members, error: mErr } = await sb.from("members").select("id, full_name").in("id", ids);
  if (mErr) { console.error("[discipleship] listDisciplesWithNames members", mErr); return []; }
  return (members ?? []).map((m) => ({ member_id: m.id as string, full_name: m.full_name as string }));
}

export async function getDiscipleshipChainUp(sb: SupabaseClient, memberId: string): Promise<{ level: number; member_id: string; full_name: string }[]> {
  const { data, error } = await sb.rpc("discipleship_chain_up", { p_member_id: memberId });
  if (error) { console.error("[discipleship] getDiscipleshipChainUp", error); return []; }
  return data ?? [];
}

export async function listAllDiscipleships(sb: SupabaseClient): Promise<Discipleship[]> {
  try {
    const { data, error } = await sb.from("discipleship").select("*").order("started_on", { ascending: false });
    if (error) return [];
    return (data ?? []) as Discipleship[];
  } catch { return []; }
}

export async function createDiscipleship(sb: SupabaseClient, input: { discipler_id: string; disciple_id: string; current_module?: string; notes?: string }): Promise<Discipleship> {
  const { data, error } = await sb.from("discipleship").insert({
    discipler_id: input.discipler_id, disciple_id: input.disciple_id,
    current_module: input.current_module || null, notes: input.notes || null,
    status: "ativo",
  }).select().single();
  if (error) throw error;
  return data as Discipleship;
}

export async function endDiscipleship(sb: SupabaseClient, id: string, status: "concluido" | "pausado" | "desistente" = "concluido"): Promise<void> {
  const { error } = await sb.from("discipleship").update({
    status, ended_on: new Date().toISOString().slice(0, 10),
  }).eq("id", id);
  if (error) throw error;
}

export async function deleteDiscipleship(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("discipleship").delete().eq("id", id);
  if (error) throw error;
}
