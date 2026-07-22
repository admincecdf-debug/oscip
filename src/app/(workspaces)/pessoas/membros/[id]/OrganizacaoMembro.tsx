"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin, ArrowRight } from "lucide-react";
import { useMemberRelocations, useChurchStateName } from "@/hooks/use-queries";
import type { Member } from "@/types/domain";

export function OrganizacaoMembro({ member }: { member: Member }) {
  const { data: relocations = [], isLoading } = useMemberRelocations(member.id);
  const { data: stateName } = useChurchStateName(member.church_id ?? null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gold" />Posição organizacional atual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-navy">
            {stateName && <span className="text-muted-foreground">{stateName} → </span>}
            <span className="font-semibold">Igreja Local</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">A árvore territorial completa (Núcleo/Distrito/Setor) pode ser vista na ficha da Igreja.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de movimentações</CardTitle>
          <CardDescription>Transferências entre igrejas e Life Groups.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm italic text-muted-foreground">Carregando…</p>
          ) : relocations.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">Nenhuma movimentação registrada — está na mesma unidade desde o cadastro.</p>
          ) : (
            <div className="space-y-3">
              {relocations.map((r) => (
                <div key={r.id} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")} · {r.reason}</p>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <span className="text-navy">{r.from_church_name ?? "—"}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-gold" />
                    <span className="font-semibold text-navy">{r.to_church_name ?? "—"}</span>
                  </div>
                  {r.notes && <p className="mt-1 text-xs italic text-muted-foreground">"{r.notes}"</p>}
                  {r.performed_by_name && <p className="mt-1 text-[11px] text-muted-foreground">Realizado por {r.performed_by_name}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
