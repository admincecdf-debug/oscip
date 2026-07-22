"use client";
import { useState } from "react";
import { Search, IdCard, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUsersDirectorySearch, useStates, useChurches } from "@/hooks/use-queries";

const ROLE_LABELS: Record<string, string> = {
  apostolo: "Apóstolo", pastor: "Pastor", supervisor: "Supervisor",
  lider: "Líder", anfitriao: "Anfitrião", discipulador: "Discipulador", membro: "Membro",
};

/**
 * GOV-002 §9 — Central de Delegações: pesquisa de usuários por
 * nome/e-mail/telefone/CEC ID, filtrando por Estado/Igreja/Cargo.
 */
export function BuscaUsuariosAdmin({ onManage }: { onManage: (profileId: string, fullName: string) => void }) {
  const [query, setQuery] = useState("");
  const [stateId, setStateId] = useState("");
  const [churchId, setChurchId] = useState("");
  const [role, setRole] = useState("");
  const { data: states = [] } = useStates();
  const { data: churches = [] } = useChurches();
  const { data: results = [], isLoading } = useUsersDirectorySearch({ query, stateId, churchId, role });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Nome, e-mail, telefone ou CEC ID…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={stateId} onValueChange={setStateId}>
          <SelectTrigger><SelectValue placeholder="Todos os estados" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os estados</SelectItem>
            {states.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger><SelectValue placeholder="Todos os cargos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os cargos</SelectItem>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:w-64">
        <Select value={churchId} onValueChange={setChurchId}>
          <SelectTrigger><SelectValue placeholder="Todas as igrejas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as igrejas</SelectItem>
            {churches.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Buscando…</p>}

      <div className="space-y-1.5">
        {results.map((u) => (
          <button
            key={u.profile_id}
            onClick={() => onManage(u.profile_id, u.full_name)}
            className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left shadow-sm transition hover:shadow-md"
          >
            {u.photo_url ? (
              <img src={u.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy/10 text-navy"><IdCard className="h-4 w-4" /></div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-navy">{u.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {ROLE_LABELS[u.role] ?? u.role}{u.church_name ? ` · ${u.church_name}` : ""}{u.cec_id ? ` · ${u.cec_id}` : ""}
              </p>
            </div>
            {u.delegacoes_ativas > 0 && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-bold text-navy">
                <Shield className="h-3 w-3" /> {u.delegacoes_ativas}
              </span>
            )}
          </button>
        ))}
        {!isLoading && results.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {query || stateId || role ? "Nenhum usuário encontrado com esses filtros." : "Digite ao menos 2 caracteres ou escolha um filtro pra buscar."}
          </p>
        )}
      </div>
    </div>
  );
}
