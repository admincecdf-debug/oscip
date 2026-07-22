import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/services/profiles";
import { WorkspaceShell } from "../WorkspaceShell";
import { RecursosTabs } from "./RecursosTabs";
import { requireWorkspaceAccess } from "../requireWorkspaceAccess";

export default async function RecursosPage() {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  await requireWorkspaceAccess(supabase, profile);

  return (
    <WorkspaceShell title="Gestão de Recursos" userName={profile?.full_name ?? undefined}>
      <div className="container py-8">
        <h1 className="font-display text-2xl text-navy mb-1">Gestão de Recursos</h1>
        <p className="mb-6 text-sm text-muted">Financeiro, patrimônio e vínculos de pessoas (GPV).</p>
        <RecursosTabs />
      </div>
    </WorkspaceShell>
  );
}
