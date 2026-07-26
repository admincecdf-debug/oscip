"use client";
import { useEffect, useState } from "react";
import { Bell, ClipboardX, Heart, Target, Home, CalendarDays, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { fetchNotifications, listDismissedKeys, dismissNotification, restoreAllDismissals, type Notif, type NotifKind } from "@/services/notifications";

const KIND_CONFIG: Record<NotifKind, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  aniversario:     { icon: <CalendarDays className="h-4 w-4" />, color: "text-pink-600",   bg: "bg-pink-50 border-pink-200",   label: "Aniversário" },
  sem_relatorio:   { icon: <ClipboardX className="h-4 w-4" />,  color: "text-red-600",    bg: "bg-red-50 border-red-200",     label: "Sem Relatório" },
  oracao_urgente:  { icon: <Heart className="h-4 w-4" />,       color: "text-red-600",    bg: "bg-red-50 border-red-200",     label: "Oração Urgente" },
  visita_pastoral: { icon: <Home className="h-4 w-4" />,        color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", label: "Visita Pastoral" },
  meta_atrasada:   { icon: <Target className="h-4 w-4" />,      color: "text-orange-600", bg: "bg-orange-50 border-orange-200", label: "Meta Atrasada" },
  pendencia:       { icon: <Bell className="h-4 w-4" />,        color: "text-blue-600",   bg: "bg-blue-50 border-blue-200",   label: "Pendência" },
};

/**
 * UX-003 Cap. 3 Parte 6 — Central de Notificações do admin. Reúne
 * as mesmas fontes do painel do membro/líder + a Central de
 * Pendências, com a diferença de que "dispensar" fica salvo de
 * verdade (não some ao recarregar a página).
 */
export function NotificacoesAdmin() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  async function load() {
    const [n, d] = await Promise.all([fetchNotifications(), listDismissedKeys(supabase)]);
    setNotifs(n); setDismissed(d); setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]));
    try { await dismissNotification(supabase, id); } catch { /* mantém dispensado visualmente mesmo se falhar */ }
  }

  async function handleRestoreAll() {
    setDismissed(new Set());
    await restoreAllDismissals(supabase);
  }

  const visible = notifs.filter((n) => !dismissed.has(n.id));
  const criticos = visible.filter((n) => n.urgency === "critico").length;
  const atencao = visible.filter((n) => n.urgency === "atencao").length;
  const info = visible.filter((n) => n.urgency === "info").length;

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">Carregando notificações…</p>;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="font-display text-xl text-navy">Central de Notificações</h2>
        <p className="text-sm text-muted-foreground">Alertas, pendências e avisos, num lugar só.</p>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <p className="font-semibold text-navy">Tudo em ordem!</p>
          <p className="text-sm text-muted-foreground">Nenhum alerta ativo no momento.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-l-4 border-l-red-500"><CardContent className="pt-3 pb-3 text-center">
              <p className="text-2xl font-bold text-red-600">{criticos}</p><p className="text-xs text-muted-foreground">🔴 Críticos</p>
            </CardContent></Card>
            <Card className="border-l-4 border-l-yellow-400"><CardContent className="pt-3 pb-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{atencao}</p><p className="text-xs text-muted-foreground">🟡 Atenção</p>
            </CardContent></Card>
            <Card className="border-l-4 border-l-blue-400"><CardContent className="pt-3 pb-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{info}</p><p className="text-xs text-muted-foreground">🔵 Info</p>
            </CardContent></Card>
          </div>

          {(Object.keys(KIND_CONFIG) as NotifKind[]).map((kind) => {
            const group = visible.filter((n) => n.kind === kind);
            if (group.length === 0) return null;
            const cfg = KIND_CONFIG[kind];
            return (
              <div key={kind}>
                <h3 className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${cfg.color}`}>
                  {cfg.icon} {cfg.label} ({group.length})
                </h3>
                <div className="space-y-1.5">
                  {group.map((n) => (
                    <div key={n.id} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${cfg.bg}`}>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${cfg.color}`}>{n.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{n.detail}</p>
                      </div>
                      <button onClick={() => handleDismiss(n.id)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-navy" title="Marcar como lida">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {dismissed.size > 0 && (
        <button onClick={handleRestoreAll} className="w-full py-2 text-xs text-muted-foreground hover:text-navy">
          Restaurar {dismissed.size} notificação(ões) dispensada(s)
        </button>
      )}
    </div>
  );
}
