import type { SupabaseClient } from "@supabase/supabase-js";
import type { PipelineIntent } from "@/types/domain";

export interface PipelineCreateInput {
  community_id: string;
  intent: PipelineIntent;
  full_name: string;
  phone: string;
  email?: string;
  state?: string;
  city?: string;
  cep?: string;
  life_group_id?: string;
}

/** Cria entrada no pipeline. Requer usuario autenticado (apos signUp). */
export async function createPipelineEntry(sb: SupabaseClient, input: PipelineCreateInput): Promise<string> {
  const { data, error } = await sb.rpc("visitor_pipeline_create", {
    p_community_id: input.community_id,
    p_intent: input.intent,
    p_full_name: input.full_name,
    p_phone: input.phone,
    p_email: input.email ?? null,
    p_state: input.state ?? null,
    p_city: input.city ?? null,
    p_cep: input.cep ?? null,
    p_life_group_id: input.life_group_id ?? null,
  });
  if (error) throw error;
  return data as string;
}

// ---------- ViaCEP (API publica gratuita) ----------
export interface CepInfo {
  cep: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string; // cidade
  uf?: string;         // estado
  erro?: boolean;
}

/** Busca dados de um CEP no ViaCEP. Aceita com ou sem mascara. */
export async function lookupCep(cep: string): Promise<CepInfo | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!r.ok) return null;
    const data = await r.json();
    if (data?.erro) return null;
    return data as CepInfo;
  } catch {
    return null;
  }
}

/** Aplica mascara basica em telefone brasileiro. */
export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

/** Aplica mascara basica em CEP. */
export function maskCep(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0,5)}-${d.slice(5)}`;
}

// ============================================================
// M4 — CRM Pastoral (admin)
// ============================================================
import type { VisitorPipeline, PipelineStage } from "@/types/domain";

export async function listPipeline(sb: SupabaseClient, opts?: { stage?: PipelineStage; communityId?: string | null }): Promise<VisitorPipeline[]> {
  let q = sb.from("visitor_pipeline").select("*").order("created_at", { ascending: false });
  if (opts?.stage) q = q.eq("stage", opts.stage);
  if (opts?.communityId) q = q.eq("community_id", opts.communityId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as VisitorPipeline[];
}

export async function updatePipelineStage(sb: SupabaseClient, id: string, stage: PipelineStage, notes?: string): Promise<void> {
  const { error } = await sb.rpc("pipeline_update_stage", {
    p_pipeline_id: id, p_new_stage: stage, p_notes: notes ?? null,
  });
  if (error) throw error;
}

export async function assignPipeline(sb: SupabaseClient, id: string, profileId: string | null): Promise<void> {
  const { error } = await sb.rpc("pipeline_assign", {
    p_pipeline_id: id, p_assigned_to: profileId,
  });
  if (error) throw error;
}

export async function deletePipeline(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("visitor_pipeline").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Admin cadastra manualmente um participante de Grupo de Evangelismo
 * (pessoa sendo evangelizada, geralmente não é membro). Diferente de
 * createPipelineEntry (que usa RPC pensada pro auto-registro público),
 * esse é insert direto — o admin já está autenticado e tem permissão via RLS.
 */
export async function createEvangelismParticipant(sb: SupabaseClient, input: {
  full_name: string; phone: string; community_id: string; life_group_id?: string | null; evangelism_group_id: string;
}): Promise<void> {
  const { error } = await sb.from("visitor_pipeline").insert({
    full_name: input.full_name, phone: input.phone,
    community_id: input.community_id, life_group_id: input.life_group_id ?? null,
    evangelism_group_id: input.evangelism_group_id,
    intent: "conhecer", stage: "novo", source: "grupo_evangelismo",
  });
  if (error) throw error;
}

export async function listEvangelismParticipants(sb: SupabaseClient, groupId: string): Promise<VisitorPipeline[]> {
  const { data, error } = await sb.from("visitor_pipeline").select("*").eq("evangelism_group_id", groupId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VisitorPipeline[];
}

// ============================================================
// M5 — Central de Acolhimento (views)
// ============================================================
const VIEW_BY_KEY: Record<string, string> = {
  novos: "acolhimento_novos",
  sem_contato: "acolhimento_sem_contato",
  sem_lifegroup: "acolhimento_sem_lifegroup",
  sem_discipulador: "acolhimento_sem_discipulador",
  sem_batismo: "acolhimento_sem_batismo",
  em_consolidacao: "acolhimento_em_consolidacao",
  integrados: "acolhimento_integrados",
};

export async function listAcolhimento(sb: SupabaseClient, key: keyof typeof VIEW_BY_KEY): Promise<VisitorPipeline[]> {
  const viewName = VIEW_BY_KEY[key];
  if (!viewName) return [];
  try {
    const { data, error } = await sb.from(viewName).select("*");
    if (error) return [];
    return (data ?? []) as VisitorPipeline[];
  } catch { return []; }
}

// ============================================================
// M6 — Sugestão automática de Life Group
// ============================================================
import type { LgSuggestion } from "@/types/domain";

export async function suggestLifeGroups(sb: SupabaseClient, pipelineId: string): Promise<LgSuggestion[]> {
  try {
    const { data, error } = await sb.rpc("suggest_life_groups_for_pipeline", {
      p_pipeline_id: pipelineId,
    });
    if (error || !data) return [];
    return data as LgSuggestion[];
  } catch { return []; }
}

export async function acceptLgSuggestion(sb: SupabaseClient, pipelineId: string, lgId: string): Promise<void> {
  const { error } = await sb.rpc("pipeline_accept_lg_suggestion", {
    p_pipeline_id: pipelineId, p_lg_id: lgId,
  });
  if (error) throw error;
}

export async function computeTopSuggestion(sb: SupabaseClient, pipelineId: string): Promise<string | null> {
  try {
    const { data, error } = await sb.rpc("compute_top_suggestion_for_pipeline", {
      p_pipeline_id: pipelineId,
    });
    if (error) return null;
    return (data as string) ?? null;
  } catch { return null; }
}
