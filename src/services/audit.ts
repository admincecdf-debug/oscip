import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditAction, AuditLog } from "@/types/domain";

export interface AuditExtra {
  /** Estado do registro antes da alteração (só os campos que mudaram, de preferência). */
  before?: Record<string, unknown>;
  /** Estado do registro depois da alteração. */
  after?: Record<string, unknown>;
  /** Motivo/justificativa informado por quem fez a ação. */
  justificativa?: string;
}

// Cacheia o IP por sessão de página — não precisa buscar de novo a cada log.
let cachedIp: string | null | undefined = undefined;
async function getClientIp(): Promise<string | null> {
  if (cachedIp !== undefined) return cachedIp;
  try {
    const res = await fetch("/api/client-ip");
    const data = await res.json();
    cachedIp = (data?.ip as string | undefined) ?? null;
  } catch {
    cachedIp = null;
  }
  return cachedIp;
}

/**
 * Registra um evento de auditoria.
 * `details` continua aceitando qualquer objeto livre (compatibilidade com
 * todo o código já existente). Use o 6º parâmetro (`extra`) pra registrar
 * valor anterior/posterior e justificativa de forma padronizada — eles
 * entram dentro de `details` como `before`/`after`/`justificativa`.
 */
export async function logAudit(
  sb: SupabaseClient, action: AuditAction, entity: string,
  entity_id?: string|null, details?: Record<string, unknown>|null,
  extra?: AuditExtra,
) {
  try {
    const ip = await getClientIp();
    const mergedDetails: Record<string, unknown> | null =
      (extra?.before || extra?.after || extra?.justificativa)
        ? {
            ...(details ?? {}),
            ...(extra.before ? { before: extra.before } : {}),
            ...(extra.after ? { after: extra.after } : {}),
            ...(extra.justificativa ? { justificativa: extra.justificativa } : {}),
          }
        : (details ?? null);

    await sb.rpc("audit_log", {
      p_action: action, p_entity: entity,
      p_entity_id: entity_id ?? null, p_details: mergedDetails, p_ip: ip,
    });
  } catch {
    // auditoria nunca pode quebrar o fluxo principal
  }
}

export async function listAuditLogs(sb: SupabaseClient, limit = 300): Promise<AuditLog[]> {
  const { data, error } = await sb.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) return [];
  return (data ?? []) as AuditLog[];
}
