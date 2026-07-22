"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, Users2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoleDelegations } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import * as Del from "@/services/delegations";
import { DELEGATION_MODULE_LABELS } from "@/services/delegations";
import type { DelegationModule } from "@/types/domain";

/**
 * GOV-002 §14 — Perfis Prontos. Um "perfil" é um conjunto de
 * módulos+nível+escopo pré-configurados sob um mesmo nome (ex:
 * "Pastor Principal"), que a Ficha do Usuário pode aplicar de uma
 * vez, sempre com revisão antes de confirmar.
 */
export function PerfisProntosAdmin() {
  const { data: roles = [], refetch } = useRoleDelegations();
  const [showNew, setShowNew] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [module, setModule] = useState<DelegationModule>("administrativo");
  const [level, setLevel] = useState("2");
  const [scope, setScope] = useState("igreja");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof roles>();
    roles.forEach((r) => {
      if (!map.has(r.role_name)) map.set(r.role_name, []);
      map.get(r.role_name)!.push(r);
    });
    return Array.from(map.entries());
  }, [roles]);

  async function add() {
    if (!roleName.trim()) return;
    setBusy(true);
    try {
      await Del.upsertRoleDelegation(supabase, { role_name: roleName, module, trust_level: Number(level), scope, description: description || undefined });
      setRoleName(""); setDescription(""); setShowNew(false);
      refetch();
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("Remover este módulo do perfil?")) return;
    await supabase.from("role_delegations").delete().eq("id", id);
    refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg text-navy"><Users2 className="h-5 w-5 text-gold" />Perfis Prontos</h3>
          <p className="text-sm text-muted-foreground">Conjuntos de módulos pré-configurados (ex: "Pastor Principal") pra aplicar rápido na Ficha do Usuário.</p>
        </div>
        <Button size="sm" onClick={() => setShowNew((v) => !v)} className="gap-1.5"><Plus className="h-4 w-4" />Adicionar módulo a um perfil</Button>
      </div>

      {showNew && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div><Label className="text-xs">Nome do perfil</Label><Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Ex: Pastor Principal, Administrador Estadual…" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Módulo</Label>
                <Select value={module} onValueChange={(v) => setModule(v as DelegationModule)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DELEGATION_MODULE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nível</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>Nível {n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo de escopo padrão</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nacional">Nacional</SelectItem>
                    <SelectItem value="estado">Estado</SelectItem>
                    <SelectItem value="nucleo">Núcleo</SelectItem>
                    <SelectItem value="distrito">Distrito</SelectItem>
                    <SelectItem value="setor">Setor</SelectItem>
                    <SelectItem value="igreja">Igreja</SelectItem>
                    <SelectItem value="lg">Life Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Descrição (opcional)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="flex gap-2"><Button onClick={add} disabled={busy}>{busy ? "Salvando…" : "Adicionar"}</Button><Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button></div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {grouped.map(([name, rows]) => (
          <Card key={name}>
            <CardHeader><CardTitle className="text-base">{name}</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-2">
                  <p className="text-sm text-navy">{DELEGATION_MODULE_LABELS[r.module]} · Nível {r.trust_level} · Escopo padrão: {r.scope}</p>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {grouped.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum perfil pronto cadastrado ainda.</p>}
      </div>
    </div>
  );
}
