// ============================================================
// CEC FAMILY - biblioteca interna (tipos, cliente, queries, rotulos)
// Tudo embutido: este projeto NAO depende de pacote externo.
// ============================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Json =
  | string | number | boolean | null
  | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
  public: {
    Tables: {
      churches: {
        Row: {
          id: string; name: string; type: Database["public"]["Enums"]["church_type"]
          parent_id: string | null; address: string | null; city: string | null
          state: string | null; is_active: boolean; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; name: string; type?: Database["public"]["Enums"]["church_type"]
          parent_id?: string | null; address?: string | null; city?: string | null
          state?: string | null; is_active?: boolean
        }
        Update: Partial<Database["public"]["Tables"]["churches"]["Insert"]>
        Relationships: []
      }
      events: {
        Row: {
          id: string; title: string; description: string | null
          starts_at: string; ends_at: string | null; location: string | null
          image_url: string | null; registration_url: string | null
          status: Database["public"]["Enums"]["event_status"]
          is_published: boolean; created_by: string | null; church_id: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; title: string; description?: string | null
          starts_at: string; ends_at?: string | null; location?: string | null
          image_url?: string | null; registration_url?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          is_published?: boolean; created_by?: string | null; church_id?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>
        Relationships: []
      }
      sermons: {
        Row: {
          id: string; title: string; reference: string | null; speaker: string | null
          youtube_url: string; thumbnail_url: string | null; category: string | null
          published_at: string; is_featured: boolean; is_published: boolean
          created_by: string | null; church_id: string | null; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; title: string; reference?: string | null; speaker?: string | null
          youtube_url: string; thumbnail_url?: string | null; category?: string | null
          published_at?: string; is_featured?: boolean; is_published?: boolean
          created_by?: string | null; church_id?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["sermons"]["Insert"]>
        Relationships: []
      }
      life_groups: {
        Row: {
          address: string | null; coleader_id: string | null; church_id: string | null; created_at: string
          frequency: Database["public"]["Enums"]["meeting_frequency"] | null
          host_id: string | null; id: string; is_active: boolean
          latitude: number | null; leader_id: string | null; longitude: number | null
          meeting_time: string | null
          meeting_weekday: Database["public"]["Enums"]["weekday"] | null
          name: string; parent_group_id: string | null; supervisor_id: string | null; updated_at: string
        }
        Insert: {
          address?: string | null; coleader_id?: string | null; church_id?: string | null
          frequency?: Database["public"]["Enums"]["meeting_frequency"] | null
          host_id?: string | null; id?: string; is_active?: boolean
          latitude?: number | null; leader_id?: string | null; longitude?: number | null
          meeting_time?: string | null
          meeting_weekday?: Database["public"]["Enums"]["weekday"] | null
          name: string; parent_group_id?: string | null; supervisor_id?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["life_groups"]["Insert"]>
        Relationships: []
      }
      meeting_reports: {
        Row: {
          attendance_count: number; created_at: string; decisions_count: number
          id: string; life_group_id: string; meeting_date: string; needs: string | null
          reported_by: string | null; summary: string | null; updated_at: string; visitors_count: number
        }
        Insert: {
          attendance_count?: number; decisions_count?: number; id?: string
          life_group_id: string; meeting_date?: string; needs?: string | null
          reported_by?: string | null; summary?: string | null; visitors_count?: number
        }
        Update: Partial<Database["public"]["Tables"]["meeting_reports"]["Insert"]>
        Relationships: []
      }
      members: {
        Row: {
          birth_date: string | null; church_id: string | null; created_at: string; discipler_id: string | null
          email: string | null; full_name: string; id: string; joined_at: string | null
          journey_stage: Database["public"]["Enums"]["journey_stage"]
          life_group_id: string | null; phone: string | null; profile_id: string | null
          status: Database["public"]["Enums"]["member_status"]; updated_at: string
        }
        Insert: {
          birth_date?: string | null; church_id?: string | null; discipler_id?: string | null; email?: string | null
          full_name: string; id?: string; joined_at?: string | null
          journey_stage?: Database["public"]["Enums"]["journey_stage"]
          life_group_id?: string | null; phone?: string | null; profile_id?: string | null
          status?: Database["public"]["Enums"]["member_status"]
        }
        Update: Partial<Database["public"]["Tables"]["members"]["Insert"]>
        Relationships: []
      }
      pastoral_care: {
        Row: {
          care_date: string; care_type: Database["public"]["Enums"]["care_type"]
          created_at: string; created_by: string | null; id: string
          is_confidential: boolean; member_id: string; notes: string
        }
        Insert: {
          care_date?: string; care_type: Database["public"]["Enums"]["care_type"]
          created_by?: string | null; id?: string; is_confidential?: boolean
          member_id: string; notes: string
        }
        Update: Partial<Database["public"]["Tables"]["pastoral_care"]["Insert"]>
        Relationships: []
      }
      pastoral_timeline: {
        Row: {
          created_at: string; created_by: string | null; description: string | null
          event_date: string; event_type: Database["public"]["Enums"]["timeline_event_type"]
          id: string; member_id: string; title: string
        }
        Insert: {
          created_by?: string | null; description?: string | null; event_date?: string
          event_type: Database["public"]["Enums"]["timeline_event_type"]
          id?: string; member_id: string; title: string
        }
        Update: Partial<Database["public"]["Tables"]["pastoral_timeline"]["Insert"]>
        Relationships: []
      }
      prayer_requests: {
        Row: {
          created_at: string; id: string; is_answered: boolean
          life_group_id: string | null; member_id: string | null; report_id: string | null; request: string
        }
        Insert: {
          id?: string; is_answered?: boolean; life_group_id?: string | null
          member_id?: string | null; report_id?: string | null; request: string
        }
        Update: Partial<Database["public"]["Tables"]["prayer_requests"]["Insert"]>
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null; church_id: string | null; created_at: string; email: string | null
          full_name: string; id: string; phone: string | null
          role: Database["public"]["Enums"]["user_role"]; updated_at: string
        }
        Insert: {
          avatar_url?: string | null; church_id?: string | null; email?: string | null; full_name: string
          id: string; phone?: string | null; role?: Database["public"]["Enums"]["user_role"]
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>
        Relationships: []
      }
      report_attendance: {
        Row: { id: string; member_id: string; present: boolean; report_id: string }
        Insert: { id?: string; member_id: string; present?: boolean; report_id: string }
        Update: Partial<Database["public"]["Tables"]["report_attendance"]["Insert"]>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      auth_role: { Args: never; Returns: Database["public"]["Enums"]["user_role"] }
      can_access_member: { Args: { mid: string }; Returns: boolean }
      create_meeting_report: {
        Args: {
          p_decisions_count: number; p_life_group_id: string; p_meeting_date: string
          p_needs: string; p_present_member_ids: string[]; p_summary: string; p_visitors_count: number
        }
        Returns: string
      }
      create_weekly_report: {
        Args: {
          p_life_group_id: string; p_meeting_date: string
          p_weekday: Database["public"]["Enums"]["weekday"] | null
          p_share_theme: string | null; p_bible_text: string | null
          p_flowed: boolean | null; p_flowed_reason: string | null
          p_decisions_count: number; p_needs: string | null; p_summary: string | null
          p_attendance: Json; p_visits: Json
        }
        Returns: string
      }
      dashboard_stats: { Args: never; Returns: Json }
      dashboard_stats_scoped: { Args: { p_church_id: string | null }; Returns: Json }
      network_breakdown: {
        Args: never
        Returns: {
          church_id: string; church_name: string
          church_type: Database["public"]["Enums"]["church_type"]
          membros: number; visitantes: number; grupos: number; relatorios: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      leads_group: { Args: { gid: string }; Returns: boolean }
      accessible_church_ids: { Args: never; Returns: string[] }
      in_my_network: { Args: { cid: string }; Returns: boolean }
      group_in_my_network: { Args: { gid: string }; Returns: boolean }
      member_in_my_network: { Args: { mid: string }; Returns: boolean }
    }
    Enums: {
      attendee_kind: "membro" | "frequentador"
      church_type: "sede" | "nucleo" | "igreja_local"
      care_type:
        | "aconselhamento" | "visita" | "ligacao" | "crise"
        | "oracao" | "acompanhamento" | "observacao_reservada"
      event_status: "abertas" | "encerradas" | "esgotado" | "em_breve"
      journey_stage:
        | "visitante" | "novo_convertido" | "consolidacao" | "discipulado"
        | "batismo" | "membro_ativo" | "servo" | "lider_formacao"
        | "lider" | "supervisor" | "missionario"
      meeting_frequency: "semanal" | "quinzenal" | "mensal"
      member_status: "ativo" | "inativo" | "afastado"
      timeline_event_type:
        | "conversao" | "batismo" | "consolidacao" | "discipulado" | "curso"
        | "ministerio" | "encontro" | "mudanca_etapa" | "observacao"
      user_role:
        | "apostolo" | "pastor" | "supervisor" | "lider"
        | "anfitriao" | "discipulador" | "membro" | "visitante"
      weekday: "domingo" | "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export type CecClient = SupabaseClient<Database>;

// ---------- cliente ----------
export function createCecClient(url: string, anonKey: string, options?: Parameters<typeof createClient>[2]): CecClient {
  return createClient<Database>(url, anonKey, options);
}

// ---------- rotulos de dominio ----------


/** Rotulos amigaveis (PT-BR) para os enums do dominio. */
export const ROLE_LABELS: Record<Enums<"user_role">, string> = {
  apostolo: "Apostolo",
  pastor: "Pastor",
  supervisor: "Supervisor",
  lider: "Lider",
  anfitriao: "Anfitriao",
  discipulador: "Discipulador",
  membro: "Membro",
  visitante: "Visitante",
};

export const JOURNEY_LABELS: Record<Enums<"journey_stage">, string> = {
  visitante: "Visitante",
  novo_convertido: "Novo convertido",
  consolidacao: "Consolidacao",
  discipulado: "Discipulado",
  batismo: "Batismo",
  membro_ativo: "Membro ativo",
  servo: "Servo",
  lider_formacao: "Lider em formacao",
  lider: "Lider",
  supervisor: "Supervisor",
  missionario: "Missionario",
};

export const WEEKDAY_LABELS: Record<Enums<"weekday">, string> = {
  domingo: "Domingo", segunda: "Segunda", terca: "Terca", quarta: "Quarta",
  quinta: "Quinta", sexta: "Sexta", sabado: "Sabado",
};

/** Papeis com visao global (lideranca apostolica). */
export const ADMIN_ROLES: Enums<"user_role">[] = ["apostolo", "pastor"];

export function isAdminRole(role?: Enums<"user_role"> | null): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}


export const CARE_LABELS: Record<Enums<"care_type">, string> = {
  aconselhamento: "Aconselhamento",
  visita: "Visita",
  ligacao: "Ligacao",
  crise: "Crise",
  oracao: "Oracao",
  acompanhamento: "Acompanhamento",
  observacao_reservada: "Observacao reservada",
};

export const TIMELINE_LABELS: Record<Enums<"timeline_event_type">, string> = {
  conversao: "Conversao",
  batismo: "Batismo",
  consolidacao: "Consolidacao",
  discipulado: "Discipulado",
  curso: "Curso",
  ministerio: "Ministerio",
  encontro: "Encontro",
  mudanca_etapa: "Mudanca de etapa",
  observacao: "Observacao",
};



/** Rotulos PT-BR dos tipos de cuidado pastoral. */
export const CARE_TYPE_LABELS: Record<Enums<"care_type">, string> = {
  aconselhamento: "Aconselhamento",
  visita: "Visita",
  ligacao: "Ligacao",
  crise: "Crise",
  oracao: "Oracao",
  acompanhamento: "Acompanhamento",
  observacao_reservada: "Observacao reservada",
};

/** Rotulos PT-BR dos eventos da linha do tempo pastoral. */
export const TIMELINE_EVENT_LABELS: Record<Enums<"timeline_event_type">, string> = {
  conversao: "Conversao",
  batismo: "Batismo",
  consolidacao: "Consolidacao",
  discipulado: "Discipulado",
  curso: "Curso",
  ministerio: "Ministerio",
  encontro: "Encontro",
  mudanca_etapa: "Mudanca de etapa",
  observacao: "Observacao",
};

/** Rotulos PT-BR do status de inscricao de eventos. */
export const EVENT_STATUS_LABELS: Record<Enums<"event_status">, string> = {
  abertas: "Inscricoes abertas",
  encerradas: "Inscricoes encerradas",
  esgotado: "Esgotado",
  em_breve: "Em breve",
};

/** Rotulos PT-BR do tipo de igreja na hierarquia. */
export const CHURCH_TYPE_LABELS: Record<Enums<"church_type">, string> = {
  sede: "Sede",
  nucleo: "Nucleo",
  igreja_local: "Igreja local",
};

// ---------- queries ----------

/** Busca o perfil do usuario autenticado. */
export async function getMyProfile(sb: CecClient) {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await sb.from("profiles").select("*").eq("id", auth.user.id).single();
  if (error) throw error;
  return data;
}

/** Life Groups visiveis ao usuario (a RLS filtra por papel). */
export async function getMyLifeGroups(sb: CecClient) {
  const { data, error } = await sb.from("life_groups").select("*").eq("is_active", true).order("name");
  if (error) throw error;
  return data;
}

/** Membros de um Life Group. */
export async function getGroupMembers(sb: CecClient, lifeGroupId: string) {
  const { data, error } = await sb.from("members").select("*").eq("life_group_id", lifeGroupId).order("full_name");
  if (error) throw error;
  return data;
}

/** Ultimos relatorios de um Life Group. */
export async function getGroupReports(sb: CecClient, lifeGroupId: string) {
  const { data, error } = await sb
    .from("meeting_reports").select("*")
    .eq("life_group_id", lifeGroupId)
    .order("meeting_date", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Cria um relatorio de reuniao usando a funcao do banco create_meeting_report,
 * que tambem registra a lista de presenca (report_attendance) de forma atomica.
 * A contagem de presentes e derivada de present_member_ids no banco.
 */
export async function createReport(
  sb: CecClient,
  report: {
    life_group_id: string;
    meeting_date: string;
    summary?: string;
    visitors_count?: number;
    decisions_count?: number;
    needs?: string;
    present_member_ids?: string[];
  }
) {
  const { data, error } = await sb.rpc("create_meeting_report", {
    p_life_group_id: report.life_group_id,
    p_meeting_date: report.meeting_date,
    p_summary: report.summary ?? "",
    p_visitors_count: report.visitors_count ?? 0,
    p_decisions_count: report.decisions_count ?? 0,
    p_needs: report.needs ?? "",
    p_present_member_ids: report.present_member_ids ?? [],
  });
  if (error) throw error;
  return data as string; // id do relatorio criado
}

// ---------- Dashboard executivo ----------

/** Forma do JSON retornado por dashboard_stats() (RLS-aware no banco). */
export type DashboardStats = {
  total_members: number;
  total_visitors: number;
  total_groups: number;
  total_reports: number;
  baptisms: number;
  by_stage: Partial<Record<Enums<"journey_stage">, number>>;
  reports_trend: { week: string; attendance: number; visitors: number }[];
};

/** KPIs do painel: totais, distribuicao por etapa e tendencia de presenca. */
export async function getDashboardStats(sb: CecClient): Promise<DashboardStats> {
  const { data, error } = await sb.rpc("dashboard_stats");
  if (error) throw error;
  return data as unknown as DashboardStats;
}

// ---------- CRM Pastoral ----------

/** Dados de um membro especifico. */
export async function getMember(sb: CecClient, memberId: string) {
  const { data, error } = await sb.from("members").select("*").eq("id", memberId).single();
  if (error) throw error;
  return data;
}

/** Linha do tempo espiritual do membro (mais recente primeiro). */
export async function getMemberTimeline(sb: CecClient, memberId: string) {
  const { data, error } = await sb
    .from("pastoral_timeline").select("*")
    .eq("member_id", memberId)
    .order("event_date", { ascending: false });
  if (error) throw error;
  return data;
}

/** Registros de cuidado pastoral do membro (a RLS oculta confidenciais de quem nao pode ver). */
export async function getMemberCare(sb: CecClient, memberId: string) {
  const { data, error } = await sb
    .from("pastoral_care").select("*")
    .eq("member_id", memberId)
    .order("care_date", { ascending: false });
  if (error) throw error;
  return data;
}

/** Adiciona um evento na linha do tempo do membro. */
export async function addTimelineEvent(
  sb: CecClient,
  event: {
    member_id: string;
    event_type: Tables<"pastoral_timeline">["event_type"];
    title: string;
    description?: string;
    event_date?: string;
  }
) {
  const { data: auth } = await sb.auth.getUser();
  const payload: TablesInsert<"pastoral_timeline"> = {
    member_id: event.member_id,
    event_type: event.event_type,
    title: event.title,
    description: event.description ?? null,
    ...(event.event_date ? { event_date: event.event_date } : {}),
    created_by: auth.user?.id ?? null,
  };
  const { data, error } = await sb.from("pastoral_timeline").insert(payload).select().single();
  if (error) throw error;
  return data;
}

/** Registra um cuidado pastoral (aconselhamento, visita, crise, etc.). */
export async function addPastoralCare(
  sb: CecClient,
  care: {
    member_id: string;
    care_type: Tables<"pastoral_care">["care_type"];
    notes: string;
    is_confidential?: boolean;
    care_date?: string;
  }
) {
  const { data: auth } = await sb.auth.getUser();
  const payload: TablesInsert<"pastoral_care"> = {
    member_id: care.member_id,
    care_type: care.care_type,
    notes: care.notes,
    is_confidential: care.is_confidential ?? false,
    ...(care.care_date ? { care_date: care.care_date } : {}),
    created_by: auth.user?.id ?? null,
  };
  const { data, error } = await sb.from("pastoral_care").insert(payload).select().single();
  if (error) throw error;
  return data;
}

// ---------- Painel administrativo ----------

/** Perfis disponiveis para designar como lider/colider. */
export async function listProfiles(sb: CecClient) {
  const { data, error } = await sb.from("profiles").select("id, full_name, role").order("full_name");
  if (error) throw error;
  return data;
}

/** Atualiza nome / lider / colider / supervisor de uma celula. */
export async function updateLifeGroup(
  sb: CecClient,
  id: string,
  patch: { name?: string; leader_id?: string | null; coleader_id?: string | null; supervisor_id?: string | null }
) {
  const { data, error } = await sb.from("life_groups").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

// --- Eventos (agenda) ---
export async function listEvents(sb: CecClient) {
  const { data, error } = await sb.from("events").select("*").order("starts_at");
  if (error) throw error;
  return data;
}
export async function createEvent(sb: CecClient, ev: TablesInsert<"events">) {
  const { data, error } = await sb.from("events").insert(ev).select().single();
  if (error) throw error;
  return data;
}
export async function updateEvent(sb: CecClient, id: string, patch: Partial<TablesInsert<"events">>) {
  const { data, error } = await sb.from("events").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteEvent(sb: CecClient, id: string) {
  const { error } = await sb.from("events").delete().eq("id", id);
  if (error) throw error;
}

// --- Pregacoes (YouTube) ---
export async function listSermons(sb: CecClient) {
  const { data, error } = await sb.from("sermons").select("*").order("published_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function createSermon(sb: CecClient, s: TablesInsert<"sermons">) {
  const { data, error } = await sb.from("sermons").insert(s).select().single();
  if (error) throw error;
  return data;
}
export async function updateSermon(sb: CecClient, id: string, patch: Partial<TablesInsert<"sermons">>) {
  const { data, error } = await sb.from("sermons").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteSermon(sb: CecClient, id: string) {
  const { error } = await sb.from("sermons").delete().eq("id", id);
  if (error) throw error;
}

/** Extrai o ID de um link do YouTube (watch, youtu.be, shorts, embed). */
export function youtubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}
/** URL da thumbnail do YouTube a partir do link. */
export function youtubeThumb(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

// ---------- Igrejas (multi-tenant) ----------

/** Igrejas que o usuario pode acessar (a RLS ja filtra para a rede dele). */
export async function listChurches(sb: CecClient) {
  const { data, error } = await sb
    .from("churches")
    .select("id, name, type, parent_id")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data;
}

/** Igreja do usuario autenticado (id), usada para preencher church_id ao criar. */
export async function getMyChurchId(sb: CecClient): Promise<string | null> {
  const p = await getMyProfile(sb);
  return p?.church_id ?? null;
}

// ---------- Dashboard por igreja/setor ----------

/** Indicadores filtrados por igreja (churchId=null => rede inteira acessivel). */
export async function getDashboardStatsFor(sb: CecClient, churchId: string | null): Promise<DashboardStats> {
  const { data, error } = await sb.rpc("dashboard_stats_scoped", { p_church_id: churchId });
  if (error) throw error;
  return data as unknown as DashboardStats;
}

export type ChurchBreakdown = {
  church_id: string; church_name: string;
  church_type: Enums<"church_type">;
  membros: number; visitantes: number; grupos: number; relatorios: number;
};

/** Detalhamento: uma linha por igreja da rede. */
export async function getNetworkBreakdown(sb: CecClient): Promise<ChurchBreakdown[]> {
  const { data, error } = await sb.rpc("network_breakdown");
  if (error) throw error;
  return (data ?? []) as ChurchBreakdown[];
}

// ---------- Relatorio Semanal de Celula (fiel ao papel) ----------

export type WeeklyAttendance = {
  member_id: string;
  kind: "membro" | "frequentador";
  present: boolean;
  absence_reason?: string;
};
export type WeeklyVisit = { visitor_name: string; phone?: string; notes?: string };

export type WeeklyReportInput = {
  life_group_id: string;
  meeting_date: string;
  weekday?: Enums<"weekday"> | null;
  share_theme?: string;
  bible_text?: string;
  flowed?: boolean | null;
  flowed_reason?: string;
  decisions_count?: number;
  needs?: string;
  summary?: string;
  attendance: WeeklyAttendance[];
  visits: WeeklyVisit[];
};

/**
 * Envia o relatorio semanal completo. Os totais (presentes, frequentadores,
 * faltas, visitas) sao calculados no banco automaticamente.
 */
export async function createWeeklyReport(sb: CecClient, r: WeeklyReportInput) {
  const { data, error } = await sb.rpc("create_weekly_report", {
    p_life_group_id: r.life_group_id,
    p_meeting_date: r.meeting_date,
    p_weekday: r.weekday ?? null,
    p_share_theme: r.share_theme ?? null,
    p_bible_text: r.bible_text ?? null,
    p_flowed: r.flowed ?? null,
    p_flowed_reason: r.flowed_reason ?? null,
    p_decisions_count: r.decisions_count ?? 0,
    p_needs: r.needs ?? null,
    p_summary: r.summary ?? null,
    p_attendance: r.attendance as unknown as Json,
    p_visits: r.visits as unknown as Json,
  });
  if (error) throw error;
  return data as string;
}
