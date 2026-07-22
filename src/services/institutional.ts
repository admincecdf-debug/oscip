// Conteudo institucional vindo do Supabase (cultos e palavra do dia).
// Fallback inteligente: se a tabela ainda nao existir (migration nao aplicada)
// ou se vier vazia, mostra placeholders sensatos para o caso CEC Manaus.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChurchInfo, ServiceTime, DailyWord, Church } from "@/types/domain";

/** Cultos de uma igreja. Retorna [] se a tabela nao existe ou nada cadastrado. */
export async function listServiceTimes(sb: SupabaseClient, churchId: string | null): Promise<ChurchInfo[]> {
  if (!churchId) return [];
  try {
    const { data, error } = await sb
      .from("church_info")
      .select("*")
      .eq("church_id", churchId)
      .eq("is_active", true)
      .order("sort_order");
    if (error) return [];
    return (data ?? []) as ChurchInfo[];
  } catch { return []; }
}

/** Lista TODOS os cultos (admin), independente de igreja. */
export async function listAllServiceTimes(sb: SupabaseClient): Promise<ChurchInfo[]> {
  try {
    const { data, error } = await sb.from("church_info").select("*").order("sort_order");
    if (error) return [];
    return (data ?? []) as ChurchInfo[];
  } catch { return []; }
}

/** Palavra do dia (mais recente ate hoje) — escopada por comunidade (ou global). */
export async function getTodaysWord(sb: SupabaseClient, churchId?: string | null): Promise<DailyWord | null> {
  try {
    let q = sb.from("daily_words").select("*")
      .eq("is_active", true)
      .lte("date", new Date().toISOString().slice(0, 10))
      .order("date", { ascending: false })
      .limit(1);
    if (churchId) q = q.or(`church_id.eq.${churchId},church_id.is.null`);
    const { data, error } = await q.maybeSingle();
    if (error || !data) return null;
    return data as DailyWord;
  } catch { return null; }
}

/** Lista palavras (admin). */
export async function listDailyWords(sb: SupabaseClient, limit = 30): Promise<DailyWord[]> {
  try {
    const { data, error } = await sb.from("daily_words").select("*").order("date", { ascending: false }).limit(limit);
    if (error) return [];
    return (data ?? []) as DailyWord[];
  } catch { return []; }
}

// ---------- FALLBACKS ----------

/** Cultos default da CEC Manaus (conforme caderno tecnico). */
export function defaultServiceTimes(church: Church | null): ServiceTime[] {
  if (!church || church.name === "CEC Manaus - Sede") {
    const cid = church?.id ?? "";
    return [
      { id:"d1", church_id:cid, weekday:"domingo", time:"08:00", description:"Culto da manhã",  is_active:true, sort_order:1 },
      { id:"d2", church_id:cid, weekday:"domingo", time:"16:00", description:"Culto da tarde",  is_active:true, sort_order:2 },
      { id:"d3", church_id:cid, weekday:"domingo", time:"18:00", description:"Culto da noite",  is_active:true, sort_order:3 },
      { id:"d4", church_id:cid, weekday:"quarta",  time:"19:30", description:"Culto de oração e ensino", is_active:true, sort_order:4 },
    ];
  }
  return [];
}

export function defaultWord(): DailyWord {
  return {
    id: "default",
    date: new Date().toISOString().slice(0,10),
    title: "Palavra do dia",
    verse_ref: "Salmos 23:1",
    verse_text: "O Senhor é o meu pastor; nada me faltará.",
    reflection: "Permita que Ele guie seu dia.",
    prayer: "Senhor, conduze meus passos hoje. Que eu reconheça Tua voz e siga Teu caminho. Amém.",
    is_active: true,
  };
}
