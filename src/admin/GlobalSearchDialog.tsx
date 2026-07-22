"use client";
import { useEffect, useState } from "react";
import { Search, User, Church, Users2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useGlobalSearch } from "@/hooks/use-queries";
import { RESULT_TYPE_LABELS, type GlobalSearchResult } from "@/services/globalSearch";
import type { TabKey } from "./AdminSidebar";

const ICONS: Record<GlobalSearchResult["result_type"], React.ReactNode> = {
  membro: <User className="h-4 w-4" />,
  igreja: <Church className="h-4 w-4" />,
  life_group: <Users2 className="h-4 w-4" />,
};

/**
 * UX-003 Cap. 4 Parte 5 — Pesquisa Global Inteligente.
 * Busca unificada por Pessoas, Igrejas e Life Groups, acessível de
 * qualquer tela via Ctrl+K ou clicando na caixa "Buscar…".
 */
export function GlobalSearchDialog({ open, onClose, onNavigate }: {
  open: boolean; onClose: () => void; onNavigate: (tab: TabKey) => void;
}) {
  const [query, setQuery] = useState("");
  const { data: results = [], isLoading } = useGlobalSearch(query);

  useEffect(() => { if (!open) setQuery(""); }, [open]);

  function goTo(r: GlobalSearchResult) {
    if (r.result_type === "membro") onNavigate("members" as TabKey);
    else if (r.result_type === "igreja") onNavigate("communities" as TabKey);
    else if (r.result_type === "life_group") onNavigate("life-groups" as TabKey);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite um nome, telefone, CEC ID, igreja ou Life Group…"
            className="border-0 p-0 shadow-none focus-visible:ring-0"
          />
          <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-navy"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">Digite ao menos 2 caracteres pra buscar.</p>
          ) : isLoading ? (
            <p className="p-4 text-center text-xs text-muted-foreground">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">Nenhum resultado pra "{query}".</p>
          ) : (
            <div className="space-y-0.5">
              {results.map((r) => (
                <button
                  key={`${r.result_type}-${r.id}`}
                  onClick={() => goTo(r)}
                  className="flex w-full items-center gap-3 rounded-md p-2.5 text-left hover:bg-muted/60"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-navy/5 text-navy">{ICONS[r.result_type]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.subtitle}{r.extra ? ` · ${r.extra}` : ""}</p>
                  </div>
                  <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                    {RESULT_TYPE_LABELS[r.result_type]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
