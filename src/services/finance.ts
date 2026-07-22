import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Finance, FinanceKind, FinanceDirection,
  FinanceMonthlyFlow, FinanceByCategory,
  FinanceNationalMonthly, FinanceBudget, FinanceBudgetVsActual
} from "@/types/domain";

export interface FinanceInput {
  church_id: string; kind: FinanceKind; direction: FinanceDirection;
  amount: number; description?: string; occurred_on: string; payer_name?: string;
}

export async function listFinances(sb: SupabaseClient, churchId: string | null, year: number, month: number): Promise<Finance[]> {
  if (!churchId) return [];
  const start = `${year}-${String(month).padStart(2,"0")}-01`;
  const next = month === 12 ? `${year+1}-01-01` : `${year}-${String(month+1).padStart(2,"0")}-01`;
  const { data, error } = await sb.from("finances").select("*")
    .eq("church_id", churchId)
    .gte("occurred_on", start).lt("occurred_on", next)
    .order("occurred_on", { ascending: false });
  if (error) return [];
  return (data ?? []) as Finance[];
}

export async function createFinance(sb: SupabaseClient, input: FinanceInput): Promise<Finance> {
  const { data, error } = await sb.from("finances").insert({
    ...input,
    description: input.description || null,
    payer_name: input.payer_name || null,
  }).select().single();
  if (error) throw error;
  return data as Finance;
}

export async function deleteFinance(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("finances").delete().eq("id", id);
  if (error) throw error;
}

export async function updateFinance(
  sb: SupabaseClient,
  id: string,
  input: Partial<FinanceInput>
): Promise<Finance> {
  const { data, error } = await sb.from("finances").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Finance;
}

export async function getMonthlyFlow(
  sb: SupabaseClient, churchId: string
): Promise<FinanceMonthlyFlow[]> {
  const { data, error } = await sb
    .from("finance_monthly_flow")
    .select("*")
    .eq("church_id", churchId)
    .order("mes");
  if (error) { console.error("[finance_flow]", error); return []; }
  return (data ?? []) as FinanceMonthlyFlow[];
}

export async function getCategoryBreakdown(
  sb: SupabaseClient,
  churchId: string,
  year: number,
  month?: number
): Promise<FinanceByCategory[]> {
  let q = sb.from("finance_by_category").select("*")
    .eq("church_id", churchId).eq("ano", year);
  if (month) q = q.eq("mes", month);
  const { data, error } = await q.order("total", { ascending: false });
  if (error) { console.error("[finance_category]", error); return []; }
  return (data ?? []) as FinanceByCategory[];
}

export async function getNationalMonthly(): Promise<FinanceNationalMonthly[]> {
  const { supabase: sb } = await import("@/lib/supabase/client");
  const { data, error } = await sb.from("finance_national_monthly").select("*").order("mes");
  if (error) { console.error("[finance_national]", error); return []; }
  return (data ?? []) as FinanceNationalMonthly[];
}

export async function getBudgets(
  sb: SupabaseClient, churchId: string, year: number
): Promise<FinanceBudgetVsActual[]> {
  const { data, error } = await sb
    .from("finance_budget_vs_actual")
    .select("*")
    .eq("church_id", churchId)
    .eq("year", year)
    .order("direction").order("kind");
  if (error) { console.error("[finance_budget]", error); return []; }
  return (data ?? []) as FinanceBudgetVsActual[];
}

export async function upsertBudget(
  sb: SupabaseClient,
  payload: { church_id: string; year: number; kind: string; direction: string; amount: number; notes?: string; id?: string }
): Promise<FinanceBudget> {
  const { data, error } = await sb
    .from("finance_budgets")
    .upsert(payload, { onConflict: "church_id,year,kind" })
    .select().single();
  if (error) throw error;
  return data as FinanceBudget;
}

export async function deleteBudget(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("finance_budgets").delete().eq("id", id);
  if (error) throw error;
}
