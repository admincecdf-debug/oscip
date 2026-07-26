"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, Search, Globe, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuditLogs, useChurches } from "@/hooks/use-queries";
import type { AuditAction, AuditLog } from "@/types/domain";

const ACTION_LABELS: Record<AuditAction, string> = {
  insert: "Criação", update: "Alteração", delete: "Exclusão",
  login: "Login", logout: "Logout", export: "Exportação", custom: "Outro",
};
const ACTION_COLORS: Record<AuditAction, string> = {
  insert: "bg-green-50 text-green-700 border-green-200",
  update: "bg-blue-50 text-blue-700 border-blue-200",
  delete: "bg-red-50 text-red-700 border-red-200",
  login: "bg-navy/10 text-navy border-navy/20",
  logout: "bg-gray-100 text-gray-600 border-gray-300",
  export: "bg-gold/10 text-gold border-gold/30",
  custom: "bg-purple-50 text-purple-700 border-purple-200",
};

/**
 * Extraído de AdminPanel.tsx (era a função interna `AuditView`) para poder
 * ser reutilizado tanto no painel legado (/admin) quanto no novo
 * workspace de Governança (/governanca).
 *
 * Auditoria expandida: agora mostra IP, igreja e o detalhe completo de cada
 * evento (incluindo valor anterior/posterior e justificativa, quando o
 * código que registrou o log informou isso — ver AuditExtra em services/audit.ts).
 */
export function AuditAdmin() {
  const { data: logs = [] } = useAuditLogs();
  const { data: churches = [] } = useChurches();
  const churchMap = new Map(churches.map((c) => [c.id, c.name]));

  const [actionFilter, setActionFilter] = useState<AuditAction | "">("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = logs.filter((l) => {
    if (actionFilter && l.action !== actionFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const haystack = `${l.actor_email ?? ""} ${l.entity} ${l.entity_id ?? ""}`.toLowerCase();
      if (!haystack.includes(s)) return false;
    }
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs de auditoria</CardTitle>
        <CardDescription>Ações registradas no sistema (últimos {logs.length} eventos). Clique numa linha pra ver o detalhe completo.</CardDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar por e-mail, entidade ou ID..." className="pl-7 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={actionFilter || "all"} onValueChange={(v) => setActionFilter(v === "all" ? "" : v as AuditAction)}>
            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Todas as ações" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {Object.entries(ACTION_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">Nenhum log encontrado para os filtros selecionados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="p-2 w-6"></th>
                  <th className="p-2">Quando</th><th className="p-2">Quem</th><th className="p-2">Ação</th>
                  <th className="p-2">Entidade</th><th className="p-2">Igreja</th><th className="p-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <LogRow key={l.id} log={l} churchName={l.church_id ? churchMap.get(l.church_id) ?? null : null}
                    expanded={expandedId === l.id} onToggle={() => setExpandedId(expandedId === l.id ? null : l.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LogRow({ log, churchName, expanded, onToggle }: { log: AuditLog; churchName: string | null; expanded: boolean; onToggle: () => void }) {
  const hasDetails = !!log.details && Object.keys(log.details).length > 0;
  const details = (log.details ?? {}) as Record<string, unknown>;
  const before = details.before as Record<string, unknown> | undefined;
  const after = details.after as Record<string, unknown> | undefined;
  const justificativa = details.justificativa as string | undefined;
  const rest = Object.fromEntries(Object.entries(details).filter(([k]) => !["before", "after", "justificativa"].includes(k)));
  const hasRest = Object.keys(rest).length > 0;

  return (
    <>
      <tr onClick={hasDetails ? onToggle : undefined} className={`border-b ${hasDetails ? "cursor-pointer hover:bg-muted/30" : ""}`}>
        <td className="p-2">{hasDetails && (expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />)}</td>
        <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString("pt-BR")}</td>
        <td className="p-2">{log.actor_email ?? "—"}</td>
        <td className="p-2"><span className={`rounded border px-2 py-0.5 text-xs font-bold ${ACTION_COLORS[log.action]}`}>{ACTION_LABELS[log.action]}</span></td>
        <td className="p-2 text-navy">{log.entity}{log.entity_id && <span className="ml-1 font-mono text-[10px] text-muted-foreground">{log.entity_id.slice(0, 8)}</span>}</td>
        <td className="p-2 text-xs text-muted-foreground">{churchName ?? "—"}</td>
        <td className="p-2 text-xs text-muted-foreground">{log.ip ?? "—"}</td>
      </tr>
      {expanded && hasDetails && (
        <tr className="border-b bg-muted/10">
          <td colSpan={7} className="p-3">
            <div className="space-y-2">
              {justificativa && (
                <div className="flex items-start gap-1.5 text-xs">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy" />
                  <p><b className="text-navy">Justificativa:</b> {justificativa}</p>
                </div>
              )}
              {(before || after) && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {before && (
                    <div className="rounded border border-red-200 bg-red-50/50 p-2">
                      <p className="mb-1 text-[10px] font-bold uppercase text-red-700">Antes</p>
                      <pre className="whitespace-pre-wrap break-all text-[11px] text-red-900">{JSON.stringify(before, null, 2)}</pre>
                    </div>
                  )}
                  {after && (
                    <div className="rounded border border-green-200 bg-green-50/50 p-2">
                      <p className="mb-1 text-[10px] font-bold uppercase text-green-700">Depois</p>
                      <pre className="whitespace-pre-wrap break-all text-[11px] text-green-900">{JSON.stringify(after, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
              {hasRest && (
                <div className="rounded border bg-card p-2">
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground"><Globe className="h-3 w-3" />Outros detalhes</p>
                  <pre className="whitespace-pre-wrap break-all text-[11px] text-muted-foreground">{JSON.stringify(rest, null, 2)}</pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
