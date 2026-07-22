"use client";
import { createCecClient, type CecClient } from "@/lib/cec";

// Criacao "preguicosa": cliente so instanciado no browser (evita erro no build da Vercel).
let _client: CecClient | null = null;

function getClient(): CecClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env ausente.");
  _client = createCecClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return _client;
}

export const supabase: CecClient = new Proxy({} as CecClient, {
  get(_t, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});
