"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useDashboard } from "@/hooks/use-queries";
import { Users, UserPlus, Flame, FileText, Droplets } from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  visitante: "Visitante", novo_convertido: "Novo convertido", em_acompanhamento: "Em acompanhamento",
  membro: "Membro", lider: "Líder",
};

export function VisaoGeralComunidade({ churchId }: { churchId: string }) {
  const { data: stats, isLoading } = useDashboard(churchId);

  if (isLoading) {
    return <p className="py-8 text-center text-sm italic text-muted">Carregando visão geral…</p>;
  }
  if (!stats) {
    return <p className="py-8 text-center text-sm italic text-muted">Sem dados disponíveis para esta comunidade.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        <Kpi icon={<Users size={16} />} label="Membros" value={stats.total_members} />
        <Kpi icon={<UserPlus size={16} />} label="Visitantes" value={stats.total_visitors} />
        <Kpi icon={<Flame size={16} />} label="Life Groups" value={stats.total_groups} />
        <Kpi icon={<FileText size={16} />} label="Relatórios" value={stats.total_reports} />
        <Kpi icon={<Droplets size={16} />} label="Batismos" value={stats.baptisms} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por estágio</CardTitle>
          <CardDescription>Membros e visitantes por etapa da jornada.</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(stats.by_stage).length === 0 ? (
            <p className="text-sm italic text-muted">Sem dados de estágio ainda.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(stats.by_stage).map(([stage, count]) => (
                <div key={stage} className="rounded-md border p-3 text-center">
                  <p className="font-display text-xl text-navy">{count}</p>
                  <p className="text-xs text-muted">{STAGE_LABELS[stage] ?? stage}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Presença e visitantes por semana</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.reports_trend.length === 0 ? (
            <p className="text-sm italic text-muted">Nenhum relatório registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted">
                    <th className="p-2">Semana</th><th className="p-2">Presença</th><th className="p-2">Visitantes</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.reports_trend.map((r) => (
                    <tr key={r.week} className="border-b">
                      <td className="p-2 text-navy">{r.week}</td>
                      <td className="p-2">{r.attendance}</td>
                      <td className="p-2">{r.visitors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
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
