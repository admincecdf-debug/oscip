import type { SupabaseClient } from "@supabase/supabase-js";

/** "Momento da Generosidade" — dados de contribuição (Pix/QR Code) de uma igreja. */
export interface ChurchGivingInfo {
  id?: string;
  church_id: string;
  qr_code_url?: string | null;
  pix_key?: string | null;
  razao_social?: string | null;
  cnpj?: string | null;
  banco?: string | null;
  updated_at?: string;
}

/** Busca os dados de contribuição de uma igreja (usado pela aba pública "Dízimos e Ofertas"). */
export async function getChurchGivingInfo(sb: SupabaseClient, churchId: string): Promise<ChurchGivingInfo | null> {
  const { data, error } = await sb
    .from("church_giving_info")
    .select("*")
    .eq("church_id", churchId)
    .maybeSingle();
  if (error) return null;
  return (data as ChurchGivingInfo) ?? null;
}

/** Cria ou atualiza os dados de contribuição da igreja (upsert por church_id). */
export async function upsertChurchGivingInfo(
  sb: SupabaseClient,
  payload: Partial<ChurchGivingInfo> & { church_id: string }
): Promise<ChurchGivingInfo> {
  const { data, error } = await sb
    .from("church_giving_info")
    .upsert(payload, { onConflict: "church_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as ChurchGivingInfo;
}

/** Faz upload da imagem do QR Code Pix pro bucket de storage e retorna a URL pública. */
export async function uploadGivingQrCode(sb: SupabaseClient, churchId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${churchId}/qrcode.${ext}`;
  const { error: upErr } = await sb.storage.from("giving-qrcodes").upload(path, file, {
    contentType: file.type, upsert: true,
  });
  if (upErr) throw upErr;
  const { data } = sb.storage.from("giving-qrcodes").getPublicUrl(path);
  return data.publicUrl;
}
