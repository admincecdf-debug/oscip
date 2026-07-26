"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, Phone, Mail, Calendar, Building2, Users, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useMembersAtRisk, useChurches, useCells } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { deleteMember } from "@/services/members";
import { logAudit } from "@/services/audit";

export function EvasionAdmin() {
  const qc = useQueryClient();
  const [churchFilter, setChurchFilter] = useState<string>("");
  const [lgFilter, setLgFilter]         = useState<string>("");

  const { data: risk = [] } = useMembersAtRisk({
    churchId: churchFilter || null,
    lgId: lgFilter || null,
  });
  const { data: churches = [] } = useChurches();
  const { data: cells = [] } = useCells();
  const churchMap = new Map(churches.map((c) => [c.id, c]));
  const cellMap   = new Map(cells.map((c) => [c.id, c]));
  const filteredCells = churchFilter ? cells.filter((c) => c.church_id === churchFilter) : cells;

  async function remove(memberId: string, name: string) {
    if (!confirm(`Remover ${name}?\n\nEsta ação remove apenas o registro de membro. A conta de acesso (se houver) continua existindo.`)) return;
    try {
      await deleteMember(supabase, memberId);
      await logAudit(supabase, "delete", "members", memberId, { name });
      qc.invalidateQueries({ queryKey: ["all-members"] });
      qc.invalidateQueries({ queryKey: ["members-at-risk"] });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao remover");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-red-600" />
            Membros em risco de evasão
          </CardTitle>
          <CardDescription>
            Membros ativos sem presença nos últimos 3 relatórios consecutivos do seu Life Group
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {churches.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted">Comunidade</Label>
                <select value={churchFilter}
                  onChange={(e) => { setChurchFilter(e.target.value); setLgFilter(""); }}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Todas as comunidades</option>
                  {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted">Life Group</Label>
              <select value={lgFilter} onChange={(e) => setLgFilter(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Todos os Life Groups</option>
                {filteredCells.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-md border-l-4 border-l-red-500 bg-red-50 p-3 text-xs text-red-900">
            <b>{risk.length}</b> membro(s) com sinal de evasão. Sugestão pastoral: contatar via WhatsApp ou telefone esta semana.
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {risk.length === 0 && (
          <p className="rounded-md border bg-card p-8 text-center text-sm italic text-muted">
            Nenhum membro em risco — todos estão participando.
          </p>
        )}
        {risk.map((m) => {
          const cell = m.life_group_id ? cellMap.get(m.life_group_id) : null;
          const church = m.church_id ? churchMap.get(m.church_id) : null;
          const daysSince = m.last_seen_at
            ? Math.floor((Date.now() - new Date(m.last_seen_at).getTime()) / (1000 * 60 * 60 * 24))
            : null;
          return (
            <Card key={m.member_id} className="border-l-4 border-l-red-400">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <b className="text-navy">{m.full_name}</b>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                      {cell    && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{cell.name}</span>}
                      {church  && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{church.name}</span>}
                      {m.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
                      {m.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span>}
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs">
                      <Calendar className="h-3 w-3 text-red-600" />
                      {m.last_seen_at ? (
                        <span className="text-red-700">
                          Última presença: <b>{new Date(m.last_seen_at).toLocaleDateString("pt-BR")}</b>
                          {daysSince !== null && ` (${daysSince} dias atrás)`}
                        </span>
                      ) : (
                        <span className="text-red-700">Nunca apareceu em um relatório</span>
                      )}
                    </p>
                  </div>
                  {m.phone && (
                    <a
                      href={`https://wa.me/${m.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá ' + m.full_name + ', sentimos sua falta no Life Group. Como você está?')}`}
                      target="_blank" rel="noreferrer"
                      className="shrink-0 rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800 hover:bg-green-100"
                    >
                      WhatsApp
                    </a>
                  )}
                  <button
                    onClick={() => remove(m.member_id, m.full_name)}
                    title="Excluir membro"
                    className="shrink-0 rounded-md border border-red-300 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
