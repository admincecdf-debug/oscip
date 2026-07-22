"use client";
import { useState, useEffect } from "react";
import { Bell, BellRing, CalendarDays, ClipboardX, Heart, Target, Home, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

// ── Tipos ─────────────────────────────────────────────────────
type NotifKind = "aniversario" | "sem_relatorio" | "oracao_urgente" | "visita_pastoral" | "meta_atrasada";

interface Notif {
  id: string;
  kind: NotifKind;
  title: string;
  detail: string;
  urgency: "critico" | "atencao" | "info";
}

const KIND_CONFIG: Record<NotifKind, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  aniversario:     { icon: <CalendarDays className="h-4 w-4"/>, color:"text-pink-600",   bg:"bg-pink-50 border-pink-200",   label:"Aniversário"       },
  sem_relatorio:   { icon: <ClipboardX className="h-4 w-4"/>,  color:"text-red-600",    bg:"bg-red-50 border-red-200",     label:"Sem Relatório"     },
  oracao_urgente:  { icon: <Heart className="h-4 w-4"/>,       color:"text-red-600",    bg:"bg-red-50 border-red-200",     label:"Oração Urgente"    },
  visita_pastoral: { icon: <Home className="h-4 w-4"/>,        color:"text-yellow-600", bg:"bg-yellow-50 border-yellow-200",label:"Visita Pastoral"  },
  meta_atrasada:   { icon: <Target className="h-4 w-4"/>,      color:"text-orange-600", bg:"bg-orange-50 border-orange-200",label:"Meta Atrasada"    },
};

// ── Buscar notificações ───────────────────────────────────────
async function fetchNotifications(): Promise<Notif[]> {
  const notifs: Notif[] = [];

  const [birthdays, reliability, ctAlerts, goals] = await Promise.allSettled([
    // Aniversariantes hoje
    supabase.from("birthday_today").select("id, full_name, idade").limit(10),
    // LGs sem relatório
    supabase.from("lg_reliability_index").select("id, name, dias_sem_relatorio")
      .eq("flag_sem_relatorio_recente", true).limit(10),
    // Alertas Torre de Controle
    supabase.from("control_tower_alerts")
      .select("alert_type, lg_name, detail")
      .in("alert_type", ["oracao_urgente", "visita_pastoral"])
      .limit(10),
    // Metas em atraso
    supabase.from("goals_vs_actual")
      .select("indicator, pct_atingido, target_value")
      .lt("pct_atingido", 70)
      .eq("scope", "nacional")
      .limit(5),
  ]);

  // Aniversariantes
  if (birthdays.status === "fulfilled" && birthdays.value.data) {
    birthdays.value.data.forEach(b => notifs.push({
      id: `birth-${b.id}`,
      kind: "aniversario",
      title: `🎂 ${b.full_name}`,
      detail: `Faz ${b.idade} anos hoje!`,
      urgency: "info",
    }));
  }

  // LGs sem relatório
  if (reliability.status === "fulfilled" && reliability.value.data) {
    reliability.value.data.forEach(lg => notifs.push({
      id: `rel-${lg.id}`,
      kind: "sem_relatorio",
      title: lg.name,
      detail: lg.dias_sem_relatorio === 999
        ? "Nunca enviou relatório"
        : `Sem relatório há ${lg.dias_sem_relatorio} dias`,
      urgency: "critico",
    }));
  }

  // Alertas pastorais
  if (ctAlerts.status === "fulfilled" && ctAlerts.value.data) {
    ctAlerts.value.data.forEach((a, i) => notifs.push({
      id: `ct-${a.alert_type}-${i}`,
      kind: a.alert_type as NotifKind,
      title: a.lg_name ?? "Nacional",
      detail: a.detail,
      urgency: a.alert_type === "oracao_urgente" ? "critico" : "atencao",
    }));
  }

  // Metas atrasadas
  if (goals.status === "fulfilled" && goals.value.data) {
    const LABELS: Record<string, string> = {
      membros_ativos:"Membros Ativos", visitantes:"Visitantes", decisoes:"Decisões",
      multiplicacoes:"Multiplicações", lgs_ativos:"LGs Ativos", disc_ativos:"Discipulados",
    };
    goals.value.data.forEach((g, i) => notifs.push({
      id: `goal-${i}`,
      kind: "meta_atrasada",
      title: LABELS[g.indicator] ?? g.indicator,
      detail: `${g.pct_atingido ?? 0}% da meta atingida`,
      urgency: "atencao",
    }));
  }

  // Ordenar: críticos primeiro, depois atenção, depois info
  return notifs.sort((a, b) => {
    const order = { critico: 0, atencao: 1, info: 2 };
    return order[a.urgency] - order[b.urgency];
  });
}

