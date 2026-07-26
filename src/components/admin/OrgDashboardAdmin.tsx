"use client";
import {
  Activity, Building2, Users, Heart, MapPin, Sparkles, TrendingUp,
  FileText, Award, Calendar, Globe2, Split, CalendarClock, Ticket, GraduationCap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useOrgKpis, useGrowthMonthly, useMyProfile, useChurches, useMinisteriosEventosStats, useMinisteriosRanking, useFormacaoStats } from "@/hooks/use-queries";
import { HierarchyExplorer } from "./HierarchyExplorer";
import { IntelligenceInsights } from "./IntelligenceInsights";
import { CommunityIdentity } from "@/components/shared/CommunityIdentity";
import type { TabKey } from "./AdminSidebar";

const ROLE_LABELS: Record<string, string> = {
  apostolo: "Apóstolo", pastor: "Pastor", supervisor: "Supervisor", lider: "Líder", membro: "Membro",
};

export function OrgDashboardAdmin({ onNavigate }: { onNavigate?: (tab: TabKey) => void }) {
  const { data: kpis, isLoading } = useOrgKpis();
  const { data: growth = [] } = useGrowthMonthly();
  const { data: me } = useMyProfile();
  const { data: churches = [] } = useChurches();
  const { data: minEvStats } = useMinisteriosEventosStats(null);
  const { data: minRanking = [] } = useMinisteriosRanking(null);
  const { data: formacaoStats } = useFormacaoStats(null);
  const activeCommunity = churches.find(c => c.id === me?.church_id);

  if (isLoading) {
    return <p className="py-8 text-center text-sm italic text-muted">Carregando dashboard…</p>;
  }
  if (!kpis) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Activity className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 text-sm text-muted">Sem dados consolidados ainda.</p>
        </CardContent>
      </Card>
    );
  }

  const maxMembers = Math.max(1, ...growth.map(g => g.new_members));
  const maxLgs = Math.max(1, ...growth.map(g => g.new_lgs));

  return (
    <div className="space-y-5">
      {activeCommunity && (
        <CommunityIdentity
          variant="dashboard"
          communityName={activeCommunity.name}
          logoUrl={activeCommunity.logo_url}
          userName={me?.full_name}
          roleName={me?.role ? (ROLE_LABELS[me.role] ?? me.role) : null}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-gold" />Dashboard Organizacional</CardTitle>
          <CardDescription>Visão executiva consolidada da rede CEC Brasil</CardDescription>
        </CardHeader>
      </Card>

      <IntelligenceInsights />

      {/* Bloco 1 — Rede CEC */}
      <section>
        <SectionTitle icon={<Globe2 />} title="Rede CEC Brasil" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <a href="#estrutura-explorer">
            <KpiCard icon={<Building2 />} label="Comunidades" value={kpis.total_churches}
              sublabel={`${kpis.total_sedes} Sedes · ${kpis.total_nucleos} Núcleos · ${kpis.total_locais} Locais · clique p/ explorar`} accent="gold" />
          </a>
          <KpiCard icon={<MapPin />} label="Estados alcançados" value={kpis.estados_alcancados}
            sublabel={`${kpis.cidades_alcancadas} cidades`} accent="blue" onClick={() => onNavigate?.("expansion-map")} />
          <KpiCard icon={<Users />} label="Membros ativos" value={kpis.total_membros_ativos.toLocaleString("pt-BR")}
            sublabel={`+${kpis.novos_membros_30d} nos últimos 30d`} accent="green" onClick={() => onNavigate?.("members")} />
          <KpiCard icon={<Sparkles />} label="Novos convertidos" value={kpis.novos_convertidos}
            sublabel="ainda em consolidação" accent="purple" onClick={() => onNavigate?.("crm")} />
        </div>
      </section>

      {/* Bloco 2 — Estrutura celular (interativo, drill-down macro → micro) */}
      <section id="estrutura-explorer">
        <SectionTitle icon={<Heart />} title="Estrutura Celular MDA — clique num card para explorar" />
        <HierarchyExplorer />
      </section>

      {/* Bloco 3 — Atividade */}
      <section>
        <SectionTitle icon={<TrendingUp />} title="Atividade Recente" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={<FileText />} label="Relatórios" value={kpis.relatorios_ultima_semana}
            sublabel="esta semana" accent="green" onClick={() => onNavigate?.("weekly")} />
          <KpiCard icon={<Calendar />} label="Relatórios" value={kpis.relatorios_ultimo_mes}
            sublabel="último mês" accent="green" onClick={() => onNavigate?.("monthly")} />
          <KpiCard icon={<Split />} label="Multiplicações" value={kpis.multiplicacoes_ano}
            sublabel="no ano" accent="gold" onClick={() => onNavigate?.("genealogy")} />
          <KpiCard icon={<Award />} label="Ministérios" value={kpis.total_ministerios} accent="purple" onClick={() => onNavigate?.("ministerios")} />
        </div>
      </section>

      {/* Bloco 3.6 — Formação */}
      {formacaoStats && (
        <section>
          <SectionTitle icon={<GraduationCap />} title="Formação" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={<GraduationCap />} label="Cursos ativos" value={formacaoStats.total_cursos}
              accent="purple" onClick={() => onNavigate?.("formacao")} />
            <KpiCard icon={<Users />} label="Turmas em andamento" value={formacaoStats.total_turmas_ativas}
              accent="blue" onClick={() => onNavigate?.("formacao")} />
            <KpiCard icon={<FileText />} label="Matriculados" value={formacaoStats.total_matriculados}
              accent="gold" onClick={() => onNavigate?.("formacao")} />
            <KpiCard icon={<Award />} label="Concluintes" value={formacaoStats.total_concluintes_90d}
              sublabel="últimos 90 dias" accent="green" onClick={() => onNavigate?.("formacao")} />
          </div>
        </section>
      )}

      {/* Bloco 3.5 — Ministérios e Eventos */}
      {minEvStats && (
        <section>
          <SectionTitle icon={<Award />} title="Ministérios e Eventos" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={<Award />} label="Ministérios" value={minEvStats.total_ministerios}
              sublabel={`${minEvStats.total_integrantes} integrantes no total`} accent="purple" onClick={() => onNavigate?.("ministerios")} />
            <KpiCard icon={<CalendarClock />} label="Eventos futuros" value={minEvStats.eventos_futuros}
              accent="blue" onClick={() => onNavigate?.("events")} />
            <KpiCard icon={<Calendar />} label="Eventos realizados" value={minEvStats.eventos_realizados_30d}
              sublabel="últimos 30 dias" accent="gold" onClick={() => onNavigate?.("events")} />
            <KpiCard icon={<Ticket />} label="Inscrições" value={minEvStats.total_inscricoes_30d}
              sublabel="últimos 30 dias" accent="green" onClick={() => onNavigate?.("events")} />
          </div>
          {minRanking.length > 0 && (
            <Card className="mt-3">
              <CardContent className="pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Ministérios com mais integrantes</p>
                <div className="space-y-1.5">
                  {minRanking.map((r) => (
                    <div key={r.nome} className="flex items-center justify-between text-sm">
                      <span className="text-navy">{r.nome}</span>
                      <span className="font-bold text-gold">{r.integrantes}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Bloco 4 — Crescimento mensal (gráfico de barras simples) */}
      {growth.length > 0 && (
        <section>
          <SectionTitle icon={<TrendingUp />} title="Crescimento — últimos 12 meses" />
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Novos membros por mês</p>
                <div className="flex h-32 items-end gap-1.5">
                  {growth.map(g => {
                    const h = (g.new_members / maxMembers) * 100;
                    return (
                      <div key={g.month_label} className="group flex flex-1 flex-col items-center justify-end">
                        <div className="relative w-full rounded-t bg-gold/70 transition hover:bg-gold"
                          style={{ height: `${h}%`, minHeight: g.new_members > 0 ? "4px" : "0" }}>
                          <span className="invisible absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-navy px-1.5 py-0.5 text-[10px] text-white group-hover:visible">
                            {g.new_members}
                          </span>
                        </div>
                        <p className="mt-1 text-[9px] text-muted">{g.month_label.slice(5)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Novos Life Groups por mês</p>
                <div className="flex h-24 items-end gap-1.5">
                  {growth.map(g => {
                    const h = (g.new_lgs / maxLgs) * 100;
                    return (
                      <div key={g.month_label} className="group flex flex-1 flex-col items-center justify-end">
                        <div className="relative w-full rounded-t bg-green-500/70 transition hover:bg-green-500"
                          style={{ height: `${h}%`, minHeight: g.new_lgs > 0 ? "4px" : "0" }}>
                          <span className="invisible absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-navy px-1.5 py-0.5 text-[10px] text-white group-hover:visible">
                            {g.new_lgs}
                          </span>
                        </div>
                        <p className="mt-1 text-[9px] text-muted">{g.month_label.slice(5)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-navy-600">
      <span className="text-gold [&>svg]:h-4 [&>svg]:w-4">{icon}</span>{title}
    </h2>
  );
}

const ACCENT: Record<string, string> = {
  gold: "border-l-gold bg-gold/5",
  blue: "border-l-blue-500 bg-blue-50/50",
  green: "border-l-green-500 bg-green-50/50",
  purple: "border-l-purple-500 bg-purple-50/50",
  navy: "border-l-navy bg-navy-50/30",
};

function KpiCard({ icon, label, value, sublabel, accent = "gold", onClick }: {
  icon: React.ReactNode; label: string; value: string | number; sublabel?: string; accent?: string; onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={`border-l-4 ${ACCENT[accent] ?? ACCENT.gold} ${onClick ? "cursor-pointer shadow-sm ring-1 ring-transparent transition hover:shadow-xl hover:-translate-y-1 hover:ring-gold/40" : ""}`}
    >
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-navy-600">
          <span className="text-gold [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
          <p className="text-xs font-bold uppercase tracking-wider">{label}</p>
        </div>
        <p className="mt-1 font-display text-3xl text-navy">{value}</p>
        {sublabel && <p className="mt-1 text-[11px] text-muted">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}
