"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, FileDown, Calendar, Users, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRelmdaReportFull, useCells } from "@/hooks/use-queries";
import type { RelmdaStatus } from "@/types/domain";

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const STATUS_LABELS: Record<RelmdaStatus, string> = {
  rascunho: "Rascunho", enviado: "Enviado", em_analise: "Em análise",
  correcao_solicitada: "Correção solicitada", corrigido: "Corrigido", validado: "Validado", encerrado: "Encerrado",
};

export function RelmdaReportPrintView({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { data: full, isLoading, error } = useRelmdaReportFull(reportId);
  const { data: cells = [] } = useCells();

  if (isLoading) return <main className="grid min-h-screen place-items-center bg-navy-50"><p className="text-sm text-muted-foreground">Carregando relatório…</p></main>;
  if (error || !full) {
    return (
      <main className="grid min-h-screen place-items-center bg-navy-50 p-5">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-3 font-display text-lg text-navy">Relatório não encontrado</p>
          <Button onClick={() => router.back()} className="mt-4 gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button>
        </div>
      </main>
    );
  }

  const { report, attendance, visitors, needs, snapshot } = full;
  const cell = cells.find((c) => c.id === report.life_group_id) ?? null;
  const presentes = attendance.filter((a) => a.present).length;

  return (
    <main className="min-h-screen bg-navy-50 print:bg-white">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 1.5cm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .report-page { box-shadow: none !important; border: none !important; max-width: 100% !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Button onClick={() => router.back()} variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" />Voltar</Button>
          <div className="flex gap-2">
            <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-1.5"><Printer className="h-4 w-4" />Imprimir</Button>
            <Button onClick={() => { alert('No diálogo que vai abrir, escolha "Salvar como PDF" em vez da impressora.'); window.print(); }} size="sm" className="gap-1.5"><FileDown className="h-4 w-4" />Exportar PDF</Button>
          </div>
        </div>
      </div>

      <article className="report-page mx-auto my-6 max-w-3xl rounded-lg border bg-card px-8 py-8 shadow-sm print:m-0 print:p-0 print:shadow-none">
        <header className="mb-6 border-b pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-gold">CEC FAMILY · Relatório Semanal RELMDA</p>
              <h1 className="mt-1 font-display text-2xl text-navy">{cell?.name ?? report.life_group_id}</h1>
              <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />{report.week_number}ª semana de {MONTH_NAMES[report.month - 1]}/{report.year}
                {report.reference_date && ` · ${new Date(report.reference_date).toLocaleDateString("pt-BR")}`}
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-navy/30 bg-navy/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-navy">
              <Lock className="h-3 w-3" />{STATUS_LABELS[report.status]}
            </span>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Stat label="Membros" value={snapshot.total_members} />
          <Stat label="Presentes" value={presentes} />
          <Stat label="Visitantes" value={visitors.length} />
          <Stat label="MDA" value={report.mda_count} />
          <Stat label="GE" value={report.ge_count} />
          <Stat label="TADEL" value={report.tadel_count} />
        </section>

        <div className="mb-6 grid gap-2 sm:grid-cols-3">
          <MoneyStat label="Oferta PIX" value={report.offering_pix} />
          <MoneyStat label="Oferta espécie" value={report.offering_especie} />
          <MoneyStat label="Oferta total" value={report.offering_total} highlight />
        </div>

        <Section title="Encontro">
          <p className="text-sm"><b className="text-navy">Aconteceu:</b> {report.happened ? "Sim" : `Não (${report.no_meeting_reason ?? "sem motivo"})`}</p>
          {report.topic && <p className="text-sm"><b className="text-navy">Tema:</b> {report.topic}</p>}
          {report.bible_text && <p className="text-sm"><b className="text-navy">Texto bíblico:</b> {report.bible_text}</p>}
          {report.flow && <p className="text-sm"><b className="text-navy">Avaliação:</b> {report.flow}</p>}
          {report.summary && <p className="mt-1 text-sm text-muted-foreground">{report.summary}</p>}
        </Section>

        <Section title="Discipulado e EMP">
          <p className="text-sm">MDA: {report.mda_count} · Novos discipulados: {report.new_discipleships} · Interrompidos: {report.interrupted_discipleships}</p>
          <p className="text-sm">EMP — participantes: {report.emp_participants} · ocorrências: {report.emp_occurrences}</p>
        </Section>

        <Section title="Ação Social">
          <p className="text-sm">Kg do Amor: {report.kg_amor} kg · Cestas completas: {report.cestas_completas}</p>
        </Section>

        {visitors.length > 0 && (
          <Section title={`Visitantes (${visitors.length})`}>
            <ul className="space-y-1 text-sm">
              {visitors.map((v) => <li key={v.id}>{v.full_name}{v.first_visit && " · 1ª visita"}</li>)}
            </ul>
          </Section>
        )}

        {needs.length > 0 && (
          <Section title="Necessidades pastorais">
            <ul className="space-y-1 text-sm">
              {needs.map((n) => <li key={n.id}>{n.need_type ?? "Necessidade"} {n.urgent_prayer && "· Oração urgente"} {n.pastoral_visit && "· Visita pastoral"} — {n.description ?? "sem descrição"}</li>)}
            </ul>
          </Section>
        )}

        {report.supervisor_note && (
          <Section title="Observação da supervisão">
            <p className="text-sm text-muted-foreground">{report.supervisor_note}</p>
          </Section>
        )}

        <footer className="mt-8 flex items-center gap-1.5 border-t pt-3 text-[10px] text-muted-foreground">
          <Users className="h-3 w-3" />Relatório gerado pelo CEC FAMILY em {new Date().toLocaleString("pt-BR")}
        </footer>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-navy-600">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-2 text-center">
      <p className="font-display text-xl font-bold text-navy">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function MoneyStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-2 text-center ${highlight ? "border-gold/40 bg-gold/5" : ""}`}>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-navy">R$ {value.toFixed(2).replace(".", ",")}</p>
    </div>
  );
}
