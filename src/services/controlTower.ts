"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ControlTowerAlert, ControlTowerSummary, AlertType, AlertSeverity } from "@/types/domain";

export async function getControlTowerAlerts(
  sb: SupabaseClient,
  opts?: { severity?: AlertSeverity; alertType?: AlertType; churchId?: string }
): Promise<ControlTowerAlert[]> {
  let q = sb.from("control_tower_alerts").select("*");
  if (opts?.severity)   q = q.eq("severity", opts.severity);
  if (opts?.alertType)  q = q.eq("alert_type", opts.alertType);
  if (opts?.churchId)   q = q.eq("church_id", opts.churchId);
  const { data, error } = await q;
  if (error) { console.error("[control_tower]", error); return []; }
  return (data ?? []) as ControlTowerAlert[];
}

export async function getControlTowerSummary(sb: SupabaseClient): Promise<ControlTowerSummary | null> {
  const { data, error } = await sb.from("control_tower_summary").select("*").single();
  if (error) { console.error("[control_tower_summary]", error); return null; }
  return data as ControlTowerSummary;
}
