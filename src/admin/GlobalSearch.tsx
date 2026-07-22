"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Users, Flame, Building2, Package, Wallet, X, Loader2, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

// ── Tipos ─────────────────────────────────────────────────────
type ResultKind = "membro" | "lg" | "comunidade" | "bem" | "financeiro";

interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle: string;
  tab: string;   // aba do AdminPanel para navegar
  meta?: string;
}

const KIND_CONFIG: Record<ResultKind, { icon: React.ReactNode; label: string; color: string }> = {
  membro:     { icon: <Users className="h-4 w-4"/>,    label: "Membro",      color: "text-blue-600 bg-blue-50"    },
  lg:         { icon: <Flame className="h-4 w-4"/>,    label: "Life Group",  color: "text-orange-600 bg-orange-50"},
  comunidade: { icon: <Building2 className="h-4 w-4"/>,label: "Comunidade",  color: "text-[#0E2A47] bg-blue-50"  },
  bem:        { icon: <Package className="h-4 w-4"/>,  label: "Patrimônio",  color: "text-purple-600 bg-purple-50"},
  financeiro: { icon: <Wallet className="h-4 w-4"/>,   label: "Financeiro",  color: "text-green-600 bg-green-50"  },
};

// ── Busca no Supabase ─────────────────────────────────────────
async function searchAll(query: string): Promise<SearchResult[]> {
  if (query.length < 2) return [];
  const q = `%${query}%`;
  const results: SearchResult[] = [];

  const [members, lgs, churches, assets, finances] = await Promise.all([
    // Membros
    supabase.from("members").select("id, full_name, email, phone, journey_stage, status")
      .or(`full_name.ilike.${q},email.ilike.${q},phone.ilike.${q}`)
      .eq("status", "ativo").limit(5),
    // Life Groups
    supabase.from("life_groups").select("id, name, status_lg")
      .ilike("name", q).eq("is_active", true).limit(5),
    // Comunidades
    supabase.from("churches").select("id, name, city, state, type")
      .or(`name.ilike.${q},city.ilike.${q}`).eq("is_active", true).limit(5),
    // Bens patrimoniais
    supabase.from("assets").select("id, name, patrimony_code, serial_number, category")
      .or(`name.ilike.${q},patrimony_code.ilike.${q},serial_number.ilike.${q}`)
      .eq("is_active", true).limit(5),
    // Financeiro
    supabase.from("finances").select("id, description, payer_name, amount, direction, kind")
      .or(`description.ilike.${q},payer_name.ilike.${q}`)
      .order("occurred_on", { ascending: false }).limit(5),
  ]);

  // Membros
  (members.data ?? []).forEach(m => results.push({
    id: m.id, kind: "membro",
    title: m.full_name,
    subtitle: [m.email, m.phone].filter(Boolean).join(" · "),
    meta: m.journey_stage,
    tab: "members",
  }));

  // LGs
  (lgs.data ?? []).forEach(lg => results.push({
    id: lg.id, kind: "lg",
    title: lg.name,
    subtitle: lg.status_lg ?? "",
    tab: "life-groups",
  }));

  // Comunidades
  (churches.data ?? []).forEach(c => results.push({
    id: c.id, kind: "comunidade",
    title: c.name,
    subtitle: [c.city, c.state].filter(Boolean).join("/") || c.type,
    tab: "communities",
  }));

  // Bens
  (assets.data ?? []).forEach(a => results.push({
    id: a.id, kind: "bem",
    title: a.name,
    subtitle: [a.category, a.patrimony_code].filter(Boolean).join(" · "),
    tab: "patrimony",
  }));

  // Financeiro
  (finances.data ?? []).forEach(f => results.push({
    id: f.id, kind: "financeiro",
    title: f.description ?? f.payer_name ?? f.kind,
    subtitle: `${f.direction === "entrada" ? "Entrada" : "Saída"} · R$ ${Number(f.amount).toFixed(2)}`,
    tab: "finance",
  }));

  return results;
}

// ── Componente de busca global ────────────────────────────────
interface GlobalSearchProps {
  onNavigate: (tab: string) => void;
}

export function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Atalho Ctrl+K / Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focar input ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelected(0);
    }
  }, [open]);

  // Busca com debounce
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await searchAll(q);
      setResults(res);
      setSelected(0);
    } finally { setLoading(false); }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  }

  // Navegação com teclado
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) selectResult(results[selected]);
  }

  function selectResult(r: SearchResult) {
    onNavigate(r.tab);
    setOpen(false);
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-muted-foreground hover:border-[#C9A227] hover:text-[#0E2A47] transition-colors"
    >
      <Search className="h-4 w-4"/>
      <span className="hidden sm:inline">Buscar…</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono text-gray-500">
        ⌃K
      </kbd>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}/>

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          {loading
            ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin shrink-0"/>
            : <Search className="h-5 w-5 text-muted-foreground shrink-0"/>
          }
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Buscar membros, LGs, comunidades, bens…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-[#0E2A47]">
            <X className="h-4 w-4"/>
          </button>
        </div>

        {/* Resultados */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.length < 2 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}

          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado para <strong>"{query}"</strong>
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {/* Agrupar por tipo */}
              {(["membro","lg","comunidade","bem","financeiro"] as ResultKind[]).map(kind => {
                const group = results.filter(r => r.kind === kind);
                if (group.length === 0) return null;
                const cfg = KIND_CONFIG[kind];
                return (
                  <div key={kind}>
                    <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {cfg.label}
                    </p>
                    {group.map((r, i) => {
                      const idx = results.indexOf(r);
                      const isSelected = idx === selected;
                      return (
                        <button
                          key={r.id}
                          onClick={() => selectResult(r)}
                          onMouseEnter={() => setSelected(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? "bg-[#0E2A47] text-white" : "hover:bg-gray-50"}`}
                        >
                          <span className={`p-1.5 rounded-md shrink-0 ${isSelected ? "bg-white/20 text-white" : cfg.color}`}>
                            {cfg.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? "text-white" : "text-[#0E2A47]"}`}>
                              {r.title}
                            </p>
                            {r.subtitle && (
                              <p className={`text-xs truncate ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                                {r.subtitle}
                              </p>
                            )}
                          </div>
                          <ChevronRight className={`h-4 w-4 shrink-0 ${isSelected ? "text-white/70" : "text-muted-foreground"}`}/>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-gray-50 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <kbd className="rounded border bg-white px-1">↑↓</kbd> navegar
            <kbd className="rounded border bg-white px-1">↵</kbd> abrir
            <kbd className="rounded border bg-white px-1">Esc</kbd> fechar
          </span>
          <span>{results.length > 0 ? `${results.length} resultado(s)` : ""}</span>
        </div>
      </div>
    </div>
  );
}
