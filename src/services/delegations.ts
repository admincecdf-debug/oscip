"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DelegationPanel, ModuleDelegation, DelegationApproval, RoleDelegation,
  EmergencyAccess, ComplianceDashboard, ModuleDelegationRanking,
  CouncilMember, DelegationModule, DelegationScope, CouncilVote, Permission, AdminUserDirectoryRow,
} from "@/types/domain";

// ── Conselho Diretor ──────────────────────────────────────────
export async function listCouncilMembers(sb: SupabaseClient): Promise<(CouncilMember & { full_name: string; email: string })[]> {
  const { data, error } = await sb
    .from("council_members")
    .select("*, profiles(full_name, email)")
    .order("created_at");
  if (error) { console.error("[council]", error); return []; }
  return (data ?? []).map((r: any) => ({
    ...r, full_name: r.profiles?.full_name, email: r.profiles?.email,
  }));
}

export async function addCouncilMember(sb: SupabaseClient, profile_id: string, cargo: string): Promise<void> {
  const { error } = await sb.from("council_members").insert({ profile_id, cargo });
  if (error) throw error;
}

export async function removeCouncilMember(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("council_members").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

// ── Delegações ────────────────────────────────────────────────
export async function listDelegations(
  sb: SupabaseClient,
  opts?: { status?: string; module?: DelegationModule; profile_id?: string }
): Promise<DelegationPanel[]> {
  let q = sb.from("delegation_panel").select("*").order("requested_at", { ascending: false });
  if (opts?.status)     q = q.eq("status", opts.status);
  if (opts?.module)     q = q.eq("module", opts.module);
  if (opts?.profile_id) q = q.eq("profile_id", opts.profile_id);
  const { data, error } = await q;
  if (error) { console.error("[delegations]", error); return []; }
  return (data ?? []) as DelegationPanel[];
}

export async function requestDelegation(sb: SupabaseClient, payload: {
  profile_id: string; module: DelegationModule; trust_level: number;
  scope: DelegationScope; scope_id?: string|null; scope_name: string;
  request_reason: string; expires_at?: string|null; propagates_to_subordinates?: boolean;
}): Promise<ModuleDelegation> {
  const { data, error } = await sb
    .from("module_delegations").insert(payload).select().single();
  if (error) throw error;
  return data as ModuleDelegation;
}

export async function pautarConselho(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("module_delegations")
    .update({ council_pauta: true, council_pauta_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function approveDelegation(sb: SupabaseClient, id: string, opts: {
  trust_level: number; scope: DelegationScope; scope_name: string;
  review_notes?: string; expires_at?: string|null;
}): Promise<void> {
  const { error } = await sb.from("module_delegations").update({
    status: "ativo",
    trust_level: opts.trust_level,
    scope: opts.scope,
    scope_name: opts.scope_name,
    review_notes: opts.review_notes ?? null,
    expires_at: opts.expires_at ?? null,
    reviewed_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

export async function rejectDelegation(sb: SupabaseClient, id: string, review_notes: string): Promise<void> {
  const { error } = await sb.from("module_delegations")
    .update({ status: "rejeitado", review_notes, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function revokeDelegation(sb: SupabaseClient, id: string, revoke_reason: string): Promise<void> {
  const { error } = await sb.from("module_delegations")
    .update({ status: "revogado", revoke_reason, revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function suspendDelegation(sb: SupabaseClient, id: string, reason?: string): Promise<void> {
  const { error } = await sb.rpc("suspend_delegation", { p_delegation_id: id, p_reason: reason ?? null });
  if (error) throw error;
}

export async function reactivateDelegation(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.rpc("reactivate_delegation", { p_delegation_id: id });
  if (error) throw error;
}

// ── Votos do Conselho ────────────────────────────────────────
export async function castVote(sb: SupabaseClient, delegation_id: string, vote: CouncilVote, observation?: string): Promise<void> {
  const { error } = await sb.from("delegation_approvals")
    .upsert({ delegation_id, director_id: (await sb.auth.getUser()).data.user?.id, vote, observation: observation ?? null },
             { onConflict: "delegation_id,director_id" });
  if (error) throw error;
}

export async function listVotes(sb: SupabaseClient, delegation_id: string): Promise<(DelegationApproval & { director_name: string })[]> {
  const { data, error } = await sb
    .from("delegation_approvals")
    .select("*, profiles(full_name)")
    .eq("delegation_id", delegation_id);
  if (error) { console.error("[votes]", error); return []; }
  return (data ?? []).map((r: any) => ({ ...r, director_name: r.profiles?.full_name }));
}

// ── Delegação por cargo ──────────────────────────────────────
export async function listRoleDelegations(sb: SupabaseClient): Promise<RoleDelegation[]> {
  const { data, error } = await sb.from("role_delegations").select("*").order("role_name").order("module");
  if (error) { console.error("[role_del]", error); return []; }
  return (data ?? []) as RoleDelegation[];
}

export async function upsertRoleDelegation(sb: SupabaseClient, payload: {
  role_name: string; module: DelegationModule; trust_level: number; scope: string; description?: string;
}): Promise<void> {
  const { error } = await sb.from("role_delegations")
    .upsert(payload, { onConflict: "role_name,module" });
  if (error) throw error;
}

// ── Acesso Emergencial ────────────────────────────────────────
export async function listEmergencyAccess(sb: SupabaseClient): Promise<any[]> {
  const { data, error } = await sb.from("active_emergency_access").select("*");
  if (error) { console.error("[emergency]", error); return []; }
  return data ?? [];
}

export async function grantEmergencyAccess(sb: SupabaseClient, payload: {
  profile_id: string; module: DelegationModule; reason: string; expires_at: string;
}): Promise<void> {
  const user = (await sb.auth.getUser()).data.user;
  const { error } = await sb.from("emergency_access")
    .insert({ ...payload, approved_by: user?.id });
  if (error) throw error;
}

export async function revokeEmergencyAccess(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("emergency_access").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

// ── Dashboard Compliance ─────────────────────────────────────
export async function getComplianceDashboard(sb: SupabaseClient): Promise<ComplianceDashboard | null> {
  const { data, error } = await sb.from("compliance_dashboard").select("*").single();
  if (error) { console.error("[compliance]", error); return null; }
  return data as ComplianceDashboard;
}

export async function getModuleRanking(sb: SupabaseClient): Promise<ModuleDelegationRanking[]> {
  const { data, error } = await sb.from("module_delegation_ranking").select("*");
  if (error) { console.error("[ranking]", error); return []; }
  return (data ?? []) as ModuleDelegationRanking[];
}

// ── Verificar acesso ─────────────────────────────────────────
export async function checkModuleAccess(sb: SupabaseClient, module: DelegationModule): Promise<boolean> {
  const user = (await sb.auth.getUser()).data.user;
  if (!user) return false;
  const { data, error } = await sb.rpc("has_module_access", {
    p_profile_id: user.id, p_module: module,
  });
  if (error) return false;
  return !!data;
}

// ── Expirar delegações vencidas ──────────────────────────────
export async function expireDelegations(sb: SupabaseClient): Promise<void> {
  await sb.rpc("expire_delegations");
}

// ── Travamento real do painel (Governança) ────────────────────
export async function listMyActiveModules(sb: SupabaseClient): Promise<DelegationModule[]> {
  const { data, error } = await sb.rpc("my_active_modules");
  if (error) { console.error("[delegations] listMyActiveModules", error); return []; }
  return (data ?? []) as DelegationModule[];
}

/** Quais abas (TabKey do AdminSidebar) cada módulo de delegação libera. */
// ── Central de Delegações: busca de usuários (GOV-002 §9) ────────
export async function searchUsersDirectory(sb: SupabaseClient, opts: {
  query?: string; stateId?: string; churchId?: string; role?: string;
}): Promise<AdminUserDirectoryRow[]> {
  let q = sb.from("admin_users_directory").select("*").order("full_name").limit(100);
  if (opts.query && opts.query.trim().length >= 2) {
    const term = opts.query.trim();
    q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,cec_id.ilike.%${term}%`);
  }
  if (opts.stateId) q = q.eq("state_id", opts.stateId);
  if (opts.churchId) q = q.eq("church_id", opts.churchId);
  if (opts.role) q = q.eq("role", opts.role);
  const { data, error } = await q;
  if (error) { console.error("[delegations] searchUsersDirectory", error); return []; }
  return (data ?? []) as AdminUserDirectoryRow[];
}

export const DELEGATION_MODULE_LABELS: Record<DelegationModule, string> = {
  intelligence: "🧠 Inteligência", reports: "📊 Relatórios", control_tower: "🗼 Torre de Controle",
  finance: "💰 Financeiro", patrimony: "🏛️ Patrimônio", audit: "📋 Auditoria",
  administrativo: "⚙️ Administrativo", comunicacao: "📣 Comunicação",
  documentacao: "🗂️ Documentação", supervisao: "🧭 Supervisão Ministerial",
  usuarios: "👤 Administração de Usuários",
};

export const DELEGATION_TAB_MAP: Record<DelegationModule, string[]> = {
  administrativo: [
    "org-dashboard", "pendencias", "agenda", "notificacoes", "metas",
    "communities", "structure", "life-groups", "expansion-map", "genealogy", "formacao",
    "evangelism-groups",
    "mda", "mda-health", "saude", "ministerios", "ministerial-reports", "export", "gpv",
  ],
  usuarios: [
    "usuarios-painel", "members", "leadership", "invites", "permissions", "delegations",
    "score", "birthdays", "discipleship", "acolhimento", "evasao", "crm", "prayer-requests", "visit-requests",
  ],
  finance: ["finance"],
  patrimony: ["patrimony"],
  intelligence: ["intelligence"],
  reports: [],
  control_tower: ["control-tower"],
  audit: ["audit"],
  supervisao: ["relmda-supervisao", "relmda-consolidacao", "relmda-dashboard", "relmda-prazos", "relmda-area", "weekly", "monthly", "supervision", "ministerial-reports"],
  comunicacao: ["news", "banners", "sermons", "events", "services", "word"],
  documentacao: [],
};

// ── Permissões atômicas (evolução pro modelo de 4 camadas) ───
export async function listPermissions(sb: SupabaseClient, module?: DelegationModule): Promise<Permission[]> {
  let q = sb.from("permissions").select("*").order("key");
  if (module) q = q.eq("module", module);
  const { data, error } = await q;
  if (error) { console.error("[delegations] listPermissions", error); return []; }
  return (data ?? []) as Permission[];
}

export async function listDelegationPermissions(sb: SupabaseClient, delegationId: string): Promise<string[]> {
  const { data, error } = await sb.from("delegation_permissions").select("permission_key").eq("delegation_id", delegationId);
  if (error) { console.error("[delegations] listDelegationPermissions", error); return []; }
  return (data ?? []).map((r) => r.permission_key as string);
}

/** Substitui as permissões específicas da delegação. Lista vazia = libera todas as do módulo (padrão). */
export async function setDelegationPermissions(sb: SupabaseClient, delegationId: string, permissionKeys: string[]): Promise<void> {
  const { error: delErr } = await sb.from("delegation_permissions").delete().eq("delegation_id", delegationId);
  if (delErr) throw delErr;
  if (permissionKeys.length === 0) return;
  const { error } = await sb.from("delegation_permissions").insert(
    permissionKeys.map((permission_key) => ({ delegation_id: delegationId, permission_key }))
  );
  if (error) throw error;
}

export async function hasPermission(sb: SupabaseClient, profileId: string, permissionKey: string, targetChurchId?: string | null): Promise<boolean> {
  const { data, error } = await sb.rpc("has_permission", {
    p_profile_id: profileId, p_permission_key: permissionKey, p_target_church_id: targetChurchId ?? null,
  });
  if (error) { console.error("[delegations] hasPermission", error); return false; }
  return !!data;
}
