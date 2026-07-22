import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/admin/activate-member-access
 * Body: { member_id, email, access_token }
 * Cria auth.user + vincula profile_id ao member existente.
 */

const INITIAL_PASSWORD = "cec1234";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const member_id    = String(body.member_id ?? "");
  const email        = String(body.email ?? "").trim().toLowerCase();
  const access_token = String(body.access_token ?? "");

  if (!member_id) return NextResponse.json({ error: "member_id ausente" }, { status: 400 });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  if (!access_token) return NextResponse.json({ error: "Token ausente" }, { status: 401 });

  let admin;
  try { admin = adminClient(); }
  catch (e: unknown) { return NextResponse.json({ error: e instanceof Error ? e.message : "Configuração inválida" }, { status: 500 }); }

  // Verifica autor
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const verifier = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${access_token}` } } });
  const { data: { user: caller } } = await verifier.auth.getUser();
  if (!caller) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", caller.id).maybeSingle();
  if (!callerProfile || !["apostolo", "pastor"].includes(callerProfile.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Busca o membro
  const { data: member } = await admin.from("members").select("*").eq("id", member_id).maybeSingle();
  if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
  if (member.profile_id) return NextResponse.json({ error: "Este membro já possui acesso" }, { status: 400 });

  // Cria auth.user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: INITIAL_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: member.full_name },
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Erro";
    return NextResponse.json({
      error: msg.toLowerCase().includes("already") ? "E-mail já cadastrado" : msg,
    }, { status: 400 });
  }

  // Atualiza profile e member
  await admin.from("profiles").update({ full_name: member.full_name, phone: member.phone, role: "membro" }).eq("id", created.user.id);
  await admin.from("members").update({ profile_id: created.user.id, email }).eq("id", member_id);

  return NextResponse.json({ ok: true, initial_password: INITIAL_PASSWORD });
}
