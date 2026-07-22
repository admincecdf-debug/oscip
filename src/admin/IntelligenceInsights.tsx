"use client";
import { Brain, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGrowthBySector, useGrowthOverall } from "@/hooks/use-queries";

/**
 * UX-003 Cap. 3 Parte 3 — Inteligência Ministerial. Transforma
 * números em frases: compara o crescimento de cada Setor nos
 * últimos 6 meses com a média geral da Comunidade, destacando os
 * que mais se distanciaram (pra cima ou pra baixo).
 */
export function IntelligenceInsights() {
  const { data: bySector = [], isLoading: l1 } = useGrowthBySector();
  const { data: overall, isLoading: l2 } = useGrowthOverall();

  if (l1 || l2) return null;
  if (!overall || overall.growth_pct === null || bySector.length === 0) return null;

  const media = overall.growth_pct;
  const withGrowth = bySector.filter((s) => s.growth_pct !== null);
  const destaquePositivo = withGrowth.filter((s) => (s.growth_pct as number) > media).sort((a, b) => (b.growth_pct as number) - (a.growth_pct as number))[0];
  const destaqueNegativo = withGrowth.filter((s) => (s.growth_pct as number) < media).sort((a, b) => (a.growth_pct as number) - (b.growth_pct as number))[0];

  const insights: { icon: React.ReactNode; text: string; positive: boolean }[] = [];

  if (destaquePositivo) {
    const diff = ((destaquePositivo.growth_pct as number) - media).toFixed(0);
    insights.push({
      icon: <TrendingUp className="h-4 w-4" />,
      text: `O Setor ${destaquePositivo.sector_name} apresentou crescimento de ${destaquePositivo.growth_pct}% no número de membros nos últimos seis meses, ${Number(diff) > 0 ? `superando a média da Comunidade em ${diff} pontos percentuais` : "acompanhando a média da Comunidade"}.`,
      positive: true,
    });
  }

  if (destaqueNegativo && destaqueNegativo.sector_id !== destaquePositivo?.sector_id) {
    insights.push({
      icon: <TrendingDown className="h-4 w-4" />,
      text: `O Setor ${destaqueNegativo.sector_name} teve variação de ${destaqueNegativo.growth_pct}% no número de membros nos últimos seis meses, abaixo da média da Comunidade (${media}%). Pode valer um olhar mais de perto.`,
      positive: false,
    });
  }

  insights.push({
    icon: <Brain className="h-4 w-4" />,
    text: `A Comunidade como um todo teve variação de ${media}% no número de membros nos últimos seis meses, na comparação com o semestre anterior.`,
    positive: media >= 0,
  });

  if (insights.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-purple-500 bg-purple-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4 text-purple-600" />Inteligência Ministerial</CardTitle>
        <CardDescription>Interpretações automáticas — apoiam a avaliação da liderança, sem substituí-la.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((it, i) => (
          <div key={i} className="flex items-start gap-2.5 rounded-md border bg-card p-3">
            <span className={`mt-0.5 shrink-0 ${it.positive ? "text-green-600" : "text-amber-600"}`}>{it.icon}</span>
            <p className="text-sm italic text-navy">"{it.text}"</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
