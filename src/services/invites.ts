"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InviteLinkCreateInput, InviteLinkRow, InviteTokenValidation,
} from "@/types/domain";

// ── Geração e gestão (área administrativa) ──────────────────────────

export async function createInviteLink(
  sb: SupabaseClient, input: InviteLinkCreateInput
): Promise<{ id: string; token: string } | null> {
  const { data, error } = await sb.rpc("create_invite_link", {
    p_kind: input.kind,
    p_church_id: input.church_id,
    p_district_id: input.district_id ?? null,
    p_area_id: input.area_id ?? null,
    p_sector_id: input.sector_id ?? null,
    p_life_group_id: input.life_group_id ?? null,
    p_ministry_id: input.ministry_id ?? null,
    p_target_role: input.target_role,
    p_discipler_id: input.discipler_id ?? null,
    p_validity: input.validity,
    p_max_uses: input.max_uses ?? null,
    p_allowed_ip_cidr: input.allowed_ip_cidr ?? null,
    p_scope_level: input.scope_level ?? null,
    p_scope_id: input.scope_id ?? null,
  });
  if (error) { console.error("[invites] createInviteLink", error); throw error; }
  return data?.[0] ?? null;
}

export async function listInviteLinks(
  sb: SupabaseClient, churchId?: string | null
): Promise<InviteLinkRow[]> {
  const { data, error } = await sb.rpc("list_invite_links", { p_church_id: churchId ?? null });
  if (error) { console.error("[invites] listInviteLinks", error); return []; }
  return data ?? [];
}

export async function revokeInviteLink(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.rpc("revoke_invite_link", { p_id: id });
  if (error) { console.error("[invites] revokeInviteLink", error); throw error; }
}

export async function deleteInviteLink(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.rpc("delete_invite_link", { p_id: id });
  if (error) { console.error("[invites] deleteInviteLink", error); throw error; }
}

export function inviteLinkUrl(token: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "https://cecfamily.com";
  return `${base}/convite/${token}`;
}

// ── Fluxo público (página /convite/[token]) ─────────────────────────

export async function validateInviteToken(
  sb: SupabaseClient, token: string
): Promise<InviteTokenValidation | null> {
  const { data, error } = await sb.rpc("validate_invite_token", { p_token: token });
  if (error) { console.error("[invites] validateInviteToken", error); return null; }
  return data?.[0] ?? null;
}

export async function consumeInviteLink(sb: SupabaseClient, token: string, phone?: string, userId?: string): Promise<void> {
  const { error } = await sb.rpc("consume_invite_link", {
    p_token: token,
    p_ip: null,          // capturado no futuro via header/edge function; ver seção 15 do caderno
    p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    p_phone: phone ?? null,
    p_user_id: userId ?? null,
  });
  if (error) { console.error("[invites] consumeInviteLink", error); throw error; }
}
