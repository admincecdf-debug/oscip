"use client";
import React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Printer, FileDown, Calendar, MapPin, Users, Sparkles,
  AlertTriangle, Lock, Clock, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMonthlyReportFull, useCells, useAllMembers } from "@/hooks/use-queries";
import type { MonthlyReportWeek } from "@/types/domain";

const WEEKDAYS_PT: Record<string, string> = {
  domingo: "Domingo", segunda: "Segunda-feira", terca: "Terça-feira",
  quarta: "Quarta-feira", quinta: "Quinta-feira", sexta: "Sexta-feira", sabado: "Sábado",
};

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const WEEK_FIELDS: { key: keyof MonthlyReportWeek; label: string; money?: boolean }[] = [
  { key: "num_membros",           label: "Nº de Membros" },
  { key: "memb_c_discipuladores", label: "Membros c/ discipuladores" },
  { key: "mda_15_dias",           label: "MDA 15 dias" },
  { key: "ge",                    label: "GE (Grupo de Evangelismo)" },
  { key: "visitantes",            label: "Visitantes" },
  { key: "oferta_pix",            label: "Oferta PIX", money: true },
  { key: "oferta_especie",        label: "Oferta em espécie", money: true },
  { key: "ebd",                   label: "EBD" },
  { key: "cc",                    label: "C.C" },
  { key: "cel",                   label: "CEL" },
  { key: "kg_amor",               label: "KG do Amor (kg)" },
];

