import type { SupabaseClient } from "@supabase/supabase-js";
import type { MonthlyReport, MonthlyReportWeek, MonthlyReportMember, MonthlyReportMemberWeek } from "@/types/domain";

export interface MonthlyReportFull {
  report: MonthlyReport;
  weeks: MonthlyReportWeek[];
  members: (MonthlyReportMember & { weeks: MonthlyReportMemberWeek[] })[];
}

/** Pre-preenche/cria o relatorio mensal a partir dos semanais. Idempotente. */
export async function prefillMonthlyReport(sb: SupabaseClient, cellId: string, year: number, month: number): Promise<string> {
  const { data, error } = await sb.rpc("monthly_report_prefill", {
    p_life_group_id: cellId, p_year: year, p_month: month,
  });
  if (error) throw error;
  return data as string;
}

export async function listMonthlyReports(sb: SupabaseClient, cellId: string | null): Promise<MonthlyReport[]> {
  if (!cellId) return [];
  const { data, error } = await sb.from("monthly_reports").select("*")
    .eq("life_group_id", cellId).order("year", { ascending: false }).order("month", { ascending: false });
  if (error) return [];
  return (data ?? []) as MonthlyReport[];
}

export async function getMonthlyReportFull(sb: SupabaseClient, reportId: string): Promise<MonthlyReportFull | null> {
  const [r, w, m, mw] = await Promise.all([
    sb.from("monthly_reports").select("*").eq("id", reportId).maybeSingle(),
    sb.from("monthly_report_weeks").select("*").eq("report_id", reportId).order("week_number"),
    sb.from("monthly_report_members").select("*").eq("report_id", reportId),
    sb.from("monthly_report_member_weeks").select("*"),
  ]);
  if (r.error || !r.data) return null;
  const memberIds = new Set((m.data ?? []).map((x) => x.id));
  const memberWeeks = (mw.data ?? []).filter((x) => memberIds.has(x.monthly_report_member_id)) as MonthlyReportMemberWeek[];
  const members = ((m.data ?? []) as MonthlyReportMember[]).map((memb) => ({
    ...memb,
    weeks: memberWeeks.filter((x) => x.monthly_report_member_id === memb.id).sort((a, b) => a.week_number - b.week_number),
  }));
  return {
    report: r.data as MonthlyReport,
    weeks: ((w.data ?? []) as MonthlyReportWeek[]),
    members,
  };
}

export async function updateWeekTotals(sb: SupabaseClient, id: string, patch: Partial<MonthlyReportWeek>) {
  const { error } = await sb.from("monthly_report_weeks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function updateMemberWeek(sb: SupabaseClient, id: string, patch: Partial<MonthlyReportMemberWeek>) {
  const { error } = await sb.from("monthly_report_member_weeks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setMonthlyNucleo(sb: SupabaseClient, id: string, nucleo: string | null) {
  const { error } = await sb.from("monthly_reports").update({ nucleo }).eq("id", id);
  if (error) throw error;
}

export async function closeMonthlyReport(sb: SupabaseClient, id: string) {
  const { error } = await sb.from("monthly_reports").update({ closed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
