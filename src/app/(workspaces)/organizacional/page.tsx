import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/services/profiles";
import { WorkspaceShell } from "../WorkspaceShell";
import { OrganizacionalTabs } from "./OrganizacionalTabs";
import { requireWorkspaceAccess } from "../requireWorkspaceAccess";

export default async function OrganizacionalPage() {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  await requireWorkspaceAccess(supabase, profile);

  return (
    <WorkspaceShell title="Organizacional" userName={profile?.full_name ?? undefined}>
      <div className="container py-8">
        <h1 className="font-display text-2xl text-navy mb-1">Gestão Organizacional</h1>
        <p className="mb-6 text-sm text-muted">Comunidades, estrutura MDA, genealogia, ministérios e mapa de expansão.</p>
        <OrganizacionalTabs />
      </div>
    </WorkspaceShell>
  );
}
