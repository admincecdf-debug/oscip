import type { SupabaseClient } from "@supabase/supabase-js";
import type { MeetingReport, WeeklyAttendanceKind } from "@/types/domain";

export interface WeeklyReportInput {
  life_group_id: string;
  meeting_date: string;
  weekday?: string | null;
  share_theme?: string;
  bible_text?: string;
  flowed?: boolean | null;
  flowed_reason?: string;
  decisions_count?: number;
  needs?: string;
  summary?: string;
  attendance: {
    member_id: string;
    kind: WeeklyAttendanceKind;
    present: boolean;
    absence_reason?: string;
    had_mda_15_dias?: boolean;
    had_cc?: boolean;
    had_cel?: boolean;
  }[];
  visits: { visitor_name: string; phone?: string; notes?: string }[];
  // Indicadores semanais (Caderno 11-B parte 1)
  members_with_disciplers?: number;
  mda_15_dias_happened?: boolean;
  mda_15_dias_count?: number;
  ge_happened?: boolean;
  ge_location?: string;
  ge_when?: string;
  oferta_pix?: number;
  oferta_especie?: number;
  ebd_count?: number;
  cc_count?: number;
  cel_count?: number;
  kg_amor?: number;
  // Discipulado
  disc_realizados?: number; disc_ativos?: number; disc_encontros?: number;
  disc_interrompidos?: number; disc_novos?: number;
  // Consolidação
  cons_retornantes?: number; cons_acompanhamento?: number;
  cons_integrados?: number; cons_novos_membros?: number;
  // Liderança
  lid_aux_treinamento?: boolean; lid_em_formacao?: boolean;
  lid_potencial_multiplicador?: boolean; lid_observacoes?: string;
  // Multiplicação
  mult_filha_preparacao?: boolean; mult_nova_lideranca?: boolean; mult_potencial?: boolean;
  // Saúde
  saude_status?: string; saude_comentarios?: string;
  // Necessidades pastorais
  nec_oracao_urgente?: boolean; nec_visita_pastoral?: boolean;
  nec_problema_familiar?: boolean; nec_problema_espiritual?: boolean;
  nec_encaminhar_supervisor?: boolean;
}

/** Cria relatorio semanal via RPC (calcula totais automaticamente). */
export async function createWeeklyReport(sb: SupabaseClient, input: WeeklyReportInput): Promise<string> {
  const { data, error } = await sb.rpc("create_weekly_report", {
    p_life_group_id: input.life_group_id,
    p_meeting_date: input.meeting_date,
    p_weekday: input.weekday ?? null,
    p_share_theme: input.share_theme ?? null,
    p_bible_text: input.bible_text ?? null,
    p_flowed: input.flowed ?? null,
    p_flowed_reason: input.flowed_reason ?? null,
    p_decisions_count: input.decisions_count ?? 0,
    p_needs: input.needs ?? null,
    p_summary: input.summary ?? null,
    p_attendance: input.attendance,
    p_visits: input.visits,
    p_members_with_disciplers: input.members_with_disciplers ?? 0,
    p_mda_15_dias_happened: input.mda_15_dias_happened ?? false,
    p_mda_15_dias_count: input.mda_15_dias_count ?? 0,
    p_ge_happened: input.ge_happened ?? false,
    p_ge_location: input.ge_location ?? null,
    p_ge_when: input.ge_when ?? null,
    p_oferta_pix: input.oferta_pix ?? 0,
    p_oferta_especie: input.oferta_especie ?? 0,
    p_ebd_count: input.ebd_count ?? 0,
    p_cc_count: input.cc_count ?? 0,
    p_cel_count: input.cel_count ?? 0,
    p_kg_amor: input.kg_amor ?? 0,
    p_disc_realizados: input.disc_realizados ?? 0,
    p_disc_ativos: input.disc_ativos ?? 0,
    p_disc_encontros: input.disc_encontros ?? 0,
    p_disc_interrompidos: input.disc_interrompidos ?? 0,
    p_disc_novos: input.disc_novos ?? 0,
    p_cons_retornantes: input.cons_retornantes ?? 0,
    p_cons_acompanhamento: input.cons_acompanhamento ?? 0,
    p_cons_integrados: input.cons_integrados ?? 0,
    p_cons_novos_membros: input.cons_novos_membros ?? 0,
    p_lid_aux_treinamento: input.lid_aux_treinamento ?? false,
    p_lid_em_formacao: input.lid_em_formacao ?? false,
    p_lid_potencial_mult: input.lid_potencial_multiplicador ?? false,
    p_lid_observacoes: input.lid_observacoes ?? null,
    p_mult_filha_preparacao: input.mult_filha_preparacao ?? false,
    p_mult_nova_lideranca: input.mult_nova_lideranca ?? false,
    p_mult_potencial: input.mult_potencial ?? false,
    p_saude_status: input.saude_status ?? null,
    p_saude_comentarios: input.saude_comentarios ?? null,
    p_nec_oracao_urgente: input.nec_oracao_urgente ?? false,
    p_nec_visita_pastoral: input.nec_visita_pastoral ?? false,
    p_nec_problema_familiar: input.nec_problema_familiar ?? false,
    p_nec_problema_espiritual: input.nec_problema_espiritual ?? false,
    p_nec_encaminhar_super: input.nec_encaminhar_supervisor ?? false,
  });
  if (error) throw error;
  return data as string;
}

