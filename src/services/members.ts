import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member } from "@/types/domain";

export async function getMyMember(sb: SupabaseClient): Promise<Member | null> {
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return null;
  try {
    const { data, error } = await sb.from("members").select("*").eq("profile_id", u.user.id).maybeSingle();
    if (error) return null;
    return (data as Member) ?? null;
  } catch { return null; }
}

export async function getMemberCompletionPercent(sb: SupabaseClient, memberId: string): Promise<number> {
  const { data, error } = await sb.rpc("member_completion_percent", { p_member_id: memberId });
  if (error) return 0;
  return (data as number) ?? 0;
}

export async function uploadMemberPhoto(sb: SupabaseClient, memberId: string, file: File): Promise<string> {
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada, faça login novamente.");
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${u.user.id}/${memberId}.${ext}`;
  const { error: upErr } = await sb.storage.from("member-photos").upload(path, file, {
    contentType: file.type, upsert: true,
  });
  if (upErr) throw upErr;
  const { data } = sb.storage.from("member-photos").getPublicUrl(path);
  return data.publicUrl;
}
/** Lista os membros ativos de um Life Group, opcionalmente excluindo um deles (ex: ao trocar de líder). */
export async function listCellMembers(sb: SupabaseClient, cellId: string, excludeMemberId?: string): Promise<Member[]> {
  let q = sb.from("members").select("*").eq("life_group_id", cellId).eq("status", "ativo").order("full_name");
  if (excludeMemberId) q = q.neq("id", excludeMemberId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as Member[];
}

export async function listAllMembers(sb: SupabaseClient): Promise<Member[]> {
  const { data, error } = await sb.from("members").select("*").order("full_name");
  if (error) return [];
  return (data ?? []) as Member[];
}

export async function createMember(sb: SupabaseClient, input: Partial<Member>): Promise<Member> {
  const { data, error } = await sb.from("members").insert(input).select().single();
  if (error) throw error;
  return data as Member;
}

export async function updateMember(sb: SupabaseClient, id: string, input: Partial<Member>): Promise<void> {
  const { data, error } = await sb.from("members").update(input).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "Nada foi salvo. Você pode não ter permissão para editar este cadastro, ou o registro não foi encontrado."
    );
  }
}

export async function deleteMember(sb: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await sb.from("members").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "Nada foi excluído. Provavelmente este membro está fora do seu escopo de permissão (church_id não bate com o seu acesso), ou já foi removido antes."
    );
  }
}

/** Resolve o nome real de Igreja/Life Group do membro, mesmo que estejam fora do escopo territorial de quem pergunta (desde que já tenha acesso ao membro). */
export async function getMemberStructureNames(
  sb: SupabaseClient, memberId: string
): Promise<{ church_name: string | null; life_group_name: string | null } | null> {
  const { data, error } = await sb.rpc("member_structure_names", { p_member_id: memberId }).maybeSingle();
  if (error) throw error;
  return data as { church_name: string | null; life_group_name: string | null } | null;
}
