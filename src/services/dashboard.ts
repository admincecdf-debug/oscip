import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardStats } from "@/types/domain";

const EMPTY: DashboardStats = {
  total_members: 0, total_visitors: 0, total_groups: 0,
  total_reports: 0, baptisms: 0, by_stage: {}, reports_trend: [],
};

export async function getDashboardStats(sb: SupabaseClient, churchId: string|null): Promise<DashboardStats> {
  try {
    const { data, error } = await sb.rpc("dashboard_stats_scoped", { p_church_id: churchId });
    if (error) throw error;
    return (data as unknown as DashboardStats) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

// ── Central de Pendências (UX-003 Cap. 3 Parte 4) ──────────────
export interface PendenciaItem {
  categoria: "oracao" | "visita" | "contato" | "delegacao" | "carteirinha" | "relmda";
  id: string; titulo: string; subtitulo: string | null;
  created_at: string; aba_destino: string;
}

export async function listCentralPendencias(sb: SupabaseClient): Promise<PendenciaItem[]> {
  const { data, error } = await sb.rpc("central_pendencias");
  if (error) { console.error("[dashboard] listCentralPendencias", error); return []; }
  return (data ?? []) as PendenciaItem[];
}

export const CATEGORIA_LABELS: Record<PendenciaItem["categoria"], string> = {
  oracao: "🙏 Oração", visita: "🏠 Visita", contato: "📞 Novo contato",
  delegacao: "🛡️ Delegação", carteirinha: "🪪 Carteirinha", relmda: "📋 RELMDA",
};

// ── Painel de Usuários (UX-003 Cap. 3 Parte 7) ──────────────────
export interface UsuariosStats {
  total_cadastrados: number; total_ativos: number; total_inativos: number; total_afastados: number;
  sessoes_ativas: number; convites_usados_30d: number; delegacoes_ativas: number; eventos_auditoria_7d: number;
}

export async function getUsuariosStats(sb: SupabaseClient): Promise<UsuariosStats | null> {
  const { data, error } = await sb.rpc("dashboard_usuarios_scoped").maybeSingle();
  if (error) { console.error("[dashboard] getUsuariosStats", error); return null; }
  return data as UsuariosStats | null;
}

// ── Indicadores de Ministérios e Eventos (UX-003 Cap. 3 Parte 3) ─
export interface MinisteriosEventosStats {
  total_ministerios: number; total_integrantes: number;
  eventos_futuros: number; eventos_realizados_30d: number; total_inscricoes_30d: number;
}
export interface MinisterioRankingRow { nome: string; integrantes: number; }

export async function getMinisteriosEventosStats(sb: SupabaseClient, churchId: string | null): Promise<MinisteriosEventosStats | null> {
  const { data, error } = await sb.rpc("dashboard_ministerios_eventos_scoped", { p_church_id: churchId }).maybeSingle();
  if (error) { console.error("[dashboard] getMinisteriosEventosStats", error); return null; }
  return data as MinisteriosEventosStats | null;
}

export async function getMinisteriosRanking(sb: SupabaseClient, churchId: string | null): Promise<MinisterioRankingRow[]> {
  const { data, error } = await sb.rpc("dashboard_ministerios_ranking", { p_church_id: churchId });
  if (error) { console.error("[dashboard] getMinisteriosRanking", error); return []; }
  return (data ?? []) as MinisterioRankingRow[];
}

// ── Inteligência Ministerial (UX-003 Cap. 3 Parte 3) ────────────
export interface SectorGrowthRow {
  sector_id: string; sector_name: string;
  members_last_6m: number; members_prior_6m: number; growth_pct: number | null;
}
export interface OverallGrowthRow {
  members_last_6m: number; members_prior_6m: number; growth_pct: number | null;
}

export async function getGrowthBySector(sb: SupabaseClient): Promise<SectorGrowthRow[]> {
  const { data, error } = await sb.rpc("intelligence_growth_by_sector");
  if (error) { console.error("[dashboard] getGrowthBySector", error); return []; }
  return (data ?? []) as SectorGrowthRow[];
}

export async function getGrowthOverall(sb: SupabaseClient): Promise<OverallGrowthRow | null> {
  const { data, error } = await sb.rpc("intelligence_growth_overall").maybeSingle();
  if (error) { console.error("[dashboard] getGrowthOverall", error); return null; }
  return data as OverallGrowthRow | null;
}
