"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMemberScoreById } from "@/hooks/use-queries";
import { TrendingUp, Users, BookOpen, CalendarCheck, Mic2 } from "lucide-react";

const BAND_LABELS: Record<string, { label: string; cls: string }> = {
  engajado: { label: "Engajado", cls: "bg-green-50 text-green-700 border-green-200" },
  ativo:    { label: "Ativo", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  em_risco: { label: "Em risco", cls: "bg-red-50 text-red-700 border-red-200" },
};

const STAGE_LABELS: Record<string, string> = {
  visitante: "Visitante", novo_convertido: "Novo convertido", consolidacao: "Consolidação",
  discipulado: "Discipulado", batismo: "Batismo", membro_ativo: "Membro ativo",
  servo: "Servo", lider_formacao: "Líder em formação", lider: "Líder",
  supervisor: "Supervisor", missionario: "Missionário",
};

export function VisaoGeralMembro({ memberId }: { memberId: string }) {
  const { data: score, isLoading } = useMemberScoreById(memberId);

  if (isLoading) return <p className="py-8 text-center text-sm italic text-muted">Carregando visão geral…</p>;
  if (!score) return <p className="py-8 text-center text-sm italic text-muted">Sem dados de score para este membro ainda.</p>;

  const band = BAND_LABELS[score.engagement_band] ?? { label: score.engagement_band, cls: "bg-gray-100 text-gray-600 border-gray-300" };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>Score de engajamento</CardTitle>
              <CardDescription>Etapa atual: {STAGE_LABELS[score.journey_stage] ?? score.journey_stage}</CardDescription>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${band.cls}`}>{band.label}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-end gap-2">
            <p className="font-display text-4xl text-navy">{score.score_total}</p>
            <p className="mb-1 text-xs text-muted">pontos</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <ScorePart icon={<TrendingUp size={14} />} label="Estágio" value={score.pts_estagio} />
            <ScorePart icon={<TrendingUp size={14} />} label="Progressão" value={score.pts_progressao} />
            <ScorePart icon={<BookOpen size={14} />} label="Discipulado" value={score.pts_discipulado} />
            <ScorePart icon={<CalendarCheck size={14} />} label="Presença" value={score.pts_presenca} />
            <ScorePart icon={<Mic2 size={14} />} label="Ministério" value={score.pts_ministerio} />
          </div>
          {score.proximo_estagio && (
            <p className="mt-4 text-sm text-muted">
              Próximo estágio sugerido: <b className="text-navy">{STAGE_LABELS[score.proximo_estagio] ?? score.proximo_estagio}</b>
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi icon={<CalendarCheck size={16} />} label="Presença (90d)" value={`${score.reunioes_presente_90d}/${score.reunioes_total_90d}`} />
        <Kpi icon={<Users size={16} />} label="Discipulados ativos" value={score.disc_ativos} />
        <Kpi icon={<Mic2 size={16} />} label="Ministérios" value={score.total_ministerios} />
      </div>
    </div>
  );
}

function ScorePart({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border p-2 text-center">
      <div className="mb-1 flex items-center justify-center gap-1 text-gold">{icon}</div>
      <p className="font-display text-lg text-navy">{value}</p>
      <p className="text-[10px] uppercase text-muted">{label}</p>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-l-4 border-l-gold bg-card p-3">
      <div className="flex items-center gap-2 text-navy-600">
        <span className="text-gold">{icon}</span>
        <p className="text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-1 font-display text-xl text-navy">{value}</p>
    </div>
  );
}
