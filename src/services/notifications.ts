"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export type NotifKind = "aniversario" | "sem_relatorio" | "oracao_urgente" | "visita_pastoral" | "meta_atrasada" | "pendencia";

export interface Notif {
  id: string; kind: NotifKind; title: string; detail: string;
  urgency: "critico" | "atencao" | "info";
}

/** Busca notificações de todas as fontes computadas do sistema (sem persistência própria — o estado de leitura fica em notification_dismissals). */
export async function fetchNotifications(): Promise<Notif[]> {
  const notifs: Notif[] = [];

  const [birthdays, reliability, ctAlerts, goals, pendencias] = await Promise.allSettled([
    supabase.from("birthday_today").select("id, full_name, idade").limit(10),
    supabase.from("lg_reliability_index").select("id, name, dias_sem_relatorio")
      .eq("flag_sem_relatorio_recente", true).limit(10),
    supabase.from("control_tower_alerts")
      .select("alert_type, lg_name, detail")
      .in("alert_type", ["oracao_urgente", "visita_pastoral"])
      .limit(10),
    supabase.from("goals_vs_actual")
      .select("indicator, pct_atingido, target_value")
      .lt("pct_atingido", 70)
      .eq("scope", "nacional")
      .limit(5),
    supabase.rpc("central_pendencias"),
  ]);

  if (birthdays.status === "fulfilled" && birthdays.value.data) {
    birthdays.value.data.forEach((b: any) => notifs.push({
      id: `birth-${b.id}`, kind: "aniversario", title: `🎂 ${b.full_name}`, detail: `Faz ${b.idade} anos hoje!`, urgency: "info",
    }));
  }

  if (reliability.status === "fulfilled" && reliability.value.data) {
    reliability.value.data.forEach((lg: any) => notifs.push({
      id: `rel-${lg.id}`, kind: "sem_relatorio", title: lg.name,
      detail: lg.dias_sem_relatorio === 999 ? "Nunca enviou relatório" : `Sem relatório há ${lg.dias_sem_relatorio} dias`,
      urgency: "critico",
    }));
  }

  if (ctAlerts.status === "fulfilled" && ctAlerts.value.data) {
    ctAlerts.value.data.forEach((a: any, i: number) => notifs.push({
      id: `ct-${a.alert_type}-${i}`, kind: a.alert_type as NotifKind, title: a.lg_name ?? "Nacional", detail: a.detail,
      urgency: a.alert_type === "oracao_urgente" ? "critico" : "atencao",
    }));
  }

  if (goals.status === "fulfilled" && goals.value.data) {
    const LABELS: Record<string, string> = {
      membros_ativos: "Membros Ativos", visitantes: "Visitantes", decisoes: "Decisões",
      multiplicacoes: "Multiplicações", lgs_ativos: "LGs Ativos", disc_ativos: "Discipulados",
    };
    goals.value.data.forEach((g: any, i: number) => notifs.push({
      id: `goal-${i}`, kind: "meta_atrasada", title: LABELS[g.indicator] ?? g.indicator,
      detail: `${g.pct_atingido ?? 0}% da meta atingida`, urgency: "atencao",
    }));
  }

  if (pendencias.status === "fulfilled" && pendencias.value.data) {
    (pendencias.value.data as any[]).slice(0, 15).forEach((p) => notifs.push({
      id: `pend-${p.categoria}-${p.id}`, kind: "pendencia", title: p.titulo, detail: p.subtitulo ?? "", urgency: "atencao",
    }));
  }

  return notifs.sort((a, b) => {
    const order = { critico: 0, atencao: 1, info: 2 };
    return order[a.urgency] - order[b.urgency];
  });
}

export async function listDismissedKeys(sb: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await sb.from("notification_dismissals").select("notif_key");
  if (error) { console.error("[notifications] listDismissedKeys", error); return new Set(); }
  return new Set((data ?? []).map((r) => r.notif_key as string));
}

export async function dismissNotification(sb: SupabaseClient, notifKey: string): Promise<void> {
  const user = (await sb.auth.getUser()).data.user;
  if (!user) return;
  const { error } = await sb.from("notification_dismissals").upsert(
    { user_id: user.id, notif_key: notifKey }, { onConflict: "user_id,notif_key" }
  );
  if (error) throw error;
}

export async function restoreAllDismissals(sb: SupabaseClient): Promise<void> {
  const user = (await sb.auth.getUser()).data.user;
  if (!user) return;
  const { error } = await sb.from("notification_dismissals").delete().eq("user_id", user.id);
  if (error) throw error;
}
