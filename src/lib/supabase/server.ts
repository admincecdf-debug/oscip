import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para uso em Server Components, Server Actions e Route Handlers.
 * Lê a sessão do usuário a partir dos cookies (sincronizados pelo middleware.ts).
 * NÃO usar no browser — para isso, use lib/supabase/client.ts.
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Variaveis de ambiente do Supabase ausentes. Configure NEXT_PUBLIC_SUPABASE_URL e " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel e refaca o deploy."
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Chamado a partir de um Server Component (sem permissão de escrita em cookies).
          // Sem problema: o middleware.ts já cuida do refresh de sessão a cada request.
        }
      },
    },
  });
}
