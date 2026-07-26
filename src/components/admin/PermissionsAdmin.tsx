"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, AlertCircle, Users, MapPin, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePastors, useStates, useNucleos, useDistricts, useSectors, useChurches } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { setPastorScopeLevel, type ScopeLevel, type PastorScope } from "@/services/pastorScope";
import { logAudit } from "@/services/audit";

const LEVEL_LABELS: Record<ScopeLevel, string> = {
  nacional: "Nacional (vê tudo)", estado: "Estado", nucleo: "Núcleo",
  distrito: "Distrito", setor: "Setor", igreja: "Igreja Local",
};

interface Option { id: string; name: string; }

export function PermissionsAdmin() {
  const qc = useQueryClient();
  const { data: pastors = [] } = usePastors();
  const { data: states = [] } = useStates();
  const { data: nucleos = [] } = useNucleos();
  const { data: districts = [] } = useDistricts();
  const { data: sectors = [] } = useSectors();
  const { data: churches = [] } = useChurches();

  const optionsByLevel: Record<Exclude<ScopeLevel, "nacional">, Option[]> = {
    estado: states.map(s => ({ id: s.id, name: `${s.name} (${s.uf})` })),
    nucleo: nucleos.map(n => ({ id: n.id, name: n.name })),
    distrito: districts.map(d => ({ id: d.id, name: d.name })),
    setor: sectors.map(s => ({ id: s.id, name: s.name })),
    igreja: churches.map(c => ({ id: c.id, name: c.name })),
  };
  const nameOf = (level: ScopeLevel | null, id: string | null): string | null => {
    if (!level || !id || level === "nacional") return null;
    return optionsByLevel[level]?.find(o => o.id === id)?.name ?? null;
  };

  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pendingLevel, setPendingLevel] = useState<Record<string, ScopeLevel | "">>({});
  const [pendingId, setPendingId] = useState<Record<string, string>>({});

  const withoutScope = pastors.filter(p => !p.scope_level && !p.church_id);
  const withScope = pastors.filter(p => p.scope_level || p.church_id);

  function getPendingLevel(p: PastorScope): ScopeLevel | "" {
    return pendingLevel[p.id] ?? p.scope_level ?? (p.church_id ? "igreja" : "");
  }
  function getPendingId(p: PastorScope): string {
    return pendingId[p.id] ?? p.scope_id ?? p.church_id ?? "";
  }

  async function save(p: PastorScope) {
    const level = getPendingLevel(p);
    const id = level === "nacional" ? null : (getPendingId(p) || null);
    if (level && level !== "nacional" && !id) { alert("Selecione o destino do escopo."); return; }
    setBusy(p.id); setSaved(null);
    try {
      await setPastorScopeLevel(supabase, p.id, (level || null) as ScopeLevel | null, id);
      await logAudit(supabase, "update", "profiles", p.id, { scope_level: level, scope_id: id });
      setSaved(p.id);
      setTimeout(() => setSaved(null), 2500);
      qc.invalidateQueries({ queryKey: ["pastors"] });
      qc.invalidateQueries({ queryKey: ["pastors-without-scope-count"] });
    } catch (e: unknown) {
      console.error("[PermissionsAdmin] save error:", e);
      alert(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(null);
    }
  }

  function row(p: PastorScope) {
    const level = getPendingLevel(p);
    const id = getPendingId(p);
    const isDirty = level !== (p.scope_level ?? (p.church_id ? "igreja" : "")) || (level !== "nacional" && id !== (p.scope_id ?? p.church_id ?? ""));
    const currentLabel = nameOf(p.scope_level, p.scope_id ?? p.church_id);

    return (
      <div key={p.id} className="rounded-md border bg-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <b className="text-sm text-navy">{p.full_name}</b>
            <span className="ml-2 rounded border px-1.5 py-0.5 text-[10px] uppercase text-muted">{p.role}</span>
            {p.email && <p className="text-[11px] text-muted">{p.email}</p>}
            {p.scope_level && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-gold">
                <MapPin className="h-3 w-3" />
                Escopo atual: {LEVEL_LABELS[p.scope_level]}{currentLabel ? ` — ${currentLabel}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-[150px]">
              <Label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">Nível</Label>
              <select
                value={level}
                onChange={(e) => {
                  const v = e.target.value as ScopeLevel | "";
                  setPendingLevel(prev => ({ ...prev, [p.id]: v }));
                  setPendingId(prev => ({ ...prev, [p.id]: "" }));
                }}
                className="h-9 w-full rounded-md border bg-background px-2 text-xs"
              >
                <option value="">— Sem escopo (vê tudo, legado) —</option>
                {(Object.keys(LEVEL_LABELS) as ScopeLevel[]).map(l => (
                  <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                ))}
              </select>
            </div>
            {level && level !== "nacional" && (
              <div className="min-w-[200px]">
                <Label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">Destino</Label>
                <select
                  value={id}
                  onChange={(e) => setPendingId(prev => ({ ...prev, [p.id]: e.target.value }))}
                  className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                >
                  <option value="">— Selecione —</option>
                  {optionsByLevel[level].map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}
            <Button onClick={() => save(p)} disabled={!isDirty || busy === p.id} size="sm" className="gap-1">
              {busy === p.id ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                : saved === p.id ? <CheckCircle2 className="h-3 w-3" />
                : <Save className="h-3 w-3" />}
              {busy === p.id ? "..." : saved === p.id ? "Salvo!" : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-gold" />Permissões hierárquicas (MEO-001)</CardTitle>
          <CardDescription>
            Atribua o nível que cada pastor/supervisor administra — de Nacional até uma Igreja Local específica,
            seguindo a Estrutura de Supervisão (Pastor Presidente → Supervisor de Núcleo → Supervisor Distrital → Supervisor de Setor).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded-md border-l-4 border-l-blue-500 bg-blue-50 p-3 text-xs text-blue-900">
            <b>Regras:</b> Apóstolo sempre vê tudo. Escopo Nacional também vê tudo.
            Qualquer outro nível vê apenas aquele nó e tudo abaixo dele na árvore territorial.
            Sem escopo definido = modo legado (vê tudo).
          </div>
        </CardContent>
      </Card>

      {withoutScope.length > 0 && (
        <Card className="border-l-4 border-l-red-400">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-700">
              <AlertCircle className="h-4 w-4" />
              {withoutScope.length} pastor(es)/supervisor(es) sem escopo definido
            </CardTitle>
            <CardDescription>Estão em modo legado e veem TODOS os dados. Atribua escopo pra restringir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {withoutScope.map(row)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-gold" />Com escopo definido ({withScope.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {withScope.length === 0 ? (
            <p className="text-sm italic text-muted">Nenhum com escopo definido ainda.</p>
          ) : withScope.map(row)}
        </CardContent>
      </Card>
    </div>
  );
}
