"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetDepreciation, AssetDepreciationSummary,
  AssetMaintenance, MaintenanceUpcoming, MaintenanceHistory,
  AssetInventory, AssetLastInventory, InventoryCampaignSummary,
  PatrimonyAccounting, PatrimonyNationalSummary, PatrimonyAlert,
  DepreciationMethod, MaintenanceType, MaintenanceStatus, InventoryStatus,
} from "@/types/domain";

// ── BLOCO 2: Depreciação ─────────────────────────────────────

export async function getDepreciation(sb: SupabaseClient, assetId: string): Promise<AssetDepreciation | null> {
  const { data, error } = await sb.from("asset_depreciation").select("*").eq("asset_id", assetId).single();
  if (error) return null;
  return data as AssetDepreciation;
}

export async function upsertDepreciation(sb: SupabaseClient, payload: {
  asset_id: string; method: DepreciationMethod;
  useful_life_years: number; residual_value: number;
  start_date: string; notes?: string | null; id?: string;
}): Promise<AssetDepreciation> {
  const { data, error } = await sb
    .from("asset_depreciation")
    .upsert(payload, { onConflict: "asset_id" })
    .select().single();
  if (error) throw error;
  return data as AssetDepreciation;
}

export async function getDepreciationSummary(sb: SupabaseClient, churchId?: string): Promise<AssetDepreciationSummary[]> {
  let q = sb.from("asset_depreciation_summary").select("*").order("pct_depreciado", { ascending: false });
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[depreciation]", error); return []; }
  return (data ?? []) as AssetDepreciationSummary[];
}

// ── BLOCO 3: Manutenção ──────────────────────────────────────

export async function listMaintenanceByAsset(sb: SupabaseClient, assetId: string): Promise<AssetMaintenance[]> {
  const { data, error } = await sb
    .from("asset_maintenance").select("*")
    .eq("asset_id", assetId).order("scheduled_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as AssetMaintenance[];
}

export async function getMaintenanceUpcoming(sb: SupabaseClient, churchId?: string): Promise<MaintenanceUpcoming[]> {
  let q = sb.from("maintenance_upcoming").select("*");
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[maintenance_upcoming]", error); return []; }
  return (data ?? []) as MaintenanceUpcoming[];
}

export async function getMaintenanceHistory(sb: SupabaseClient, churchId?: string): Promise<MaintenanceHistory[]> {
  let q = sb.from("maintenance_history").select("*").limit(100);
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[maintenance_history]", error); return []; }
  return (data ?? []) as MaintenanceHistory[];
}

export async function createMaintenance(sb: SupabaseClient, payload: {
  asset_id: string; type: MaintenanceType; status: MaintenanceStatus;
  scheduled_at: string; description: string;
  next_maintenance?: string | null; cost?: number | null;
  provider_name?: string | null; provider_phone?: string | null;
  result?: string | null; responsible_id?: string | null;
}): Promise<AssetMaintenance> {
  const { data, error } = await sb.from("asset_maintenance").insert(payload).select().single();
  if (error) throw error;
  return data as AssetMaintenance;
}

export async function updateMaintenance(sb: SupabaseClient, id: string, payload: Partial<{
  status: MaintenanceStatus; completed_at: string; result: string;
  cost: number; next_maintenance: string; provider_name: string; provider_phone: string;
}>): Promise<void> {
  const { error } = await sb.from("asset_maintenance").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteMaintenance(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("asset_maintenance").delete().eq("id", id);
  if (error) throw error;
}

// ── BLOCO 4: Inventário ──────────────────────────────────────

export async function getCampaigns(sb: SupabaseClient, churchId?: string): Promise<InventoryCampaignSummary[]> {
  let q = sb.from("inventory_campaign_summary").select("*").order("inventory_date", { ascending: false });
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[campaigns]", error); return []; }
  return (data ?? []) as InventoryCampaignSummary[];
}

export async function getLastInventory(sb: SupabaseClient, churchId?: string): Promise<AssetLastInventory[]> {
  let q = sb.from("asset_last_inventory").select("*").order("asset_name");
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[last_inventory]", error); return []; }
  return (data ?? []) as AssetLastInventory[];
}

export async function registerInventoryItem(sb: SupabaseClient, payload: {
  campaign_name: string; church_id: string; inventory_date: string;
  asset_id: string; status: InventoryStatus;
  found_condition?: string | null; found_location?: string | null; notes?: string | null;
}): Promise<AssetInventory> {
  const { data, error } = await sb.from("asset_inventory").insert(payload).select().single();
  if (error) throw error;
  return data as AssetInventory;
}

// ── BLOCO 5: Dashboard Contábil ──────────────────────────────

export async function getPatrimonyAccounting(sb: SupabaseClient, churchId?: string): Promise<PatrimonyAccounting[]> {
  let q = sb.from("patrimony_accounting").select("*").order("valor_atual_total", { ascending: false });
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[patrimony_accounting]", error); return []; }
  return (data ?? []) as PatrimonyAccounting[];
}

export async function getPatrimonyNationalSummary(sb: SupabaseClient): Promise<PatrimonyNationalSummary | null> {
  const { data, error } = await sb.from("patrimony_national_summary").select("*").single();
  if (error) { console.error("[patrimony_national]", error); return null; }
  return data as PatrimonyNationalSummary;
}

export async function getPatrimonyAlerts(sb: SupabaseClient, churchId?: string): Promise<PatrimonyAlert[]> {
  let q = sb.from("patrimony_alerts").select("*");
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[patrimony_alerts]", error); return []; }
  return (data ?? []) as PatrimonyAlert[];
}
