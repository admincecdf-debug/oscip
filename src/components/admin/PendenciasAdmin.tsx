"use client";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { useCentralPendencias } from "@/hooks/use-queries";
import { CATEGORIA_LABELS } from "@/services/dashboard";
import type { TabKey } from "./AdminSidebar";

/**
 * UX-003 Cap. 3 Parte 4 — Dashboard Operacional / Central de
 * Pendências. Junta numa lista só tudo que já existia espalhado:
 * oração, visitas, novos contatos, delegações, carteirinhas e
 * relatórios RELMDA aguardando ação.
 */
export function PendenciasAdmin({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { data: items = [], isLoading } = useCentralPendencias();

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="font-display text-xl text-navy">Central de Pendências</h2>
        <p className="text-sm text-muted-foreground">Tudo que precisa da sua atenção, num lugar só.</p>
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
          <p className="mt-2 font-semibold text-navy">Tudo em dia!</p>
          <p className="text-sm text-muted-foreground">Nenhuma pendência no seu escopo agora.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <button
              key={`${it.categoria}-${it.id}`}
              onClick={() => onNavigate(it.aba_destino as TabKey)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card p-3 text-left shadow-sm transition hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy">{it.titulo}</p>
                {it.subtitulo && <p className="truncate text-xs text-muted-foreground">{it.subtitulo}</p>}
              </div>
              <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                {CATEGORIA_LABELS[it.categoria]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
