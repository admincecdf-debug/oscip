import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/services/profiles";

/**
 * Guarda de acesso feita no servidor (Server Component), sem spinner de
 * carregamento de sessão no browser. Redireciona:
 * - para /entrar se não houver sessão válida;
 * - para /painel se o usuário estiver logado mas não for apóstolo/pastor
 *   (mesma regra de acesso do AdminPanel.tsx legado).
 */
export default async function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const profile = await getMyProfile(supabase);
  const isAdmin = !!profile && ["apostolo", "pastor"].includes(profile.role);

  if (!isAdmin) redirect("/painel");

  return <>{children}</>;
}
