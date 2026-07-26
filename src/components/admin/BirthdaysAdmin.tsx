"use client";
import { useState } from "react";
import { Cake, Phone, Mail, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBirthdaysToday, useBirthdaysMonth, useBirthdaysUpcoming, useChurches } from "@/hooks/use-queries";
import type { BirthdayMember } from "@/types/domain";
import { TEMPLATE_ANIVERSARIO, buildWhatsAppLink } from "@/lib/whatsapp-templates";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function BirthdayCard({ m, showDays }: { m: BirthdayMember; showDays?: boolean }) {
  const hoje = m.dias_ate_aniversario === 0 || m.dias_restantes === 0;

  return (
    <Card className={`border-l-4 ${hoje ? "border-l-[#C9A227] bg-amber-50/30" : "border-l-blue-300"}`}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl
              ${hoje ? "bg-[#C9A227] text-white" : "bg-blue-100 text-blue-600"}`}>
              {hoje ? "🎂" : "🎁"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[#0E2A47]">{m.full_name}</span>
                {hoje && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#C9A227] text-white font-bold animate-pulse">
                    Hoje! 🎉
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {m.idade} anos
                </span>
              </div>
              <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-muted-foreground">
                {m.lg_name && <span>🔥 {m.lg_name}</span>}
                {m.church_name && <span>⛪ {m.church_name}</span>}
                {showDays && m.dias_restantes !== undefined && m.dias_restantes > 0 && (
                  <span className="text-blue-600 font-semibold">em {m.dias_restantes} dia(s)</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0 text-right">
            {m.phone && (
              <a
                href={buildWhatsAppLink(m.phone, TEMPLATE_ANIVERSARIO(m.full_name))}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 rounded-md border border-green-300 bg-green-50 px-2 py-1 text-xs font-bold text-green-800 hover:bg-green-100"
              >
                🎉 Parabenizar
              </a>
            )}
            {m.phone && (
              <a href={`https://wa.me/${m.phone.replace(/\D/g, "")}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                <Phone className="h-3 w-3" />{m.phone}
              </a>
            )}
            {m.email && (
              <a href={`mailto:${m.email}`}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Mail className="h-3 w-3" />{m.email}
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Aba Hoje ──────────────────────────────────────────────────
function TodayTab({ churchFilter }: { churchFilter: string }) {
  const { data: today = [], isLoading } = useBirthdaysToday(churchFilter || undefined);

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Verificando…</p>;

  return (
    <div className="space-y-3">
      {today.length === 0 ? (
        <div className="py-12 text-center">
          <Cake className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="font-semibold text-[#0E2A47]">Nenhum aniversariante hoje</p>
          <p className="text-sm text-muted-foreground mt-1">Aproveite para verificar os próximos!</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-center gap-2">
            <Cake className="h-4 w-4 shrink-0" />
            <span><strong>{today.length} membro(s)</strong> fazem aniversário hoje! 🎉</span>
          </div>
          {today.map(m => <BirthdayCard key={m.id} m={m} />)}
        </>
      )}
    </div>
  );
}

// ── Aba Mês ───────────────────────────────────────────────────
function MonthTab({ churchFilter }: { churchFilter: string }) {
  const mesAtual = new Date().getMonth();
  const { data: month = [], isLoading } = useBirthdaysMonth({ churchId: churchFilter || undefined });

  // Agrupar por dia
  const byDay: Record<number, BirthdayMember[]> = {};
  month.forEach(m => {
    const dia = m.dia ?? 0;
    if (!byDay[dia]) byDay[dia] = [];
    byDay[dia].push(m);
  });

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Cake className="h-4 w-4 text-[#C9A227]" />
        <p className="text-sm font-medium text-[#0E2A47]">
          {month.length} aniversariante(s) em {MONTHS[mesAtual]}
        </p>
      </div>

      {month.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum aniversariante este mês.</p>
      ) : (
        Object.entries(byDay)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([dia, membros]) => (
            <div key={dia}>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-full bg-[#0E2A47] text-white text-xs font-bold flex items-center justify-center">
                  {dia}
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {dia} de {MONTHS[mesAtual]}
                </span>
              </div>
              <div className="space-y-2 pl-9">
                {membros.map(m => <BirthdayCard key={m.id} m={m} />)}
              </div>
            </div>
          ))
      )}
    </div>
  );
}

// ── Aba Próximos 30 dias ──────────────────────────────────────
function UpcomingTab({ churchFilter }: { churchFilter: string }) {
  const { data: upcoming = [], isLoading } = useBirthdaysUpcoming(churchFilter || undefined);

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-3">
      {upcoming.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum aniversariante nos próximos 30 dias.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {upcoming.length} aniversariante(s) nos próximos 30 dias
          </p>
          {upcoming.map(m => <BirthdayCard key={m.id} m={m} showDays />)}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MASTER — BirthdaysAdmin
// ══════════════════════════════════════════════════════════════
export function BirthdaysAdmin() {
  const { data: churches = [] } = useChurches();
  const [churchFilter, setChurchFilter] = useState("");

  const { data: today = [] } = useBirthdaysToday(churchFilter || undefined);

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Cake className="h-6 w-6 text-[#C9A227]" />
          <div>
            <h2 className="text-xl font-bold text-[#0E2A47]">Aniversariantes</h2>
            <p className="text-xs text-muted-foreground">Hoje · Mês atual · Próximos 30 dias</p>
          </div>
        </div>
        <Select value={churchFilter || "todas"} onValueChange={v => setChurchFilter(v === "todas" ? "" : v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todas as comunidades" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {churches.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today" className="gap-1.5">
            🎂 Hoje
            {today.length > 0 && (
              <span className="ml-1 rounded-full bg-[#C9A227] text-white text-xs px-1.5 py-0.5 font-bold animate-pulse">
                {today.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="month">📅 Este Mês</TabsTrigger>
          <TabsTrigger value="upcoming">🔜 Próximos 30 dias</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="today"><TodayTab churchFilter={churchFilter} /></TabsContent>
          <TabsContent value="month"><MonthTab churchFilter={churchFilter} /></TabsContent>
          <TabsContent value="upcoming"><UpcomingTab churchFilter={churchFilter} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
