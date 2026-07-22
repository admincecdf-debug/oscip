"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMyActiveDiscipleship, useMyDisciples, useAllMembers } from "@/hooks/use-queries";

export function DiscipuladoMembro({ memberId }: { memberId: string }) {
  const { data: activeDiscipleship, isLoading: loadingActive } = useMyActiveDiscipleship(memberId);
  const { data: disciples = [], isLoading: loadingDisciples } = useMyDisciples(memberId);
  const { data: members = [] } = useAllMembers();

  const memberName = (id: string) => members.find((m) => m.id === id)?.full_name ?? "—";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sendo discipulado por</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingActive ? (
            <p className="text-sm italic text-muted">Carregando…</p>
          ) : activeDiscipleship ? (
            <div className="rounded-md border p-3">
              <p className="font-semibold text-navy">{activeDiscipleship.discipler?.full_name ?? "—"}</p>
              <p className="text-xs text-muted">
                Desde {new Date(activeDiscipleship.disc.started_on).toLocaleDateString("pt-BR")}
                {activeDiscipleship.disc.current_module ? ` · Módulo: ${activeDiscipleship.disc.current_module}` : ""}
              </p>
              {activeDiscipleship.disc.notes && <p className="mt-1 text-sm text-muted">{activeDiscipleship.disc.notes}</p>}
            </div>
          ) : (
            <p className="text-sm italic text-muted">Sem discipulado ativo no momento.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discípulos deste membro</CardTitle>
          <CardDescription>Pessoas atualmente sendo discipuladas por ele(a).</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDisciples ? (
            <p className="text-sm italic text-muted">Carregando…</p>
          ) : disciples.length === 0 ? (
            <p className="text-sm italic text-muted">Nenhum discípulo ativo no momento.</p>
          ) : (
            <ul className="space-y-2">
              {disciples.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span className="font-medium text-navy">{memberName(d.disciple_id)}</span>
                  <span className="text-xs text-muted">
                    Desde {new Date(d.started_on).toLocaleDateString("pt-BR")}
                    {d.current_module ? ` · ${d.current_module}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
