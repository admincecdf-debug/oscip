import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cell } from "@/types/domain";

export async function createCell(sb: SupabaseClient, input: Partial<Cell>): Promise<Cell> {
  // Vamos buscar a church_id do setor para inferir
  if (input.sector_id) {
    try {
      const { data: sector } = await sb.from("sectors").select("area_id").eq("id", input.sector_id).single();
      if (sector) {
        const { data: area } = await sb.from("areas").select("district_id").eq("id", sector.area_id).single();
        if (area) {
          const { data: district } = await sb.from("districts").select("church_id").eq("id", area.district_id).single();
          if (district) input.church_id = district.church_id;
        }
      }
    } catch { /* segue sem inferir */ }
  }
  const { data, error } = await sb.from("life_groups").insert(input).select().single();
  if (error) throw error;
  return data as Cell;
}

export async function updateCell(sb: SupabaseClient, id: string, input: Partial<Cell>): Promise<void> {
  const { error } = await sb.from("life_groups").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteCell(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("life_groups").delete().eq("id", id);
  if (error) throw error;
}
