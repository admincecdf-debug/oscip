import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvangelismGroup, EvangelismGroupStatus } from "@/types/domain";

/** Lista todos os Grupos de Evangelismo, já com os responsáveis resolvidos. */
export async function listEvangelismGroups(sb: SupabaseClient): Promise<EvangelismGroup[]> {
  const { data, error } = await sb
    .from("evangelism_groups")
    .select("*, evangelism_group_leaders(member_id, members(full_name))")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    leader_ids: (r.evangelism_group_leaders ?? []).map((l: any) => l.member_id),
    leader_names: (r.evangelism_group_leaders ?? []).map((l: any) => l.members?.full_name ?? "—"),
  })) as EvangelismGroup[];
}

/** Cria um grupo e já grava seus responsáveis. */
export async function createEvangelismGroup(
  sb: SupabaseClient,
  input: Partial<EvangelismGroup>,
  leaderIds: string[]
): Promise<EvangelismGroup> {
  const { data, error } = await sb.from("evangelism_groups").insert({
    cell_id: input.cell_id, name: input.name,
    address: input.address ?? null, neighborhood: input.neighborhood ?? null,
    city: input.city ?? null, state: input.state ?? null,
    meeting_weekday: input.meeting_weekday ?? null, meeting_time: input.meeting_time ?? null,
    is_active: input.is_active ?? true,
    started_at: input.started_at ?? null, expected_end_at: input.expected_end_at ?? null,
  }).select().single();
  if (error) throw error;
  await syncLeaders(sb, data.id, leaderIds);
  return data as EvangelismGroup;
}

export async function updateEvangelismGroup(
  sb: SupabaseClient,
  id: string,
  input: Partial<EvangelismGroup>,
  leaderIds: string[]
): Promise<void> {
  const { error } = await sb.from("evangelism_groups").update({
    cell_id: input.cell_id, name: input.name,
    address: input.address ?? null, neighborhood: input.neighborhood ?? null,
    city: input.city ?? null, state: input.state ?? null,
    meeting_weekday: input.meeting_weekday ?? null, meeting_time: input.meeting_time ?? null,
    is_active: input.is_active ?? true,
    started_at: input.started_at ?? null, expected_end_at: input.expected_end_at ?? null,
  }).eq("id", id);
  if (error) throw error;
  await syncLeaders(sb, id, leaderIds);
}

export async function deleteEvangelismGroup(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("evangelism_groups").delete().eq("id", id);
  if (error) throw error;
}

/** Atualiza só o status do ciclo de vida (ARQ-004 §8: Planejamento → ... → Resultado). */
export async function updateEvangelismGroupStatus(
  sb: SupabaseClient, id: string, status: EvangelismGroupStatus, resultingLgId?: string | null
): Promise<void> {
  const { error } = await sb.from("evangelism_groups")
    .update({ status, resulting_lg_id: resultingLgId ?? null })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Transforma o G.E. num novo Life Group (Resultado 1 do ARQ-004): cria a
 * célula nova reaproveitando church_id/sector_id do Life Group de origem,
 * e já marca o G.E. como encerrado com o vínculo pro resultado.
 */
export async function transformIntoLifeGroup(
  sb: SupabaseClient, groupId: string, newLgName: string, originCellId: string
): Promise<string> {
  const { data: origin, error: originErr } = await sb
    .from("life_groups").select("church_id, sector_id").eq("id", originCellId).single();
  if (originErr) throw originErr;

  const { data: newLg, error: lgErr } = await sb.from("life_groups").insert({
    name: newLgName, church_id: origin.church_id, sector_id: origin.sector_id,
    mother_cell_id: originCellId, is_active: true,
  }).select().single();
  if (lgErr) throw lgErr;

  await updateEvangelismGroupStatus(sb, groupId, "encerrado_novo_lg", newLg.id);
  return newLg.id as string;
}

/** Substitui a lista de responsáveis do grupo (apaga tudo e regrava). */
async function syncLeaders(sb: SupabaseClient, groupId: string, leaderIds: string[]): Promise<void> {
  const { error: delErr } = await sb.from("evangelism_group_leaders").delete().eq("group_id", groupId);
  if (delErr) throw delErr;
  if (leaderIds.length === 0) return;
  const { error: insErr } = await sb.from("evangelism_group_leaders")
    .insert(leaderIds.map((member_id) => ({ group_id: groupId, member_id })));
  if (insErr) throw insErr;
}
