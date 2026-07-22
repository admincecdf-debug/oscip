"use client";
import { useMemo, useState } from "react";
import { CalendarDays, Church, Cake, PartyPopper } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useEvents, useAllServiceTimes, useBirthdaysUpcoming } from "@/hooks/use-queries";
import type { TabKey } from "./AdminSidebar";

const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};

interface AgendaItem {
  date: Date; title: string; subtitle: string; kind: "culto" | "evento" | "aniversario";
}

/** Próxima ocorrência de um dia da semana + horário, a partir de hoje (inclusive). */
function nextOccurrence(weekday: string, time: string): Date {
  const now = new Date();
  const targetDow = WEEKDAY_INDEX[weekday] ?? 0;
  const [h, m] = time.split(":").map(Number);
  const d = new Date(now);
  let diff = (targetDow - now.getDay() + 7) % 7;
  d.setDate(now.getDate() + diff);
  d.setHours(h || 0, m || 0, 0, 0);
  if (diff === 0 && d < now) d.setDate(d.getDate() + 7);
  return d;
}

/**
 * UX-003 Cap. 3 Parte 4 — Agenda Inteligente. Reúne cultos
 * recorrentes, eventos e aniversários numa única linha do tempo,
 * pros próximos 14 dias.
 */
export function AgendaAdmin({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { data: events = [] } = useEvents();
  const { data: serviceTimes = [] } = useAllServiceTimes();
  const { data: birthdays = [] } = useBirthdaysUpcoming();
  const [days, setDays] = useState(14);

  const items = useMemo<AgendaItem[]>(() => {
    const now = new Date();
    const limit = new Date(now.getTime() + days * 86400000);
    const out: AgendaItem[] = [];

    for (const s of serviceTimes) {
      if (!s.is_active) continue;
      let occ = nextOccurrence(s.weekday, s.time);
      while (occ <= limit) {
        out.push({ date: new Date(occ), title: s.description || "Culto", subtitle: s.time.slice(0, 5), kind: "culto" });
        occ = new Date(occ.getTime() + 7 * 86400000);
      }
    }

    for (const e of events) {
      const d = new Date(e.starts_at);
      if (d >= now && d <= limit) {
        out.push({ date: d, title: e.title, subtitle: e.location || "", kind: "evento" });
      }
    }

    for (const b of birthdays) {
      if (b.dias_ate_aniversario !== undefined && b.dias_ate_aniversario <= days) {
        const d = new Date(now.getTime() + (b.dias_ate_aniversario ?? 0) * 86400000);
        out.push({ date: d, title: `Aniversário: ${b.full_name}`, subtitle: `${b.idade + 1} anos`, kind: "aniversario" });
      }
    }

    return out.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, serviceTimes, birthdays, days]);

  const grouped = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const it of items) {
      const key = it.date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  const ICONS = { culto: <Church className="h-4 w-4" />, evento: <PartyPopper className="h-4 w-4" />, aniversario: <Cake className="h-4 w-4" /> };
  const COLORS = { culto: "text-blue-600 bg-blue-50", evento: "text-gold bg-gold/10", aniversario: "text-pink-600 bg-pink-50" };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-navy">Agenda Inteligente</h2>
          <p className="text-sm text-muted-foreground">Cultos, eventos e aniversários dos próximos dias.</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value={7}>7 dias</option>
          <option value={14}>14 dias</option>
          <option value={30}>30 dias</option>
        </select>
      </div>

      {grouped.length === 0 ? (
        <div className="py-16 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Nada agendado nesse período.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, dayItems]) => (
            <div key={day}>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{day}</p>
              <div className="space-y-1.5">
                {dayItems.map((it, i) => (
                  <button
                    key={i}
                    onClick={() => onNavigate(it.kind === "culto" ? "services" : it.kind === "evento" ? "events" : "birthdays")}
                    className="flex w-full items-center gap-3 rounded-lg border bg-card p-2.5 text-left shadow-sm transition hover:shadow-md"
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${COLORS[it.kind]}`}>{ICONS[it.kind]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">{it.title}</p>
                      {it.subtitle && <p className="truncate text-xs text-muted-foreground">{it.subtitle}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
