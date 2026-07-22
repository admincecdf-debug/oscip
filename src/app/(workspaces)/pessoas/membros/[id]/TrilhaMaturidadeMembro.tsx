"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMyTimeline } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import * as Tl from "@/services/timeline";
import { MATURITY_MILESTONES, type MaturityMilestone } from "@/lib/maturity-milestones";

/**
 * ADR-001 — Fase 1: Trilha de Maturidade.
 * Deriva o status de cada marco a partir da pastoral_timeline (milestone_key).
 * Ainda não bloqueia nada (isso é Fase 3) — só torna visível e registrável.
 */
export function TrilhaMaturidadeMembro({ memberId }: { memberId: string }) {
  const { data: events = [], isLoading } = useMyTimeline(memberId);
  const [registering, setRegistering] = useState<MaturityMilestone | null>(null);

  const completedByKey = new Map(
    events.filter(e => e.milestone_key).map(e => [e.milestone_key as string, e])
  );

  if (isLoading) return <p className="py-8 text-center text-sm italic text-muted">Carregando trilha de maturidade…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trilha de Maturidade</CardTitle>
        <CardDescription>Marcos que preparam o membro para assumir responsabilidades (ADR-001).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {MATURITY_MILESTONES.map((m) => {
          const done = completedByKey.get(m.key);
          return (
            <div key={m.key} className={`flex items-center justify-between gap-3 rounded-md border p-3 ${done ? "bg-green-50/50" : ""}`}>
              <div className="flex items-center gap-2.5">
                {done ? <CheckCircle2 className="h-4.5 w-4.5 text-green-600" /> : <Circle className="h-4.5 w-4.5 text-muted-foreground" />}
                <div>
                  <p className={`text-sm font-medium ${done ? "text-green-800" : "text-navy"}`}>{m.label}</p>
                  {done && <p className="text-xs text-muted-foreground">Concluído em {new Date(done.event_date).toLocaleDateString("pt-BR")}</p>}
                </div>
              </div>
              {!done && (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setRegistering(m)}>
                  <Plus className="h-3.5 w-3.5" /> Registrar
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>

      {registering && (
        <RegisterMilestoneDialog
          memberId={memberId}
          milestone={registering}
          onClose={() => setRegistering(null)}
        />
      )}
    </Card>
  );
}

function RegisterMilestoneDialog({ memberId, milestone, onClose }: {
  memberId: string; milestone: MaturityMilestone; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    setBusy(true); setErr("");
    try {
      await Tl.registerMilestone(supabase, {
        member_id: memberId,
        milestone_key: milestone.key,
        event_type: milestone.event_type,
        title: milestone.label,
        event_date: eventDate,
        description: notes || null,
      });
      qc.invalidateQueries({ queryKey: ["my-timeline", memberId] });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao registrar marco.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Registrar: {milestone.label}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Data</Label>
            <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          </div>
          <div><Label className="text-xs">Observação (opcional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Ex: Turma de março/2026" />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={busy}>{busy ? "Salvando…" : "Confirmar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
