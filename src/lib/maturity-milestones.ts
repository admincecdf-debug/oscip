import type { TimelineEventType } from "@/types/domain";

/**
 * Marcos canônicos da Trilha de Maturidade (ADR-001, Pilar II).
 * Para adicionar um novo marco, só é preciso incluir uma linha aqui —
 * nenhuma migration nova é necessária (milestone_key é texto livre).
 */
export interface MaturityMilestone {
  key: string;
  label: string;
  event_type: TimelineEventType;
}

export const MATURITY_MILESTONES: MaturityMilestone[] = [
  { key: "encontro_com_deus", label: "Encontro com Deus", event_type: "encontro" },
  { key: "batismo",           label: "Batismo",            event_type: "batismo" },
  { key: "ctl",               label: "CTL — Curso de Treinamento de Líderes", event_type: "curso" },
  { key: "escola_lideres",    label: "Escola de Líderes",  event_type: "curso" },
];

export function milestoneLabel(key: string): string {
  return MATURITY_MILESTONES.find(m => m.key === key)?.label ?? key;
}
