"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Phone, MapPin, Clock, Check, Pause, X as Xicon, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePrayerRequests, useVisitRequests, useChurches } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { updatePrayerStatus, updateVisitStatus } from "@/services/publicForms";
import { logAudit } from "@/services/audit";
import type { ContactStatus, PublicPrayerRequest, VisitRequest, Church } from "@/types/domain";

const STATUS_LABELS: Record<ContactStatus, string> = {
  novo: "Novo", em_andamento: "Em andamento", concluido: "Concluído", spam: "Spam",
};
const STATUS_COLORS: Record<ContactStatus, string> = {
  novo: "bg-gold/15 text-gold border-gold/30",
  em_andamento: "bg-yellow-50 text-yellow-700 border-yellow-200",
  concluido: "bg-green-50 text-green-700 border-green-200",
  spam: "bg-red-50 text-red-700 border-red-200",
};

export function PublicPrayerRequestsAdmin() {
  const [filter, setFilter] = useState<ContactStatus | "all">("novo");
  const [churchFilter, setChurchFilter] = useState<string>("");
  const { data: items = [] } = usePrayerRequests(filter === "all" ? undefined : filter);
  const { data: churches = [] } = useChurches();
  const qc = useQueryClient();

  const filtered = churchFilter ? items.filter((i) => i.church_id === churchFilter) : items;
  const churchMap = new Map(churches.map((c) => [c.id, c]));

  async function setStatus(id: string, status: ContactStatus) {
    try {
      await updatePrayerStatus(supabase, id, status);
      await logAudit(supabase, "update", "public_prayer_requests", id, { status });
      qc.invalidateQueries({ queryKey: ["prayer-requests"] });
      qc.invalidateQueries({ queryKey: ["pending-counts"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Pedidos de oração</CardTitle>
          <CardDescription>Recebidos pelo formulário público</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FilterTabs value={filter} onChange={setFilter} />
          {churches.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted">Filtrar por comunidade</Label>
              <select value={churchFilter} onChange={(e) => setChurchFilter(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:w-72">
                <option value="">Todas as comunidades</option>
                {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm italic text-muted">Nenhum pedido nessa categoria.</p>}
        {filtered.map((p) => <PrayerCard key={p.id} item={p} church={p.church_id ? churchMap.get(p.church_id) : undefined} onStatus={setStatus} />)}
      </div>
    </div>
  );
}

function PrayerCard({ item: p, church, onStatus }: { item: PublicPrayerRequest; church?: Church; onStatus: (id: string, s: ContactStatus) => void }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-navy">{p.full_name}</b>
              <StatusBadge status={p.status} />
              {church && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-bold uppercase text-navy">
                  <Building2 className="h-2.5 w-2.5" />{church.name}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted">{new Date(p.created_at).toLocaleString("pt-BR")}</p>
            <p className="mt-2 text-sm text-ink">{p.request}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
              {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
              {p.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}
              {p.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.city}</span>}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {p.status !== "em_andamento" && <Button onClick={() => onStatus(p.id, "em_andamento")} variant="outline" size="sm" className="gap-1"><Pause className="h-3 w-3" />Em andamento</Button>}
          {p.status !== "concluido"    && <Button onClick={() => onStatus(p.id, "concluido")}    variant="outline" size="sm" className="gap-1"><Check className="h-3 w-3" />Concluir</Button>}
          {p.status !== "spam"         && <Button onClick={() => onStatus(p.id, "spam")}         variant="outline" size="sm" className="gap-1 text-red-600"><Xicon className="h-3 w-3" />Spam</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

export function VisitRequestsAdmin() {
  const [filter, setFilter] = useState<ContactStatus | "all">("novo");
  const [churchFilter, setChurchFilter] = useState<string>("");
  const { data: items = [] } = useVisitRequests(filter === "all" ? undefined : filter);
  const { data: churches = [] } = useChurches();
  const qc = useQueryClient();

  const filtered = churchFilter ? items.filter((i) => i.church_id === churchFilter) : items;
  const churchMap = new Map(churches.map((c) => [c.id, c]));

  async function setStatus(id: string, status: ContactStatus) {
    try {
      await updateVisitStatus(supabase, id, status);
      await logAudit(supabase, "update", "visit_requests", id, { status });
      qc.invalidateQueries({ queryKey: ["visit-requests"] });
      qc.invalidateQueries({ queryKey: ["pending-counts"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Solicitações de visita</CardTitle>
          <CardDescription>Recebidas pelo formulário público</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FilterTabs value={filter} onChange={setFilter} />
          {churches.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted">Filtrar por comunidade</Label>
              <select value={churchFilter} onChange={(e) => setChurchFilter(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:w-72">
                <option value="">Todas as comunidades</option>
                {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm italic text-muted">Nenhuma solicitação nessa categoria.</p>}
        {filtered.map((v) => <VisitCard key={v.id} item={v} church={v.church_id ? churchMap.get(v.church_id) : undefined} onStatus={setStatus} />)}
      </div>
    </div>
  );
}

function VisitCard({ item: v, church, onStatus }: { item: VisitRequest; church?: Church; onStatus: (id: string, s: ContactStatus) => void }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-navy">{v.full_name}</b>
              <StatusBadge status={v.status} />
              {church && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-bold uppercase text-navy">
                  <Building2 className="h-2.5 w-2.5" />{church.name}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted">{new Date(v.created_at).toLocaleString("pt-BR")}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1 font-semibold text-ink"><Phone className="h-3 w-3" />{v.phone}</span>
              {v.email && <span className="flex items-center gap-1 text-muted"><Mail className="h-3 w-3" />{v.email}</span>}
              {v.best_time && <span className="flex items-center gap-1 text-muted"><Clock className="h-3 w-3" />{v.best_time}</span>}
            </div>
            {(v.city || v.address) && (
              <p className="mt-1 flex items-start gap-1 text-xs text-muted">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                {[v.address, v.city].filter(Boolean).join(" — ")}
              </p>
            )}
            {v.reason && <p className="mt-2 text-sm text-ink">{v.reason}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {v.status !== "em_andamento" && <Button onClick={() => onStatus(v.id, "em_andamento")} variant="outline" size="sm" className="gap-1"><Pause className="h-3 w-3" />Em andamento</Button>}
          {v.status !== "concluido"    && <Button onClick={() => onStatus(v.id, "concluido")}    variant="outline" size="sm" className="gap-1"><Check className="h-3 w-3" />Concluir</Button>}
          {v.status !== "spam"         && <Button onClick={() => onStatus(v.id, "spam")}         variant="outline" size="sm" className="gap-1 text-red-600"><Xicon className="h-3 w-3" />Spam</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterTabs({ value, onChange }: { value: ContactStatus | "all"; onChange: (v: ContactStatus | "all") => void }) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as ContactStatus | "all")}>
      <TabsList>
        <TabsTrigger value="novo">Novos</TabsTrigger>
        <TabsTrigger value="em_andamento">Em andamento</TabsTrigger>
        <TabsTrigger value="concluido">Concluídos</TabsTrigger>
        <TabsTrigger value="spam">Spam</TabsTrigger>
        <TabsTrigger value="all">Todos</TabsTrigger>
      </TabsList>
      <TabsContent value={value} />
    </Tabs>
  );
}

function StatusBadge({ status }: { status: ContactStatus }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
