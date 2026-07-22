import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RelmdaWeeklyReport, RelmdaWeeklyReportInput, RelmdaAttendance, RelmdaVisitor,
  RelmdaVisitorInput, RelmdaPastoralNeed, RelmdaPastoralNeedInput, RelmdaLgSnapshot,
  RelmdaReportFull, RelmdaStatusHistory, RelmdaSupervisorOverviewRow, RelmdaMonthlyComparisonRow,
  RelmdaDeadlineConfig,
} from "@/types/domain";

/** Retorna o id do rascunho da semana (cria se ainda não existir). */
export async function getOrCreateDraft(
  sb: SupabaseClient, lifeGroupId: string, weekNumber: number, month: number, year: number
): Promise<string> {
  const { data, error } = await sb.rpc("relmda_get_or_create_draft", {
    p_life_group_id: lifeGroupId, p_week_number: weekNumber, p_month: month, p_year: year,
  });
  if (error) throw error;
  return data as string;
}

export async function getLgSnapshot(sb: SupabaseClient, lifeGroupId: string): Promise<RelmdaLgSnapshot> {
  const { data, error } = await sb.rpc("relmda_lg_snapshot", { p_life_group_id: lifeGroupId }).single();
  if (error) throw error;
  return data as RelmdaLgSnapshot;
}

export async function getReportFull(sb: SupabaseClient, reportId: string): Promise<RelmdaReportFull> {
  const { data: report, error: e1 } = await sb
    .from("relmda_weekly_reports").select("*").eq("id", reportId).single();
  if (e1) throw e1;

  const [{ data: attendance, error: e2 }, { data: visitors, error: e3 }, { data: needs, error: e4 }] =
    await Promise.all([
      sb.from("relmda_attendance").select("*").eq("report_id", reportId),
      sb.from("relmda_visitors").select("*").eq("report_id", reportId).order("created_at"),
      sb.from("relmda_pastoral_needs").select("*").eq("report_id", reportId).order("created_at"),
    ]);
  if (e2) throw e2;
  if (e3) throw e3;
  if (e4) throw e4;

  const snapshot = await getLgSnapshot(sb, (report as RelmdaWeeklyReport).life_group_id);

  return {
    report: report as RelmdaWeeklyReport,
    attendance: (attendance ?? []) as RelmdaAttendance[],
    visitors: (visitors ?? []) as RelmdaVisitor[],
    needs: (needs ?? []) as RelmdaPastoralNeed[],
    snapshot,
  };
}

export async function updateReport(
  sb: SupabaseClient, reportId: string, patch: RelmdaWeeklyReportInput
): Promise<RelmdaWeeklyReport> {
  const { data, error } = await sb
    .from("relmda_weekly_reports").update(patch).eq("id", reportId).select().single();
  if (error) throw error;
  return data as RelmdaWeeklyReport;
}

/** Envia o relatório: rascunho -> enviado, ou correção_solicitada -> corrigido. */
export async function sendReport(sb: SupabaseClient, reportId: string): Promise<void> {
  const { error } = await sb.rpc("relmda_send_report", { p_report_id: reportId });
  if (error) throw error;
}

// ---------- Presença nominal ----------
export async function setAttendance(
  sb: SupabaseClient, reportId: string, memberId: string, present: boolean
): Promise<void> {
  const { error } = await sb.from("relmda_attendance")
    .upsert({ report_id: reportId, member_id: memberId, present }, { onConflict: "report_id,member_id" });
  if (error) throw error;
}

// ---------- Visitantes ----------
export async function addVisitor(sb: SupabaseClient, reportId: string, input: RelmdaVisitorInput): Promise<RelmdaVisitor> {
  const { data, error } = await sb.from("relmda_visitors")
    .insert({ report_id: reportId, ...input }).select().single();
  if (error) throw error;
  return data as RelmdaVisitor;
}

export async function removeVisitor(sb: SupabaseClient, visitorId: string): Promise<void> {
  const { error } = await sb.from("relmda_visitors").delete().eq("id", visitorId);
  if (error) throw error;
}

