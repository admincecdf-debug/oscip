"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberCard, CecIdValidation, CardStatus, CheckinLookupResult, CecIdCheckin } from "@/types/domain";

export async function getMemberCard(sb: SupabaseClient, memberId: string): Promise<MemberCard | null> {
  const { data, error } = await sb.from("members_card_view").select("*").eq("member_id", memberId).maybeSingle();
  if (error) { console.error("[cecId] getMemberCard", error); return null; }
  return data as MemberCard | null;
}

export async function approveMemberCard(sb: SupabaseClient, memberId: string): Promise<void> {
  const { error } = await sb.rpc("approve_member_card", { p_member_id: memberId });
  if (error) throw error;
}

export async function issueMemberCard(sb: SupabaseClient, memberId: string): Promise<void> {
  const { error } = await sb.rpc("issue_member_card", { p_member_id: memberId });
  if (error) throw error;
}

export async function setCardStatusManual(sb: SupabaseClient, memberId: string, status: Extract<CardStatus, "suspensa" | "cancelada" | "elegivel">): Promise<void> {
  const { error } = await sb.rpc("set_card_status_manual", { p_member_id: memberId, p_status: status });
  if (error) throw error;
}

export async function validateCecId(sb: SupabaseClient, token: string): Promise<CecIdValidation | null> {
  const { data, error } = await sb.rpc("validate_cec_id", { p_token: token });
  if (error) { console.error("[cecId] validateCecId", error); return null; }
  return data?.[0] ?? null;
}

export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  cadastro_incompleto: "Cadastro incompleto",
  aguardando_foto: "Aguardando foto",
  aguardando_documentos: "Aguardando documentos",
  aguardando_validacao: "Aguardando validação",
  aguardando_aprovacao: "Aguardando aprovação",
  elegivel: "Elegível para emissão",
  emitida: "Carteirinha emitida",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
};

export const CARD_STATUS_COLORS: Record<CardStatus, string> = {
  cadastro_incompleto: "bg-slate-100 text-slate-700 border-slate-300",
  aguardando_foto: "bg-amber-50 text-amber-700 border-amber-300",
  aguardando_documentos: "bg-amber-50 text-amber-700 border-amber-300",
  aguardando_validacao: "bg-blue-50 text-blue-700 border-blue-300",
  aguardando_aprovacao: "bg-purple-50 text-purple-700 border-purple-300",
  elegivel: "bg-green-50 text-green-700 border-green-300",
  emitida: "bg-green-100 text-green-800 border-green-400",
  suspensa: "bg-red-50 text-red-700 border-red-300",
  cancelada: "bg-red-100 text-red-800 border-red-400",
};

/** Gera a URL de imagem do QR Code sem precisar de dependência nova — usa a API pública do qrserver.com. */
export function qrCodeImageUrl(token: string): string {
  const validationUrl = `${typeof window !== "undefined" ? window.location.origin : "https://cec-painel.vercel.app"}/cec-id/${token}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(validationUrl)}`;
}

// ============================================================
// Leitor de Portaria (CEC ID Fase 2)
// ============================================================

/** Extrai o token do QR (a partir da URL codificada ou de um texto cru). */
export function extractTokenFromQr(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/cec-id\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

/** Busca a partir do token do QR escaneado (função de staff, já traz member_id). */
export async function lookupByToken(sb: SupabaseClient, token: string): Promise<CheckinLookupResult | null> {
  const { data, error } = await sb.rpc("checkin_lookup_by_token", { p_token: token.trim() }).maybeSingle();
  if (error) throw error;
  return data as CheckinLookupResult | null;
}

/** Busca manual por CEC ID (ex: CEC-BR-2026-00000001), pra quando o membro não tem o QR à mão. */
export async function lookupByCecId(sb: SupabaseClient, cecId: string): Promise<CheckinLookupResult | null> {
  const { data, error } = await sb.rpc("checkin_lookup_by_cec_id", { p_cec_id: cecId.trim() }).maybeSingle();
  if (error) throw error;
  return data as CheckinLookupResult | null;
}

/** Registra a entrada de um membro num evento/local. */
export async function registerCheckin(
  sb: SupabaseClient, memberId: string, eventLabel: string, method: "qr" | "manual"
): Promise<string> {
  const { data, error } = await sb.rpc("register_checkin", {
    p_member_id: memberId, p_event_label: eventLabel, p_method: method,
  });
  if (error) throw error;
  return data as string;
}

/** Lista as últimas entradas registradas (opcionalmente filtradas por evento/local). */
export async function listRecentCheckins(sb: SupabaseClient, eventLabel?: string, limit = 30): Promise<CecIdCheckin[]> {
  let q = sb.from("cec_id_checkins").select("*").order("checked_at", { ascending: false }).limit(limit);
  if (eventLabel) q = q.eq("event_label", eventLabel);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as CecIdCheckin[];
}
