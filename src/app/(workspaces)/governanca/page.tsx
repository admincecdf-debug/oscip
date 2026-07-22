import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/services/profiles";
import { WorkspaceShell } from "../WorkspaceShell";
import { GovernanceTabs } from "./GovernanceTabs";
import { requireWorkspaceAccess } from "../requireWorkspaceAccess";

export default async function GovernancaPage() {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  await requireWorkspaceAccess(supabase, profile);

  return (
    <WorkspaceShell title="Governança" userName={profile?.full_name ?? undefined}>
      <div className="container py-8">
        <h1 className="font-display text-2xl text-navy mb-1">Governança</h1>
        <p className="mb-6 text-sm text-muted">Delegações de autoridade e trilha de auditoria do sistema.</p>
        <GovernanceTabs />
      </div>
    </WorkspaceShell>
  );
}
