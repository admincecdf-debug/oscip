"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Property, Asset, PropertyDocument, AssetDocument, AssetPhoto, PatrimonySummary,
} from "@/types/domain";

const BUCKET = "patrimonio";

// ============================================================
// PROPERTIES
// ============================================================
export async function listProperties(sb: SupabaseClient, churchId?: string | null): Promise<Property[]> {
  let q = sb.from("properties").select("*").eq("is_active", true).order("name");
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[properties]", error); return []; }
  return (data ?? []) as Property[];
}

export async function createProperty(sb: SupabaseClient, input: Partial<Property>): Promise<Property> {
  const { data, error } = await sb.from("properties").insert(input).select().single();
  if (error) throw error;
  return data as Property;
}

export async function updateProperty(sb: SupabaseClient, id: string, patch: Partial<Property>): Promise<void> {
  const { error } = await sb.from("properties").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProperty(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("properties").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

// ============================================================
// ASSETS
// ============================================================
export async function listAssets(sb: SupabaseClient, opts?: { churchId?: string | null; propertyId?: string | null }): Promise<Asset[]> {
  let q = sb.from("assets").select("*").eq("is_active", true).order("name");
  if (opts?.churchId) q = q.eq("church_id", opts.churchId);
  if (opts?.propertyId) q = q.eq("property_id", opts.propertyId);
  const { data, error } = await q;
  if (error) { console.error("[assets]", error); return []; }
  return (data ?? []) as Asset[];
}

export async function createAsset(sb: SupabaseClient, input: Partial<Asset>): Promise<Asset> {
  const { data, error } = await sb.from("assets").insert(input).select().single();
  if (error) throw error;
  return data as Asset;
}

export async function updateAsset(sb: SupabaseClient, id: string, patch: Partial<Asset>): Promise<void> {
  const { error } = await sb.from("assets").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteAsset(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("assets").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

// ============================================================
// DOCUMENTS — property
// ============================================================
export async function listPropertyDocs(sb: SupabaseClient, propertyId: string): Promise<PropertyDocument[]> {
  const { data, error } = await sb.from("property_documents").select("*")
    .eq("property_id", propertyId).eq("is_current", true)
    .order("uploaded_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as PropertyDocument[];
}

export async function listPropertyDocHistory(sb: SupabaseClient, propertyId: string, docType: string): Promise<PropertyDocument[]> {
  const { data, error } = await sb.from("property_documents").select("*")
    .eq("property_id", propertyId).eq("doc_type", docType)
    .order("version", { ascending: false });
  if (error) return [];
  return (data ?? []) as PropertyDocument[];
}

export async function createPropertyDoc(sb: SupabaseClient, input: Partial<PropertyDocument>): Promise<PropertyDocument> {
  const { data, error } = await sb.from("property_documents").insert(input).select().single();
  if (error) throw error;
  return data as PropertyDocument;
}

/** Cria uma nova versão de um documento existente, marcando a anterior como superada */
export async function createPropertyDocVersion(
  sb: SupabaseClient,
  previousDocId: string,
  input: Partial<PropertyDocument>
): Promise<PropertyDocument> {
  const { data: prev, error: prevErr } = await sb.from("property_documents")
    .select("version").eq("id", previousDocId).single();
  if (prevErr) throw prevErr;

  const nextVersion = ((prev as { version: number })?.version ?? 1) + 1;

  const { data: created, error } = await sb.from("property_documents")
    .insert({ ...input, version: nextVersion, is_current: true })
    .select().single();
  if (error) throw error;

  await sb.from("property_documents")
    .update({ is_current: false, superseded_by: (created as { id: string }).id })
    .eq("id", previousDocId);

  return created as PropertyDocument;
}

export async function getExpiringPropertyDocs(sb: SupabaseClient, churchId?: string) {
  let query = sb.from("vw_property_docs_expiring").select("*");
  if (churchId) query = query.eq("church_id", churchId);
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function deletePropertyDoc(sb: SupabaseClient, id: string, storagePath: string | null): Promise<void> {
  if (storagePath) await deleteStorageFile(sb, storagePath).catch(() => null);
  const { error } = await sb.from("property_documents").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// DOCUMENTS — asset
// ============================================================
export async function listAssetDocs(sb: SupabaseClient, assetId: string): Promise<AssetDocument[]> {
  const { data, error } = await sb.from("asset_documents").select("*").eq("asset_id", assetId).order("uploaded_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as AssetDocument[];
}

export async function createAssetDoc(sb: SupabaseClient, input: Partial<AssetDocument>): Promise<AssetDocument> {
  const { data, error } = await sb.from("asset_documents").insert(input).select().single();
  if (error) throw error;
  return data as AssetDocument;
}

export async function deleteAssetDoc(sb: SupabaseClient, id: string, storagePath: string | null): Promise<void> {
  if (storagePath) await deleteStorageFile(sb, storagePath).catch(() => null);
  const { error } = await sb.from("asset_documents").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// PHOTOS — asset
// ============================================================
export async function listAssetPhotos(sb: SupabaseClient, assetId: string): Promise<AssetPhoto[]> {
  const { data, error } = await sb.from("asset_photos").select("*").eq("asset_id", assetId).order("photo_year", { ascending: true });
  if (error) return [];
  return (data ?? []) as AssetPhoto[];
}

export async function createAssetPhoto(sb: SupabaseClient, input: Partial<AssetPhoto>): Promise<AssetPhoto> {
  const { data, error } = await sb.from("asset_photos").insert(input).select().single();
  if (error) throw error;
  return data as AssetPhoto;
}

export async function deleteAssetPhoto(sb: SupabaseClient, id: string, storagePath: string): Promise<void> {
  await deleteStorageFile(sb, storagePath).catch(() => null);
  const { error } = await sb.from("asset_photos").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// STORAGE
// ============================================================
export async function uploadPatrimonyFile(
  sb: SupabaseClient,
  churchId: string,
  subpath: string,
  file: File
): Promise<{ path: string; size: number; mime: string }> {
  const ext = file.name.split(".").pop() ?? "bin";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${churchId}/${subpath}/${filename}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) throw error;
  return { path, size: file.size, mime: file.type };
}

export async function getSignedUrl(sb: SupabaseClient, path: string, expiresInSec = 3600): Promise<string | null> {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function deleteStorageFile(sb: SupabaseClient, path: string): Promise<void> {
  const { error } = await sb.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

// ============================================================
// SUMMARY
// ============================================================
export async function getPatrimonySummary(sb: SupabaseClient): Promise<PatrimonySummary[]> {
  const { data, error } = await sb.from("patrimony_summary").select("*");
  if (error) return [];
  return (data ?? []) as PatrimonySummary[];
}
