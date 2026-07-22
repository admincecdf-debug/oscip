import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/services/profiles";
import { WorkspaceShell } from "../WorkspaceShell";
import { ExecutivoTabs } from "./ExecutivoTabs";
import { requireWorkspaceAccess } from "../requireWorkspaceAccess";

export default async function ExecutivoPage() {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  await requireWorkspaceAccess(supabase, profile);

  return (
    <WorkspaceShell title="Centro Executivo" userName={profile?.full_name ?? undefined}>
      <div className="container py-8">
        <h1 className="font-display text-2xl text-navy mb-1">Centro Executivo</h1>
        <p className="mb-6 text-sm text-muted">Visão consolidada, supervisão, alertas estratégicos e relatórios ministeriais.</p>
        <ExecutivoTabs />
      </div>
    </WorkspaceShell>
  );
}
