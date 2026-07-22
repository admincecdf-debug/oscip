"use client";
import Link from "next/link";
import { Network, ChevronUp, ChevronDown, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useDiscipleshipChainUp, useDisciplesWithNames } from "@/hooks/use-queries";

/**
 * UX-003 §6.59 — Mapa de Relacionamentos. Mostra a cadeia de
 * discipulado: sobe até quem discipula (e quem discipula quem
 * discipula...) e desce até os discípulos diretos.
 */
export function RedeRelacionamentosMembro({ memberId, memberName }: { memberId: string; memberName: string }) {
  const { data: chainUp = [] } = useDiscipleshipChainUp(memberId);
  const { data: disciples = [] } = useDisciplesWithNames(memberId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Network className="h-4 w-4 text-gold" />Rede de Relacionamentos</CardTitle>
        <CardDescription>Cadeia de discipulado e liderança ao redor desta pessoa.</CardDescription>
      </CardHeader>
      <CardContent>
        {chainUp.length === 0 && disciples.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">Sem vínculos de discipulado registrados ainda.</p>
        ) : (
          <div className="flex flex-col items-center gap-1">
            {chainUp.length > 0 && <ChevronUp className="h-4 w-4 text-muted-foreground" />}
            {chainUp.map((c) => (
              <div key={c.member_id} className="flex flex-col items-center">
                <Link href={`/pessoas/membros/${c.member_id}`} className="rounded-md border bg-muted/40 px-3 py-1.5 text-xs font-medium text-navy hover:bg-muted">
                  {c.full_name}
                </Link>
                <div className="h-3 w-px bg-border" />
              </div>
            ))}

            <div className="flex items-center gap-1.5 rounded-md border-2 border-gold bg-gold/10 px-4 py-2 text-sm font-bold text-navy">
              <User className="h-4 w-4" /> {memberName}
            </div>

            {disciples.length > 0 && (
              <>
                <div className="h-3 w-px bg-border" />
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {disciples.map((d) => (
                    <Link key={d.member_id} href={`/pessoas/membros/${d.member_id}`} className="rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-navy shadow-sm hover:shadow-md">
                      {d.full_name}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
