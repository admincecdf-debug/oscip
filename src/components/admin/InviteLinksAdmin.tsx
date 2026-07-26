"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Link2, Copy, Ban, Plus, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  useInviteLinks, useChurches, useSectors, useCells, useMinistries, useMyProfile,
  useStates, useNucleos, useDistricts,
} from "@/hooks/use-queries";
import { createInviteLink, revokeInviteLink, deleteInviteLink, inviteLinkUrl } from "@/services/invites";
import type { InviteLinkKind, InviteValidity, UserRole, InviteLinkStatus, ScopeLevel } from "@/types/domain";

export const KIND_LABELS: Record<InviteLinkKind, string> = {
  membro: "Membro", visitante: "Visitante", lider_lg: "Líder de Life Group",
  pastor: "Pastor", diretor_financeiro: "Diretor Financeiro", secretario: "Secretário",
  lider_jovens: "Líder de Jovens", lider_casais: "Líder de Casais",
  lider_criancas: "Líder de Crianças", musico: "Músico", administrador: "Administrador",
};
const KIND_TO_ROLE: Record<InviteLinkKind, UserRole> = {
  membro: "membro", visitante: "visitante", lider_lg: "lider", pastor: "pastor",
  diretor_financeiro: "membro", secretario: "membro", lider_jovens: "lider",
  lider_casais: "lider", lider_criancas: "lider", musico: "membro", administrador: "apostolo",
};
const STATUS_VARIANT: Record<InviteLinkStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ativo: "default", expirado: "secondary", esgotado: "outline", revogado: "destructive",
};

