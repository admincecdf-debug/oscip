"use client";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMemberRecommendations } from "@/hooks/use-queries";
import { PRIORITY_CONFIG } from "@/services/recommendations";

/**
 * UX-003 §6.47/6.49 — Motor de Regras / Recomendações da Jornada.
 * Nunca substitui a decisão da liderança — só aponta situações que
 * podem merecer atenção.
 */
export function RecomendacoesMembro({ memberId }: { memberId: string }) {
  const { data: recs = [], isLoading } = useMemberRecommendations(memberId);

  if (isLoading || recs.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-purple-500 bg-purple-50/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-purple-600" />Recomendações da Jornada</CardTitle>
        <CardDescription>Sugestões automáticas — a decisão final é sempre da liderança.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {recs.map((r) => {
          const cfg = PRIORITY_CONFIG[r.priority];
          return (
            <div key={r.rule_key} className={`rounded-md border p-2.5 text-sm ${cfg.color}`}>
              {cfg.icon} {r.message}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