// ── Badge de notificações ─────────────────────────────────────
export function NotificationBadge({ count }: { count: number }) {
  if (count === 0) return (
    <div className="relative">
      <Bell className="h-5 w-5 text-muted-foreground"/>
    </div>
  );
  return (
    <div className="relative">
      <BellRing className="h-5 w-5 text-[#C9A227] animate-pulse"/>
      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
        {count > 9 ? "9+" : count}
      </span>
    </div>
  );
}

// ── Painel de notificações ────────────────────────────────────
export function NotificationsPanel() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchNotifications().then(n => { setNotifs(n); setLoading(false); });
    // Atualizar a cada 5 minutos
    const interval = setInterval(() => {
      fetchNotifications().then(setNotifs);
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  const visible = notifs.filter(n => !dismissed.has(n.id));
  const criticos = visible.filter(n => n.urgency === "critico").length;
  const atencao  = visible.filter(n => n.urgency === "atencao").length;
  const info     = visible.filter(n => n.urgency === "info").length;

  if (loading) return (
    <div className="py-10 text-center text-sm text-muted-foreground">Carregando alertas…</div>
  );

  if (visible.length === 0) return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <CheckCircle2 className="h-12 w-12 text-green-500"/>
      <p className="font-semibold text-[#0E2A47]">Tudo em ordem!</p>
      <p className="text-sm text-muted-foreground">Nenhum alerta ativo no momento.</p>
    </div>
  );

  return (
    <div className="space-y-4 p-1">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-2xl font-bold text-red-600">{criticos}</p>
            <p className="text-xs text-muted-foreground">🔴 Críticos</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-400">
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{atencao}</p>
            <p className="text-xs text-muted-foreground">🟡 Atenção</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{info}</p>
            <p className="text-xs text-muted-foreground">🔵 Info</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista por categoria */}
      {(["aniversario","sem_relatorio","oracao_urgente","visita_pastoral","meta_atrasada"] as NotifKind[]).map(kind => {
        const group = visible.filter(n => n.kind === kind);
        if (group.length === 0) return null;
        const cfg = KIND_CONFIG[kind];
        return (
          <div key={kind}>
            <h3 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2 ${cfg.color}`}>
              {cfg.icon} {cfg.label} ({group.length})
            </h3>
            <div className="space-y-1.5">
              {group.map(n => (
                <div key={n.id} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${cfg.bg}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${cfg.color}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.detail}</p>
                  </div>
                  <button
                    onClick={() => setDismissed(d => new Set([...d, n.id]))}
                    className="text-muted-foreground hover:text-gray-600 shrink-0 mt-0.5"
                    title="Dispensar"
                  >
                    <CheckCircle2 className="h-4 w-4"/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {dismissed.size > 0 && (
        <button
          onClick={() => setDismissed(new Set())}
          className="w-full text-xs text-muted-foreground hover:text-[#0E2A47] py-2"
        >
          Restaurar {dismissed.size} alerta(s) dispensado(s)
        </button>
      )}
    </div>
  );
}

// ── Hook para contar notificações (para o badge) ──────────────
export function useNotificationCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetchNotifications().then(n => setCount(n.length));
    const interval = setInterval(() => {
      fetchNotifications().then(n => setCount(n.length));
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  return count;
}
