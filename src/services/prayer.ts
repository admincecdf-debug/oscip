import type { SupabaseClient } from "@supabase/supabase-js";
import type { PrayerRequest } from "@/types/domain";

/** Pedidos da minha celula (visiveis pela RLS). */
export async function listCellPrayers(sb: SupabaseClient, cellId: string | null): Promise<PrayerRequest[]> {
  if (!cellId) return [];
  try {
    const { data, error } = await sb.from("prayer_requests")
      .select("*").eq("life_group_id", cellId).order("created_at", { ascending: false }).limit(50);
    if (error) return [];
    return (data ?? []) as PrayerRequest[];
  } catch { return []; }
}

/** Cadastra um novo pedido de oracao. */
export async function addPrayer(sb: SupabaseClient, request: string, memberId: string | null, cellId: string | null) {
  const { error } = await sb.from("prayer_requests").insert({
    request, member_id: memberId, life_group_id: cellId,
  });
  if (error) throw error;
}

/** Marca como respondido. */
export async function markPrayerAnswered(sb: SupabaseClient, id: string, answered: boolean) {
  const { error } = await sb.from("prayer_requests").update({ is_answered: answered }).eq("id", id);
  if (error) throw error;
}
