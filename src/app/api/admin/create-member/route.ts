import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/admin/create-member
 * Body: { email, full_name, phone?, birth_date?, church_id?, life_group_id?, role?, access_token }
 * - Verifica se quem chama é admin (apostolo/pastor) usando o access_token enviado
 * - Cria auth.user com senha 'cec1234'
 * - Atualiza profile com nome, telefone, role (trigger já criou o profile)
 * - Cria entrada em members com church_id definido (obrigatório pra RLS funcionar depois)
 */

const INITIAL_PASSWORD = "cec1234";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const email        = String(body.email ?? "").trim().toLowerCase();
  const full_name    = String(body.full_name ?? "").trim();
  const phone        = String(body.phone ?? "").trim() || null;
  const birth_date   = body.birth_date ? String(body.birth_date) : null;
  const church_id_in = body.church_id ? String(body.church_id) : null;
  const life_group_id = body.life_group_id ? String(body.life_group_id) : null;
  const role         = String(body.role ?? "membro");
  const access_token = String(body.access_token ?? "");

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  if (full_name.length < 3) return NextResponse.json({ error: "Nome muito curto" }, { status: 400 });
  if (!access_token)        return NextResponse.json({ error: "Token de autenticação ausente" }, { status: 401 });
  if (!church_id_in && !life_group_id) return NextResponse.json({ error: "Selecione ao menos a Igreja ou o Life Group" }, { status: 400 });

  let admin;
  try {
    admin = adminClient();
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Configuração inválida" }, { status: 500 });
  }

  // 1) Verifica autor da requisição: precisa ser apóstolo/pastor
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const verifier = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${access_token}` } } });
  const { data: { user: caller } } = await verifier.auth.getUser();
  if (!caller) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", caller.id).maybeSingle();
  if (!callerProfile || !["apostolo", "pastor"].includes(callerProfile.role)) {
    return NextResponse.json({ error: "Sem permissão para criar membros" }, { status: 403 });
  }

  // 2) Cria o auth.user (já confirmado, sem precisar de e-mail)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: INITIAL_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Erro ao criar usuário";
    const friendly = msg.toLowerCase().includes("already")
      ? "Este e-mail já está cadastrado no sistema."
      : msg;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
  const newUserId = created.user.id;

  // 3) Atualiza o profile (criado pelo trigger on_auth_user_created)
  await admin.from("profiles").update({
    full_name,
    phone,
    role,
  }).eq("id", newUserId);

  // 4) Resolve church_id: usa o enviado, ou deduz a partir do Life Group
  let church_id = church_id_in;
  if (!church_id && life_group_id) {
    const { data: lg } = await admin.from("life_groups").select("church_id").eq("id", life_group_id).maybeSingle();
    church_id = lg?.church_id ?? null;
  }
  if (!church_id) {
    // Sem escopo territorial não há como o membro aparecer depois (RLS). Aborta antes de criar o auth.user.
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: "Não foi possível determinar a Igreja do membro. Selecione a Igreja manualmente." }, { status: 400 });
  }

  // 5) Cria entrada em members
  const { data: member, error: memberErr } = await admin.from("members").insert({
    profile_id: newUserId,
    full_name,
    email,
    phone,
    birth_date,
    church_id,
    life_group_id,
    status: "ativo",
  }).select().single();

  if (memberErr) {
    // rollback: apaga o auth.user que acabamos de criar
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: memberErr.message ?? "Erro ao criar membro" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    member,
    initial_password: INITIAL_PASSWORD,
  });
}
