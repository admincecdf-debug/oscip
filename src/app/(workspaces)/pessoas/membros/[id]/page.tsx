import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/services/profiles";
import type { Member } from "@/types/domain";
import { WorkspaceShell } from "../../../WorkspaceShell";
import { MembroPanelTabs } from "./MembroPanelTabs";
import { requireWorkspaceAccess } from "../../../requireWorkspaceAccess";

const STAGE_LABELS: Record<string, string> = {
  visitante: "Visitante", novo_convertido: "Novo convertido", consolidacao: "Consolidação",
  discipulado: "Discipulado", batismo: "Batismo", membro_ativo: "Membro ativo",
  servo: "Servo", lider_formacao: "Líder em formação", lider: "Líder",
  supervisor: "Supervisor", missionario: "Missionário",
};

function tempoDeCaminhada(joinedAt: string | null): string {
  if (!joinedAt) return "";
  const anos = (Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (anos < 1) return `${Math.max(1, Math.round(anos * 12))} meses de caminhada`;
  return `${Math.floor(anos)} ano(s) de caminhada`;
}

export default async function MembroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);
  await requireWorkspaceAccess(supabase, profile);

  const { data: member } = await supabase
    .from("members")
    .select("*, churches(name)")
    .eq("id", id)
    .single<Member & { churches: { name: string } | null }>();

  if (!member) notFound();

  return (
    <WorkspaceShell title={`Membro · ${member.full_name}`} userName={profile?.full_name ?? undefined}>
      <div className="container py-8">
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
          {member.photo_url ? (
            <img src={member.photo_url} alt={member.full_name} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-navy-50 font-display text-2xl text-navy">
              {member.full_name.slice(0, 1)}
            </div>
          )}
          <div className="flex-1">
            <h1 className="font-display text-2xl text-navy">{member.full_name}</h1>
            <p className="text-sm text-muted">
              {STAGE_LABELS[member.journey_stage] ?? member.journey_stage}
              {member.cec_id ? ` · CEC ID ${member.cec_id}` : ""}
              {member.churches?.name ? ` · ${member.churches.name}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {member.phone ?? ""}{member.phone && member.email ? " · " : ""}{member.email ?? ""}
              {member.joined_at ? ` · Desde ${new Date(member.joined_at).toLocaleDateString("pt-BR")} · ${tempoDeCaminhada(member.joined_at)}` : ""}
            </p>
          </div>
        </div>
        <MembroPanelTabs memberId={member.id} member={member} />
      </div>
    </WorkspaceShell>
  );
}
