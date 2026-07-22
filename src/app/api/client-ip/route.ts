import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/client-ip
 * Devolve o IP público de quem chamou, lido dos cabeçalhos que o
 * Vercel já preenche (x-forwarded-for / x-real-ip). O navegador não
 * tem como descobrir isso sozinho — por isso essa rota existe.
 * Usada pelo logAudit() pra preencher a coluna `ip` da auditoria.
 */
export async function GET(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
  return NextResponse.json({ ip });
}
