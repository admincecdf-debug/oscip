"use client";
import { Users, UserCheck, UserX, UserMinus, Laptop, Link2, Shield, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useUsuariosStats } from "@/hooks/use-queries";
import type { TabKey } from "./AdminSidebar";

const ACCENTS: Record<string, string> = {
  blue: "border-l-blue-400", green: "border-l-green-500", red: "border-l-red-400",
  amber: "border-l-amber-400", purple: "border-l-purple-500", gold: "border-l-gold",
};

function KpiCard({ icon, label, value, accent, onClick }: { icon: React.ReactNode; label: string; value: number; accent: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="text-left">
      <Card className={`border-l-4 ${ACCENTS[accent]} transition hover:shadow-md`}>
        <CardContent className="flex items-center gap-3 pt-4">
          <span className="text-muted-foreground">{icon}</span>
          <div>
            <p className="font-display text-2xl font-bold text-navy">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

/**
 * UX-003 Cap. 3 Parte 7 — Painel de Usuários. Reúne indicadores que
 * já existiam espalhados (sessões, delegações, convites, auditoria)
 * numa visão única, conforme o documento pede.
 */
export function PainelUsuariosAdmin({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { data: stats } = useUsuariosStats();

  if (!stats) return <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="font-display text-xl text-navy">Painel de Usuários</h2>
        <p className="text-sm text-muted-foreground">Acompanhamento da utilização da plataforma pelas pessoas do seu escopo.</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Situação cadastral</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={<Users className="h-5 w-5" />} label="Cadastrados com acesso" value={stats.total_cadastrados} accent="blue" onClick={() => onNavigate("members")} />
          <KpiCard icon={<UserCheck className="h-5 w-5" />} label="Ativos" value={stats.total_ativos} accent="green" onClick={() => onNavigate("members")} />
          <KpiCard icon={<UserMinus className="h-5 w-5" />} label="Inativos" value={stats.total_inativos} accent="amber" onClick={() => onNavigate("members")} />
          <KpiCard icon={<UserX className="h-5 w-5" />} label="Afastados" value={stats.total_afastados} accent="red" onClick={() => onNavigate("members")} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Acesso e segurança</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={<Laptop className="h-5 w-5" />} label="Sessões ativas" value={stats.sessoes_ativas} accent="blue" />
          <KpiCard icon={<Link2 className="h-5 w-5" />} label="Convites usados (30d)" value={stats.convites_usados_30d} accent="gold" onClick={() => onNavigate("invites")} />
          <KpiCard icon={<Shield className="h-5 w-5" />} label="Delegações ativas" value={stats.delegacoes_ativas} accent="purple" onClick={() => onNavigate("delegations")} />
          <KpiCard icon={<ClipboardList className="h-5 w-5" />} label="Eventos de auditoria (7d)" value={stats.eventos_auditoria_7d} accent="blue" onClick={() => onNavigate("audit")} />
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 text-xs text-muted-foreground">
          Tentativas de login inválidas e autenticação multifator dependem de recursos nativos do provedor de
          autenticação (Supabase Auth) que ainda não estão expostos nesta tela.
        </CardContent>
      </Card>
    </div>
  );
}
