import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/services/profiles";
import { WorkspaceShell } from "../WorkspaceShell";
import { PessoasTabs } from "./PessoasTabs";
import { requireWorkspaceAccess } from "../requireWorkspaceAccess";

export default async function PessoasPage() {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  await requireWorkspaceAccess(supabase, profile);

  return (
    <WorkspaceShell title="Pessoas" userName={profile?.full_name ?? undefined}>
      <div className="container py-8">
        <h1 className="font-display text-2xl text-navy mb-1">Gestão de Pessoas</h1>
        <p className="mb-6 text-sm text-muted">Membros, discipulado, acolhimento, CRM e pipeline de visitantes.</p>
        <PessoasTabs />
      </div>
    </WorkspaceShell>
  );
}
