"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScopeLevel } from "@/types/domain";
export type { ScopeLevel };

export interface PastorScope {
  id: string;
  full_name: string;
  email: string | null;
  church_id: string | null;
  scope_level: ScopeLevel | null;
  scope_id: string | null;
  role: string;
}

export async function listPastors(sb: SupabaseClient): Promise<PastorScope[]> {
  const { data, error } = await sb
    .from("profiles")
    .select("id, full_name, email, church_id, scope_level, scope_id, role")
    .in("role", ["pastor", "supervisor"])
    .order("full_name");
  if (error) return [];
  return (data ?? []) as PastorScope[];
}

export async function countPastorsWithoutScope(sb: SupabaseClient): Promise<number> {
  try {
    const { data, error } = await sb.rpc("pastors_without_scope_count");
    if (error) return 0;
    return (data as number) ?? 0;
  } catch { return 0; }
}

export async function setPastorScope(sb: SupabaseClient, profileId: string, churchId: string | null): Promise<void> {
  const { error } = await sb.from("profiles").update({ church_id: churchId }).eq("id", profileId);
  if (error) throw error;
}

/** MEO-001: escopo em qualquer nível da Estrutura de Supervisão (Nacional/Estado/Núcleo/Distrito/Setor/Igreja). */
export async function setPastorScopeLevel(
  sb: SupabaseClient, profileId: string, level: ScopeLevel | null, id: string | null
): Promise<void> {
  const { error } = await sb.from("profiles").update({
    scope_level: level,
    scope_id: id,
    // Mantém church_id em sincronia só quando o escopo é de Igreja (compat com o resto do sistema
    // que ainda lê profile.church_id diretamente, ex: defaults de cadastro/relatório).
    church_id: level === "igreja" ? id : null,
  }).eq("id", profileId);
  if (error) throw error;
}
