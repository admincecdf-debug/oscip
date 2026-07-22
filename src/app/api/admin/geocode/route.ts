import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

/**
 * POST /api/admin/geocode
 * Body: { query, access_token }
 * Busca lat/lng de um endereço/CEP. Usa cache no banco. Respeita ToS Nominatim:
 * - User-Agent identificável
 * - Rate limit 1 req/s (delay 1100ms entre buscas via batch)
 * - Cache obrigatório
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "CEC-FAMILY/1.0 (https://cecfamily.com.br)";

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}
function hashQuery(q: string): string {
  return createHash("sha256").update(normalizeQuery(q)).digest("hex").slice(0, 32);
}

interface NominatimResult {
  lat: string; lon: string; display_name?: string;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const query = String(body.query ?? "").trim();
  const access_token = String(body.access_token ?? "");
  if (!query) return NextResponse.json({ error: "query obrigatória" }, { status: 400 });
  if (!access_token) return NextResponse.json({ error: "Token ausente" }, { status: 401 });

  let admin;
  try { admin = adminClient(); }
  catch (e: unknown) { return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 }); }

  // Verifica autor (apóstolo/pastor)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const verifier = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${access_token}` } } });
  const { data: { user: caller } } = await verifier.auth.getUser();
  if (!caller) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", caller.id).maybeSingle();
  if (!callerProfile || !["apostolo", "pastor"].includes(callerProfile.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const hash = hashQuery(query);

  // 1) Busca em cache primeiro
  const { data: cached } = await admin.from("geocode_cache").select("*").eq("query_hash", hash).maybeSingle();
  if (cached) {
    return NextResponse.json({
      ok: true,
      cached: true,
      lat: cached.latitude,
      lng: cached.longitude,
      display_name: cached.display_name,
      found: cached.found,
    });
  }

  // 2) Busca no Nominatim
  let lat: number | null = null, lng: number | null = null, display: string | null = null, found = false;
  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      countrycodes: "br",
      limit: "1",
    });
    const r = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
    });
    if (r.ok) {
      const arr = (await r.json()) as NominatimResult[];
      if (Array.isArray(arr) && arr.length > 0) {
        lat = parseFloat(arr[0].lat);
        lng = parseFloat(arr[0].lon);
        display = arr[0].display_name ?? null;
        found = true;
      }
    }
  } catch (e: unknown) {
    // Mesmo se Nominatim falhou, vamos cachear como "não encontrado" pra não tentar de novo em loop
    console.error("Nominatim error:", e);
  }

  // 3) Grava cache (mesmo se não encontrou — evita retry infinito)
  await admin.from("geocode_cache").insert({
    query: normalizeQuery(query),
    query_hash: hash,
    latitude: lat,
    longitude: lng,
    display_name: display,
    found,
  });

  if (!found) return NextResponse.json({ ok: true, cached: false, found: false });
  return NextResponse.json({ ok: true, cached: false, lat, lng, display_name: display, found: true });
}
