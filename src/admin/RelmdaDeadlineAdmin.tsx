"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useChurches } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { saveDeadlineConfig } from "@/services/relmdaReports";
import type { RelmdaDeadlineConfig } from "@/types/domain";

const WEEKDAYS: [number, string][] = [
  [0,"Domingo"],[1,"Segunda-feira"],[2,"Terça-feira"],[3,"Quarta-feira"],[4,"Quinta-feira"],[5,"Sexta-feira"],[6,"Sábado"],
];

export function RelmdaDeadlineAdmin() {
  const qc = useQueryClient();
  const { data: churches = [] } = useChurches();
  const [churchId, setChurchId] = useState<string>(""); // "" = padrão global
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState("18:00");
  const [correctionDays, setCorrectionDays] = useState(1);
  const [reminderHours, setReminderHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true); setErr(""); setOk(false);
    try {
      const config: RelmdaDeadlineConfig = {
        church_id: churchId || null,
        deadline_weekday: weekday,
        deadline_time: time,
        correction_deadline_days: correctionDays,
        reminder_before_hours: reminderHours,
      };
      await saveDeadlineConfig(supabase, config);
      qc.invalidateQueries({ queryKey: ["relmda-deadline"] });
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Erro ao salvar");
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-gold" />Prazos do RELMDA</CardTitle>
        <CardDescription>Define o dia/horário limite de envio do relatório semanal. Escolha "Padrão global" pra valer pra todas as igrejas sem configuração própria.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Igreja</Label>
          <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">— Padrão global (todas as igrejas sem config própria) —</option>
            {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Dia limite de envio</Label>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {WEEKDAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Horário limite</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Prazo de correção (dias)</Label>
            <Input type="number" min={0} value={correctionDays} onChange={(e) => setCorrectionDays(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Avisar quando faltar (horas)</Label>
            <Input type="number" min={0} value={reminderHours} onChange={(e) => setReminderHours(Number(e.target.value))} />
          </div>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button onClick={save} disabled={busy} className="gap-1.5">
          <Save className="h-4 w-4" /> {busy ? "Salvando…" : ok ? "Salvo!" : "Salvar prazo"}
        </Button>
      </CardContent>
    </Card>
  );
}