export async function listWeeklyReports(sb: SupabaseClient, cellId: string | null): Promise<MeetingReport[]> {
  if (!cellId) return [];
  const { data, error } = await sb.from("meeting_reports").select("*")
    .eq("life_group_id", cellId).order("meeting_date", { ascending: false });
  if (error) return [];
  return (data ?? []) as MeetingReport[];
}

export async function deleteWeeklyReport(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("meeting_reports").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// Tela detalhada: monta o relatório completo (report + LG + presença + visitas)
// ============================================================
import type { ReportFull, ReportAttendanceRow, ReportVisitRow, Cell } from "@/types/domain";

export async function getReportFull(sb: SupabaseClient, reportId: string): Promise<ReportFull | null> {
  // 1) Relatório base
  const { data: report, error: reportErr } = await sb
    .from("meeting_reports").select("*").eq("id", reportId).maybeSingle();
  if (reportErr || !report) return null;

  // 2) Life Group
  const { data: cell } = await sb
    .from("life_groups").select("*").eq("id", report.life_group_id).maybeSingle();

  // 3) Nome do líder do LG
  let leader_name: string | null = null;
  if (cell?.leader_id) {
    const { data: leaderProfile } = await sb
      .from("profiles").select("full_name").eq("id", cell.leader_id).maybeSingle();
    leader_name = leaderProfile?.full_name ?? null;
  }

  // 4) Nome de quem reportou
  let reporter_name: string | null = null;
  if (report.reported_by) {
    const { data: reporterProfile } = await sb
      .from("profiles").select("full_name").eq("id", report.reported_by).maybeSingle();
    reporter_name = reporterProfile?.full_name ?? null;
  }

  // 5) Lista de presença com nomes
  const { data: attRaw } = await sb
    .from("report_attendance").select("id, member_id, present, kind, absence_reason, had_mda_15_dias, had_cc, had_cel")
    .eq("report_id", reportId);
  const memberIds = (attRaw ?? []).map(a => a.member_id);
  const { data: members } = memberIds.length
    ? await sb.from("members").select("id, full_name").in("id", memberIds)
    : { data: [] };
  const nameById = new Map((members ?? []).map(m => [m.id, m.full_name]));
  const attendance: ReportAttendanceRow[] = (attRaw ?? []).map(a => ({
    id: a.id, member_id: a.member_id, member_name: nameById.get(a.member_id) ?? "—",
    present: a.present, kind: a.kind, absence_reason: a.absence_reason,
    had_mda_15_dias: a.had_mda_15_dias, had_cc: a.had_cc, had_cel: a.had_cel,
  }));

  // 6) Visitantes da reunião — tabela report_visits (se existir) ou subset de meeting_reports
  let visits: ReportVisitRow[] = [];
  try {
    const { data: visitsRaw } = await sb
      .from("report_visits").select("id, visitor_name, phone, notes").eq("report_id", reportId);
    visits = (visitsRaw ?? []).map(v => ({
      id: v.id, visitor_name: v.visitor_name, phone: v.phone, notes: v.notes,
    }));
  } catch { /* tabela pode não existir, ignora */ }

  return {
    report: report as MeetingReport,
    cell: (cell as Cell | null) ?? null,
    leader_name, reporter_name, attendance, visits,
  };
}
