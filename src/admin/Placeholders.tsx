import { Card, CardContent } from "@/components/ui/card";

/**
 * Extraído de AdminPanel.tsx. Backend do módulo C17 (ministry_goals) já existe
 * em services/goals.ts — só falta construir a UI real. Enquanto isso não
 * acontece, este placeholder é reaproveitado tanto em /admin quanto em
 * /executivo/metas.
 */
export function MetasPlaceholder() {
  return (
    <Card>
      <CardContent className="pt-8 pb-8 text-center">
        <p className="text-2xl mb-2">🎯</p>
        <h2 className="font-display text-xl text-navy">Central de Metas</h2>
        <p className="mt-2 text-sm text-muted">Módulo C17 — disponível neste painel.</p>
      </CardContent>
    </Card>
  );
}
