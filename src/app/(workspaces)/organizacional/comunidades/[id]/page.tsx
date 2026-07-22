import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/services/profiles";
import type { Church } from "@/types/domain";
import { WorkspaceShell } from "../../../WorkspaceShell";
import { ComunidadePanelTabs } from "./ComunidadePanelTabs";
import { requireWorkspaceAccess } from "../../../requireWorkspaceAccess";

export default async function ComunidadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  await requireWorkspaceAccess(supabase, profile);

  const { data: church } = await supabase
    .from("churches")
    .select("*")
    .eq("id", id)
    .single<Church>();

  if (!church) notFound();

  return (
    <WorkspaceShell title={`Comunidade · ${church.name}`} userName={profile?.full_name ?? undefined}>
      <div className="container py-8">
        <div className="mb-6 flex items-center gap-4">
          {church.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={church.logo_url} alt={church.name} className="h-14 w-14 rounded-lg border object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border bg-navy-50 font-display text-xl text-navy">
              {church.name.slice(0, 1)}
            </div>
          )}
          <div>
            <h1 className="font-display text-2xl text-navy">{church.name}</h1>
            <p className="text-sm text-muted">
              {[church.type, church.city, church.state].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        </div>
        <ComunidadePanelTabs churchId={church.id} />
      </div>
    </WorkspaceShell>
  );
}
