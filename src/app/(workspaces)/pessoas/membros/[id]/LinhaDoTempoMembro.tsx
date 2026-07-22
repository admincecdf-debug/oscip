"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMyTimeline } from "@/hooks/use-queries";

const EVENT_LABELS: Record<string, string> = {
  conversao: "Conversão", batismo: "Batismo", consolidacao: "Consolidação",
  discipulado: "Discipulado", curso: "Curso", ministerio: "Ministério",
  encontro: "Encontro", mudanca_etapa: "Mudança de etapa", observacao: "Observação",
};

export function LinhaDoTempoMembro({ memberId }: { memberId: string }) {
  const { data: events = [], isLoading } = useMyTimeline(memberId);

  if (isLoading) return <p className="py-8 text-center text-sm italic text-muted">Carregando linha do tempo…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linha do tempo pastoral</CardTitle>
        <CardDescription>Marcos da jornada deste membro.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm italic text-muted">Nenhum evento registrado ainda.</p>
        ) : (
          <ol className="space-y-3 border-l-2 border-gold/30 pl-4">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-gold" />
                <p className="text-xs text-muted">{new Date(e.event_date).toLocaleDateString("pt-BR")}</p>
                <p className="text-sm font-semibold text-navy">
                  <span className="mr-2 rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-navy-600">
                    {EVENT_LABELS[e.event_type] ?? e.event_type}
                  </span>
                  {e.title}
                </p>
                {e.description && <p className="text-sm text-muted">{e.description}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
