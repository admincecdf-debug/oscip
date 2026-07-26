"use client";
import { Home, Split, HandHelping, Heart, CalendarCheck, Award } from "lucide-react";
import { useLgBadges, useLgMultiplicationProgress } from "@/hooks/use-queries";
import type { LgBadge } from "@/types/domain";

const ICONS: Record<string, React.ComponentType<{className?:string}>> = {
  "home": Home,
  "split": Split,
  "praying-hands": HandHelping,
  "heart": Heart,
  "calendar-check": CalendarCheck,
};

/** Cartão compacto de progresso + badges de um LG. */
export function LgEngagementCard({ lgId, lgName }: { lgId: string; lgName?: string }) {
  const { data: progress } = useLgMultiplicationProgress(lgId);
  const { data: badges = [] } = useLgBadges(lgId);

  if (!progress) return null;

  return (
    <div className="rounded-xl border bg-gradient-to-br from-gold/5 to-card p-4">
      {lgName && (
        <div className="mb-3 flex items-center justify-between">
          <b className="text-sm text-navy">{lgName}</b>
          {badges.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">
              <Award className="h-3 w-3" />{badges.length}
            </span>
          )}
        </div>
      )}

      {/* Barra de progresso de multiplicação */}
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wider text-muted">Rumo à multiplicação</span>
          <span className="font-mono font-bold text-navy">{progress.current_count} / {progress.target}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full transition-all ${progress.percent >= 100 ? "bg-green-500" : "bg-gold"}`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {progress.percent >= 100
            ? "🎉 Pronto para multiplicar!"
            : `${progress.percent}% — faltam ${Math.max(0, progress.target - progress.current_count)} membros`}
        </p>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {badges.map((b: LgBadge) => {
            const Ico = ICONS[b.icon] ?? Award;
            return (
              <span key={b.key}
                title={b.description}
                className="inline-flex items-center gap-1 rounded-md border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-navy">
                <Ico className="h-3 w-3 text-gold" />{b.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
