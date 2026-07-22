import { createClient } from "@/lib/supabase/server";
import { InviteRegisterForm } from "@/components/public/InviteRegisterForm";

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("validate_invite_token", { p_token: token });
  const validation = data?.[0] ?? { valid: false, reason: "nao_encontrado" };

  return <InviteRegisterForm token={token} validation={validation} />;
}