// ---------- Necessidades pastorais ----------
export async function addPastoralNeed(
  sb: SupabaseClient, reportId: string, input: RelmdaPastoralNeedInput
): Promise<RelmdaPastoralNeed> {
  const { data, error } = await sb.from("relmda_pastoral_needs")
    .insert({ report_id: reportId, ...input }).select().single();
  if (error) throw error;
  return data as RelmdaPastoralNeed;
}

// ---------- Histórico ----------
export async function getStatusHistory(sb: SupabaseClient, reportId: string): Promise<RelmdaStatusHistory[]> {
  const { data, error } = await sb.from("relmda_status_history")
    .select("*").eq("report_id", reportId).order("changed_at");
  if (error) throw error;
  return (data ?? []) as RelmdaStatusHistory[];
}

// ============================================================
// Supervisão (Fase 2)
// ============================================================
export async function getSupervisorOverview(
  sb: SupabaseClient, weekNumber: number, month: number, year: number
): Promise<RelmdaSupervisorOverviewRow[]> {
  const { data, error } = await sb.rpc("relmda_supervisor_overview", {
    p_week_number: weekNumber, p_month: month, p_year: year,
  });
  if (error) throw error;
  return (data ?? []) as RelmdaSupervisorOverviewRow[];
}

export async function markInAnalysis(sb: SupabaseClient, reportId: string): Promise<void> {
  const { error } = await sb.rpc("relmda_mark_in_analysis", { p_report_id: reportId });
  if (error) throw error;
}

export async function requestCorrection(
  sb: SupabaseClient, reportId: string, items: string[], note: string, deadline: string | null
): Promise<void> {
  const { error } = await sb.rpc("relmda_request_correction", {
    p_report_id: reportId, p_items: items, p_note: note, p_deadline: deadline,
  });
  if (error) throw error;
}

export async function validateReport(sb: SupabaseClient, reportId: string, note?: string): Promise<void> {
  const { error } = await sb.rpc("relmda_validate_report", { p_report_id: reportId, p_note: note ?? null });
  if (error) throw error;
}

export async function saveSupervisorNote(
  sb: SupabaseClient, reportId: string, note: string, needsSupport: boolean, supportType: string | null
): Promise<void> {
  const { error } = await sb.rpc("relmda_save_supervisor_note", {
    p_report_id: reportId, p_note: note, p_needs_support: needsSupport, p_support_type: supportType,
  });
  if (error) throw error;
}

// ============================================================
// Dashboard / Comparativo Mensal (Fase 4)
// ============================================================
export async function getMonthlyComparison(
  sb: SupabaseClient, month: number, year: number
): Promise<RelmdaMonthlyComparisonRow[]> {
  const { data, error } = await sb.rpc("relmda_monthly_comparison", { p_month: month, p_year: year });
  if (error) throw error;
  return (data ?? []) as RelmdaMonthlyComparisonRow[];
}

// ============================================================
// Prazos configuráveis (Fase 5)
// ============================================================
export async function getEffectiveDeadline(sb: SupabaseClient, churchId: string): Promise<RelmdaDeadlineConfig | null> {
  const { data, error } = await sb.rpc("relmda_effective_deadline", { p_church_id: churchId }).maybeSingle();
  if (error) { console.error("[relmda] getEffectiveDeadline", error); return null; }
  return data ? { church_id: churchId, ...data } as RelmdaDeadlineConfig : null;
}

export async function listDeadlineConfigs(sb: SupabaseClient): Promise<RelmdaDeadlineConfig[]> {
  const { data, error } = await sb.from("relmda_deadline_config").select("*").order("church_id", { nullsFirst: true });
  if (error) { console.error("[relmda] listDeadlineConfigs", error); return []; }
  return (data ?? []) as RelmdaDeadlineConfig[];
}

export async function saveDeadlineConfig(sb: SupabaseClient, config: RelmdaDeadlineConfig): Promise<void> {
  const { error } = await sb.from("relmda_deadline_config")
    .upsert(config, { onConflict: "church_id" });
  if (error) throw error;
}
