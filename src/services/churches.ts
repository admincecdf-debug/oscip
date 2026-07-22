import type { SupabaseClient } from "@supabase/supabase-js";
import type { Church, State, Nucleo, District, Area, Sector, Cell, MdaMinAlert } from "@/types/domain";

export async function listChurchAncestry(sb: SupabaseClient): Promise<{ church_id: string; state_id: string | null; nucleo_id: string | null; district_id: string | null; sector_id: string | null }[]> {
  const { data, error } = await sb.from("church_ancestry").select("*");
  if (error) { console.error("[churches] listChurchAncestry", error); return []; }
  return data ?? [];
}

/** Nome do Estado resolvido pela árvore territorial real (Estado→Núcleo→Distrito→Setor→Igreja), respeitando níveis pulados. */
export async function getChurchStateName(sb: SupabaseClient, churchId: string): Promise<string | null> {
  const { data, error } = await sb.rpc("church_state_name", { p_church_id: churchId });
  if (error) { console.error("[churches] getChurchStateName", error); return null; }
  return data ?? null;
}

export async function listStates(sb: SupabaseClient): Promise<State[]> {
  const { data, error } = await sb.from("states").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as State[];
}
export async function listNucleos(sb: SupabaseClient): Promise<Nucleo[]> {
  const { data, error } = await sb.from("nucleos").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Nucleo[];
}
export async function listChurches(sb: SupabaseClient): Promise<Church[]> {
  const { data, error } = await sb.from("churches").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Church[];
}
export async function listDistricts(sb: SupabaseClient): Promise<District[]> {
  const { data, error } = await sb.from("districts").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as District[];
}
export async function listAreas(sb: SupabaseClient): Promise<Area[]> {
  const { data, error } = await sb.from("areas").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Area[];
}
export async function listSectors(sb: SupabaseClient): Promise<Sector[]> {
  const { data, error } = await sb.from("sectors").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Sector[];
}
export async function listCells(sb: SupabaseClient): Promise<Cell[]> {
  const { data, error } = await sb.from("life_groups").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Cell[];
}
export async function listMdaAlerts(sb: SupabaseClient): Promise<MdaMinAlert[]> {
  const { data, error } = await sb.from("mda_min_alerts").select("*");
  if (error) return [];
  return (data ?? []) as MdaMinAlert[];
}

// ── CRUD: Distrito ────────────────────────────────────────────
export async function createDistrict(sb: SupabaseClient, input: Partial<District>): Promise<District> {
  const { data, error } = await sb.from("districts").insert(input).select().single();
  if (error) throw error;
  return data as District;
}
export async function updateDistrict(sb: SupabaseClient, id: string, input: Partial<District>): Promise<void> {
  const { error } = await sb.from("districts").update(input).eq("id", id);
  if (error) throw error;
}
export async function deleteDistrict(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("districts").delete().eq("id", id);
  if (error) throw error;
}

// ── CRUD: Área ─────────────────────────────────────────────────
export async function createArea(sb: SupabaseClient, input: Partial<Area>): Promise<Area> {
  const { data, error } = await sb.from("areas").insert(input).select().single();
  if (error) throw error;
  return data as Area;
}
export async function updateArea(sb: SupabaseClient, id: string, input: Partial<Area>): Promise<void> {
  const { error } = await sb.from("areas").update(input).eq("id", id);
  if (error) throw error;
}
export async function deleteArea(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("areas").delete().eq("id", id);
  if (error) throw error;
}

// ── CRUD: Setor ────────────────────────────────────────────────
export async function createSector(sb: SupabaseClient, input: Partial<Sector>): Promise<Sector> {
  const { data, error } = await sb.from("sectors").insert(input).select().single();
  if (error) throw error;
  return data as Sector;
}
export async function updateSector(sb: SupabaseClient, id: string, input: Partial<Sector>): Promise<void> {
  const { error } = await sb.from("sectors").update(input).eq("id", id);
  if (error) throw error;
}
export async function deleteSector(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("sectors").delete().eq("id", id);
  if (error) throw error;
}

// ── CRUD: Estado ───────────────────────────────────────────────
export async function createState(sb: SupabaseClient, input: Partial<State>): Promise<State> {
  const { data, error } = await sb.from("states").insert(input).select().single();
  if (error) throw error;
  return data as State;
}
export async function updateState(sb: SupabaseClient, id: string, input: Partial<State>): Promise<void> {
  const { error } = await sb.from("states").update(input).eq("id", id);
  if (error) throw error;
}
export async function deleteState(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("states").delete().eq("id", id);
  if (error) throw error;
}

// ── CRUD: Núcleo ───────────────────────────────────────────────
export async function createNucleo(sb: SupabaseClient, input: Partial<Nucleo>): Promise<Nucleo> {
  const { data, error } = await sb.from("nucleos").insert(input).select().single();
  if (error) throw error;
  return data as Nucleo;
}
export async function updateNucleo(sb: SupabaseClient, id: string, input: Partial<Nucleo>): Promise<void> {
  const { error } = await sb.from("nucleos").update(input).eq("id", id);
  if (error) throw error;
}
export async function deleteNucleo(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("nucleos").delete().eq("id", id);
  if (error) throw error;
}
