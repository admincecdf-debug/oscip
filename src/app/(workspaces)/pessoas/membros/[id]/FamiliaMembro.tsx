"use client";
import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, Trash2, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { useMemberRelationships, useAllMembers } from "@/hooks/use-queries";
import { addMemberRelationship, removeMemberRelationship, RELATIONSHIP_LABELS } from "@/services/family";
import type { FamilyRelationshipType } from "@/types/domain";

export function FamiliaMembro({ memberId }: { memberId: string }) {
  const qc = useQueryClient();
  const { data: relationships = [], isLoading } = useMemberRelationships(memberId);
  const { data: members = [] } = useAllMembers();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<FamilyRelationshipType>("conjuge");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [query, setQuery] = useState("");
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const results = query.trim().length >= 2 ? members.filter((m) => m.id !== memberId && m.full_name.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [];

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addMemberRelationship(supabase, {
        member_id: memberId, relationship_type: type, related_name: name,
        related_phone: phone || undefined, related_member_id: linkedId,
      });
      qc.invalidateQueries({ queryKey: ["member-relationships", memberId] });
      setShowForm(false); setName(""); setPhone(""); setQuery(""); setLinkedId(null);
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    await removeMemberRelationship(supabase, id);
    qc.invalidateQueries({ queryKey: ["member-relationships", memberId] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Heart className="h-4 w-4 text-gold" />Família</CardTitle>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-1.5"><Plus className="h-4 w-4" />Adicionar</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="space-y-3 rounded-md border p-3">
            <div><Label className="text-xs">Parentesco</Label>
              <select value={type} onChange={(e) => setType(e.target.value as FamilyRelationshipType)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" /></div>
            <div><Label className="text-xs">Telefone (opcional)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div>
              <Label className="text-xs">Vincular a um CEC ID já cadastrado (opcional)</Label>
              <Input value={linkedId ? name : query} onChange={(e) => { setQuery(e.target.value); setLinkedId(null); }} placeholder="Buscar por nome…" />
              {results.length > 0 && !linkedId && (
                <div className="mt-1 space-y-1 rounded-md border p-1">
                  {results.map((m) => (
                    <button key={m.id} onClick={() => { setLinkedId(m.id); setName(m.full_name); setQuery(""); }} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted">{m.full_name}</button>
                  ))}
                </div>
              )}
              {linkedId && <p className="mt-1 text-xs text-green-600 flex items-center gap-1"><Link2 className="h-3 w-3" />Vinculado ao cadastro desta pessoa</p>}
            </div>
            <div className="flex gap-2"><Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button><Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button></div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm italic text-muted-foreground">Carregando…</p>
        ) : relationships.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">Nenhum vínculo familiar registrado ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {relationships.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                <div>
                  {r.related_member_id ? (
                    <Link href={`/pessoas/membros/${r.related_member_id}`} className="text-sm font-semibold text-navy hover:underline">{r.related_name}</Link>
                  ) : (
                    <p className="text-sm font-semibold text-navy">{r.related_name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{RELATIONSHIP_LABELS[r.relationship_type]}{r.related_phone ? ` · ${r.related_phone}` : ""}</p>
                </div>
                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