export function InviteLinksAdmin() {
  const qc = useQueryClient();
  const { data: profile } = useMyProfile();
  const { data: links = [], isLoading } = useInviteLinks(profile?.church_id);
  const { data: churches = [] } = useChurches();
  const { data: sectors = [] } = useSectors();
  const { data: cells = [] } = useCells();
  const { data: ministries = [] } = useMinistries(profile?.church_id);
  const { data: states = [] } = useStates();
  const { data: nucleos = [] } = useNucleos();
  const { data: districts = [] } = useDistricts();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<InviteLinkKind>("membro");
  const [churchId, setChurchId] = useState<string>(profile?.church_id ?? "");
  const [sectorId, setSectorId] = useState<string>("");
  const [lgId, setLgId] = useState<string>("");
  const [ministryId, setMinistryId] = useState<string>("");
  const [validity, setValidity] = useState<InviteValidity>("permanente");
  const [maxUses, setMaxUses] = useState<string>("");
  const [err, setErr] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel | "">("");
  const [scopeId, setScopeId] = useState<string>("");

  const needsScope = kind === "pastor" || kind === "administrador";
  const SCOPE_OPTIONS: Record<Exclude<ScopeLevel, "nacional">, { id: string; name: string }[]> = {
    estado: states.map(s => ({ id: s.id, name: `${s.name} (${s.uf})` })),
    nucleo: nucleos.map(n => ({ id: n.id, name: n.name })),
    distrito: districts.map(d => ({ id: d.id, name: d.name })),
    setor: sectors.map(s => ({ id: s.id, name: s.name })),
    igreja: churches.map(c => ({ id: c.id, name: c.name })),
  };

  const needsLg = kind === "lider_lg" || kind === "membro" || kind === "visitante";
  const needsMinistry = ["lider_jovens", "lider_casais", "lider_criancas", "musico"].includes(kind);

  async function handleCreate() {
    if (!churchId) { setErr("Selecione a igreja"); return; }
    if (needsScope && scopeLevel && scopeLevel !== "nacional" && !scopeId) {
      setErr("Selecione o destino do escopo (Estado/Núcleo/Distrito/Setor/Igreja)."); return;
    }
    setSaving(true); setErr("");
    try {
      const result = await createInviteLink(supabase, {
        kind,
        church_id: churchId,
        sector_id: sectorId || null,
        life_group_id: lgId || null,
        ministry_id: ministryId || null,
        target_role: KIND_TO_ROLE[kind],
        validity,
        max_uses: maxUses ? Number(maxUses) : null,
        scope_level: needsScope && scopeLevel ? (scopeLevel as ScopeLevel) : null,
        scope_id: needsScope && scopeLevel && scopeLevel !== "nacional" ? scopeId : null,
      });
      if (result) {
        await navigator.clipboard.writeText(inviteLinkUrl(result.token));
      }
      qc.invalidateQueries({ queryKey: ["invite-links"] });
      setOpen(false);
      setScopeLevel(""); setScopeId("");
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "Erro ao criar convite. Verifique sua permissão para este tipo de link.";
      setErr(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeInviteLink(supabase, id);
      qc.invalidateQueries({ queryKey: ["invite-links"] });
    } catch {
      setErr("Erro ao revogar link");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este link permanentemente? Essa ação não pode ser desfeita.")) return;
    try {
      await deleteInviteLink(supabase, id);
      qc.invalidateQueries({ queryKey: ["invite-links"] });
    } catch {
      setErr("Erro ao excluir link");
    }
  }

  function handleCopy(id: string, token: string) {
    navigator.clipboard.writeText(inviteLinkUrl(token));
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Link2 size={18} /> Central de Convites</CardTitle>
            <CardDescription>Gere links parametrizados de cadastro — a pessoa entra já vinculada à estrutura certa.</CardDescription>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus size={16} /> Gerar link</Button>
        </CardHeader>
        <CardContent>
          {err && <p className="text-sm text-destructive mb-3">{err}</p>}
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : links.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum link gerado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    <th className="py-2 pr-3 font-medium">Destino</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Usos</th>
                    <th className="py-2 pr-3 font-medium">Criado por</th>
                    <th className="py-2 pr-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{KIND_LABELS[l.kind]}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {l.life_group_name ?? l.church_name ?? "—"}
                      </td>
                      <td className="py-2 pr-3"><Badge variant={STATUS_VARIANT[l.status]}>{l.status}</Badge></td>
                      <td className="py-2 pr-3">{l.uses_count}{l.max_uses ? ` / ${l.max_uses}` : ""}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{l.created_by_name}</td>
                      <td className="py-2 pr-3 text-right space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => handleCopy(l.id, l.token)} title="Copiar link">
                          {copiedId === l.id ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                        </Button>
                        {l.status === "ativo" && (
                          <Button size="icon" variant="ghost" onClick={() => handleRevoke(l.id)} title="Revogar">
                            <Ban size={14} className="text-destructive" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(l.id)} title="Excluir">
                          <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar link de convite</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo de cadastro</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as InviteLinkKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Igreja (referência)</Label>
              <Select value={churchId} onValueChange={setChurchId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {churches.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {needsScope && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Escopo que essa pessoa vai administrar (Estrutura de Supervisão — MEO-001). Deixe em branco pra modo legado (vê tudo).
                </p>
                <div>
                  <Label>Nível de escopo</Label>
                  <Select value={scopeLevel} onValueChange={(v) => { setScopeLevel(v as ScopeLevel); setScopeId(""); }}>
                    <SelectTrigger><SelectValue placeholder="— Sem escopo (legado) —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nacional">Nacional (vê tudo)</SelectItem>
                      <SelectItem value="estado">Estado</SelectItem>
                      <SelectItem value="nucleo">Núcleo</SelectItem>
                      <SelectItem value="distrito">Distrito</SelectItem>
                      <SelectItem value="setor">Setor</SelectItem>
                      <SelectItem value="igreja">Igreja Local</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {scopeLevel && scopeLevel !== "nacional" && (
                  <div>
                    <Label>Destino</Label>
                    <Select value={scopeId} onValueChange={setScopeId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {SCOPE_OPTIONS[scopeLevel].map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {needsLg && (
              <div>
                <Label>Life Group (opcional)</Label>
                <Select value={lgId} onValueChange={setLgId}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    {cells.filter(c => c.church_id === churchId).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {needsMinistry && (
              <div>
                <Label>Ministério</Label>
                <Select value={ministryId} onValueChange={setMinistryId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ministries.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Validade</Label>
              <Select value={validity} onValueChange={(v) => setValidity(v as InviteValidity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanente">Permanente</SelectItem>
                  <SelectItem value="24h">24 horas</SelectItem>
                  <SelectItem value="7d">7 dias</SelectItem>
                  <SelectItem value="30d">30 dias</SelectItem>
                  <SelectItem value="90d">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Limite de usos (vazio = ilimitado, 1 = uso único)</Label>
              <input
                type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
                className="w-full h-9 rounded-md border px-3 text-sm"
                placeholder="Ilimitado"
              />
            </div>

            <Button onClick={handleCreate} disabled={saving} className="w-full gap-1.5">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
              Gerar e copiar link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
