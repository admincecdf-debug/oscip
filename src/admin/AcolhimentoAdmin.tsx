"use client";
import { useState } from "react";
import { LifeBuoy, UserPlus, PhoneOff, Users as UsersIcon, Heart, Droplets, Sprout, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAcolhimento, useChurches } from "@/hooks/use-queries";
import { PipelineCard } from "./CrmPipelineAdmin";
import type { Church } from "@/types/domain";

const SEGMENTS = [
  { key: "novos",             label: "Novos cadastros",  icon: UserPlus,        description: "Acabaram de se cadastrar" },
  { key: "sem_contato",       label: "Sem contato",      icon: PhoneOff,        description: "Aguardam primeiro contato pastoral" },
  { key: "sem_lifegroup",     label: "Sem Life Group",   icon: UsersIcon,       description: "Contatados, mas ainda sem célula" },
  { key: "sem_discipulador",  label: "Sem discipulador", icon: Heart,           description: "Participam, mas sem discipulado" },
  { key: "sem_batismo",       label: "Sem batismo",      icon: Droplets,        description: "Em consolidação ou discipulado, ainda não batizados" },
  { key: "em_consolidacao",   label: "Em consolidação",  icon: Sprout,          description: "Processo de consolidação ativo" },
  { key: "integrados",        label: "Integrados",       icon: CheckCircle2,    description: "Batizados, membros, servos e líderes" },
] as const;

type SegmentKey = typeof SEGMENTS[number]["key"];

export function AcolhimentoAdmin() {
  const [seg, setSeg] = useState<SegmentKey>("novos");
  const { data: churches = [] } = useChurches();
  const churchMap = new Map(churches.map((c) => [c.id, c as Church]));

  // Contadores de cada segmento (chamadas paralelas dos hooks)
  const novos = useAcolhimento("novos").data ?? [];
  const semContato = useAcolhimento("sem_contato").data ?? [];
  const semLg = useAcolhimento("sem_lifegroup").data ?? [];
  const semDisc = useAcolhimento("sem_discipulador").data ?? [];
  const semBat = useAcolhimento("sem_batismo").data ?? [];
  const emCons = useAcolhimento("em_consolidacao").data ?? [];
  const integ = useAcolhimento("integrados").data ?? [];

  const counts: Record<SegmentKey, number> = {
    novos: novos.length,
    sem_contato: semContato.length,
    sem_lifegroup: semLg.length,
    sem_discipulador: semDisc.length,
    sem_batismo: semBat.length,
    em_consolidacao: emCons.length,
    integrados: integ.length,
  };

  const itemsBySeg: Record<SegmentKey, typeof novos> = {
    novos, sem_contato: semContato, sem_lifegroup: semLg,
    sem_discipulador: semDisc, sem_batismo: semBat,
    em_consolidacao: emCons, integrados: integ,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LifeBuoy className="h-5 w-5 text-gold" />Central de Acolhimento</CardTitle>
          <CardDescription>Segmentação dos visitantes por estágio do relacionamento pastoral</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
            {SEGMENTS.map((s) => {
              const Ico = s.icon;
              const selected = seg === s.key;
              const n = counts[s.key];
              return (
                <button key={s.key} onClick={() => setSeg(s.key)}
                  className={`rounded-xl border-2 p-3 text-left transition ${selected ? "border-gold bg-gold/5" : "border-border bg-card hover:border-navy/30"}`}>
                  <Ico className={`h-4 w-4 ${selected ? "text-gold" : "text-muted"}`} />
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted">{s.label}</p>
                  <b className={`block font-display text-xl ${n > 0 ? "text-navy" : "text-muted"}`}>{n}</b>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {SEGMENTS.find((s) => s.key === seg)?.label} ({itemsBySeg[seg].length})
          </CardTitle>
          <CardDescription>{SEGMENTS.find((s) => s.key === seg)?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {itemsBySeg[seg].length === 0 ? (
            <p className="text-sm italic text-muted">Nenhum visitante neste segmento.</p>
          ) : (
            <div className="space-y-2">
              {itemsBySeg[seg].map((it) => (
                <PipelineCard key={it.id} item={it} church={it.community_id ? churchMap.get(it.community_id) : undefined} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