export function MonthlyReportDetailView({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { data: full, isLoading, error } = useMonthlyReportFull(reportId);
  const { data: cells = [] } = useCells();
  const { data: allMembers = [] } = useAllMembers();

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-navy-50">
        <p className="text-sm text-muted">Carregando relatório…</p>
      </main>
    );
  }
  if (error || !full) {
    return (
      <main className="grid min-h-screen place-items-center bg-navy-50 p-5">
        <div className="rounded-lg border bg-card p-6 text-center max-w-md">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-3 font-display text-lg text-navy">Relatório não encontrado</p>
          <p className="mt-1 text-sm text-muted">O relatório pode ter sido apagado ou você não tem permissão para vê-lo.</p>
          <Button onClick={() => router.back()} className="mt-4 gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button>
        </div>
      </main>
    );
  }

  const { report, weeks, members } = full;
  const cell = cells.find(c => c.id === report.life_group_id) ?? null;
  const leaderMember = cell?.leader_id ? allMembers.find(m => m.id === cell.leader_id) : null;
  const memberMap = new Map(allMembers.map(m => [m.id, m]));

  const totals: Record<string, number> = {};
  WEEK_FIELDS.forEach(f => {
    totals[f.key as string] = weeks.reduce((s, w) => s + Number(w[f.key] ?? 0), 0);
  });

  function handlePrint() { window.print(); }
  function handleExportPdf() {
    alert("No diálogo que vai abrir, escolha o destino \"Salvar como PDF\" (em vez da impressora) para baixar o relatório como arquivo PDF.");
    window.print();
  }

  return (
    <main className="min-h-screen bg-navy-50 print:bg-white">
      {/* Estilos para impressão */}
      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 1cm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .report-page { box-shadow: none !important; border: none !important; max-width: 100% !important; }
        }
      `}</style>

      {/* Barra de ações (oculta na impressão) */}
      <div className="no-print sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Button onClick={() => router.back()} variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />Voltar
          </Button>
          <div className="flex gap-2">
            <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5">
              <Printer className="h-4 w-4" />Imprimir
            </Button>
            <Button onClick={handleExportPdf} size="sm" className="gap-1.5">
              <FileDown className="h-4 w-4" />Exportar PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo do relatório */}
      <article className="report-page mx-auto my-6 max-w-6xl rounded-lg border bg-card px-8 py-8 shadow-sm print:m-0 print:p-0 print:shadow-none">
        {/* Cabeçalho */}
        <header className="mb-6 border-b pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-gold">CEC FAMILY · Relatório Mensal</p>
              <h1 className="mt-1 font-display text-3xl text-navy">{cell?.name ?? "Life Group"}</h1>
              <div className="mt-3 grid gap-1 text-sm text-muted">
                {leaderMember && (
                  <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Líder: <b className="text-navy">{leaderMember.full_name}</b></div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {MONTHS[report.month - 1]} de {report.year}
                </div>
                {cell?.meeting_weekday && cell?.meeting_time && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />Reunião regular: {WEEKDAYS_PT[cell.meeting_weekday] ?? cell.meeting_weekday} às {cell.meeting_time.slice(0, 5)}
                  </div>
                )}
                {cell?.address && (
                  <div className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{cell.address}</div>
                )}
                {report.nucleo && (
                  <div className="flex items-center gap-1.5">Núcleo: <b className="text-navy">{report.nucleo}</b></div>
                )}
              </div>
            </div>
            <StatusBadge closed={!!report.closed_at} />
          </div>
        </header>

        {/* Indicadores principais (4 cards) */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Nº de Membros" value={totals["num_membros"] ?? 0} icon={<Users />} />
          <Stat label="Visitantes" value={totals["visitantes"] ?? 0} icon={<Sparkles />} accent="gold" />
          <Stat label="GE realizados" value={totals["ge"] ?? 0} icon={<Sparkles />} accent="green" />
          <Stat label="MDA 15 dias" value={totals["mda_15_dias"] ?? 0} icon={<Users />} accent="red" />
        </section>

        <div className="mt-2 mb-6 grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border bg-card p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted">Oferta PIX (mês)</p>
            <p className="text-xl font-bold text-navy">R$ {(totals["oferta_pix"] ?? 0).toFixed(2).replace(".", ",")}</p>
          </div>
          <div className="rounded-md border bg-card p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted">Oferta em espécie (mês)</p>
            <p className="text-xl font-bold text-navy">R$ {(totals["oferta_especie"] ?? 0).toFixed(2).replace(".", ",")}</p>
          </div>
          <div className="rounded-md border bg-card p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted">KG do Amor (mês)</p>
            <p className="text-xl font-bold text-navy">{(totals["kg_amor"] ?? 0).toFixed(1).replace(".", ",")} kg</p>
          </div>
        </div>

        {/* Indicadores por semana */}
        <Section icon={<BarChart3 />} title="Indicadores por semana">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2 text-xs uppercase text-muted">Indicador</th>
                  {weeks.map(w => (
                    <th key={w.id} className="p-2 text-center text-xs font-bold uppercase text-navy">{w.week_number}ª</th>
                  ))}
                  <th className="p-2 text-right text-xs uppercase text-muted">Total</th>
                </tr>
              </thead>
              <tbody>
                {WEEK_FIELDS.map(f => (
                  <tr key={f.key} className="border-b">
                    <td className="p-2 text-xs font-semibold text-navy">{f.label}</td>
                    {weeks.map(w => (
                      <td key={w.id} className="p-2 text-center text-xs">
                        {f.money ? Number(w[f.key] ?? 0).toFixed(2) : Number(w[f.key] ?? 0)}
                      </td>
                    ))}
                    <td className="p-2 text-right text-xs font-bold text-navy">
                      {f.money ? (totals[f.key as string] ?? 0).toFixed(2) : (totals[f.key as string] ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Membros × Semana */}
        {members.length > 0 && (
          <Section icon={<Users />} title={`Membros × Semana — MDA / CC / CEL (${members.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th rowSpan={2} className="p-2 align-bottom text-xs uppercase text-muted">Membro</th>
                    {[1,2,3,4,5].map(n => (
                      <th key={n} colSpan={3} className="border-l p-1 text-center text-xs font-bold text-navy">{n}ª sem.</th>
                    ))}
                  </tr>
                  <tr className="border-b text-[10px] uppercase text-muted">
                    {[1,2,3,4,5].flatMap(n => [
                      <th key={`${n}-mda`} className="border-l p-1 text-center">MDA</th>,
                      <th key={`${n}-cc`}  className="p-1 text-center">CC</th>,
                      <th key={`${n}-cel`} className="p-1 text-center">CEL</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {members.map(memb => {
                    const member = memberMap.get(memb.member_id);
                    return (
                      <tr key={memb.id} className="border-b">
                        <td className="p-2 text-xs font-semibold text-navy">{member?.full_name ?? "—"}</td>
                        {[1,2,3,4,5].map(n => {
                          const w = memb.weeks.find(x => x.week_number === n);
                          return (
                            <React.Fragment key={`${memb.id}-${n}`}>
                              <td className="border-l p-1 text-center text-xs">{w ? w.mda : "—"}</td>
                              <td className="p-1 text-center text-xs">{w ? w.cc : "—"}</td>
                              <td className="p-1 text-center text-xs">{w ? w.cel : "—"}</td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Rodapé */}
        <footer className="mt-8 border-t pt-3 text-center text-[10px] text-muted">
          Relatório mensal gerado pelo CEC FAMILY · Consolidado em {new Date(report.created_at).toLocaleString("pt-BR")}
        </footer>
      </article>
    </main>
  );
}

// ============================================================
// Subcomponentes
// ============================================================
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy-600">
        <span className="text-gold">{icon}</span>{title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: "gold"|"green"|"red" }) {
  const accentClass = accent === "gold" ? "border-gold/40 bg-gold/5"
                    : accent === "green" ? "border-green-200 bg-green-50"
                    : accent === "red" ? "border-red-200 bg-red-50"
                    : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-3 ${accentClass}`}>
      <div className="flex items-center gap-2">
        <span className="text-gold [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      </div>
      <p className="mt-1 font-display text-3xl text-navy">{value}</p>
    </div>
  );
}

function StatusBadge({ closed }: { closed: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
      closed ? "border-navy/30 bg-navy/10 text-navy" : "border-yellow-300 bg-yellow-50 text-yellow-700"
    }`}>
      {closed ? <Lock className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {closed ? "Fechado" : "Em aberto"}
    </span>
  );
}
