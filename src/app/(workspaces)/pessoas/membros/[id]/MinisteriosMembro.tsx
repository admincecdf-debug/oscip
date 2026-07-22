"use client";
import { Mic2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMinistriesByMember } from "@/hooks/use-queries";

const ROLE_LABELS: Record<string, string> = {
  lider: "Líder", vice_lider: "Vice-líder", membro: "Membro", voluntario: "Voluntário",
};

export function MinisteriosMembro({ memberId }: { memberId: string }) {
  const { data: ministries = [], isLoading } = useMinistriesByMember(memberId);

  if (isLoading) return <p className="py-8 text-center text-sm italic text-muted-foreground">Carregando ministérios…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mic2 className="h-4 w-4 text-gold" />Experiência ministerial</CardTitle>
      </CardHeader>
      <CardContent>
        {ministries.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">Não faz parte de nenhum ministério ainda.</p>
        ) : (
          <div className="space-y-2">
            {ministries.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-semibold text-navy">{m.ministry_name}</p>
                  <p className="text-xs text-muted-foreground">Desde {new Date(m.joined_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!m.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Inativo</span>}
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase text-navy">{ROLE_LABELS[m.role] ?? m.role}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
