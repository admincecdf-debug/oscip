"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Map as MapIcon, Users, Building2, Flame, X, DollarSign,
  FileText, AlertTriangle, Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useExpansionCities, useExpansionStates } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";

interface MarkerData {
  city: string; state: string; coords: [number, number];
  churches_count: number; lgs_count: number; members_count: number;
  church_names: string[]; church_ids: string[];
}
interface ChurchDetail { id: string; name: string; type: string; status_admin?: string; created_at?: string; }
interface LgSummary    { id: string; name: string; status_lg?: string; }
interface LgDetail {
  id: string; name: string; status_lg?: string;
  address?: string; city?: string; state?: string; neighborhood?: string;
  meeting_weekday?: string; meeting_time?: string;
  target_audience?: string; founded_at?: string;
  leader_id?: string | null; coleader_id?: string | null;
  host_id?: string | null; supervisor_id?: string | null;
}
interface ProfileMini { id: string; full_name: string; phone: string | null; }
interface FinanceSummary { total_entrada: number; total_saida: number; saldo: number; }
interface PatrimonyInfo  { properties_count: number; assets_count: number; total_value: number; }
interface ReportStatus   { total_lgs: number; lgs_with_weekly: number; lgs_with_monthly: number; }

const CITY_COORDS: Record<string, [number, number]> = {
  "Manaus|AM": [-3.119, -60.021], "Itacoatiara|AM": [-3.143, -58.444],
  "Tefé|AM": [-3.354, -64.711],   "Iranduba|AM": [-3.275, -60.186],
  "Brasília|DF": [-15.793, -47.882], "Águas Claras|DF": [-15.835, -48.029],
  "Taguatinga|DF": [-15.840, -48.054], "Brazlândia|DF": [-15.683, -48.205],
  "Cascavel|PR": [-24.957, -53.459], "Joinville|SC": [-26.304, -48.846],
  "São Paulo|SP": [-23.550, -46.633], "Rio de Janeiro|RJ": [-22.907, -43.173],
  "Belo Horizonte|MG": [-19.916, -43.934], "Curitiba|PR": [-25.428, -49.273],
  "Porto Alegre|RS": [-30.034, -51.217], "Goiânia|GO": [-16.679, -49.255],
  "Belém|PA": [-1.456, -48.502], "Fortaleza|CE": [-3.731, -38.526],
};
const STATE_COORDS: Record<string, [number, number]> = {
  AM: [-4.0, -63.0], DF: [-15.78, -47.93], PR: [-25.0, -51.5], SC: [-27.5, -50.0],
  SP: [-23.5, -46.6], RJ: [-22.9, -43.2], MG: [-19.9, -43.9], BA: [-12.9, -38.5],
  CE: [-3.7, -38.5], PE: [-8.0, -34.9], RS: [-30.0, -51.2], PA: [-1.5, -48.5],
  GO: [-16.7, -49.3],
};
function getCoord(city: string, state: string): [number, number] | null {
  return CITY_COORDS[`${city}|${state}`] ?? STATE_COORDS[state] ?? null;
}

const LeafletMapInteractive = dynamic(
  () => import("./ExpansionMapLeafletInteractive"),
  { ssr: false, loading: () => <div className="h-[520px] w-full rounded-md border bg-gray-50 grid place-items-center text-sm text-muted">Carregando mapa…</div> }
);

function LgDetailCard({ lgId, onClose }: { lgId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<LgDetail | null>(null);
  const [people, setPeople] = useState<Record<string, ProfileMini>>({});
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [lastReport, setLastReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.from("life_groups").select("*").eq("id", lgId).single()
      .then(async ({ data }) => {
        const lg = data as LgDetail | null;
        setDetail(lg);
        if (lg) {
          const ids = [lg.leader_id, lg.coleader_id, lg.host_id, lg.supervisor_id].filter(Boolean) as string[];
          if (ids.length > 0) {
            const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
            const map: Record<string, ProfileMini> = {};
            (profiles ?? []).forEach((p: ProfileMini) => { map[p.id] = p; });
            setPeople(map);
          }
          const { count } = await supabase.from("members").select("id", { count: "exact", head: true })
            .eq("life_group_id", lgId).eq("status", "ativo");
          setMemberCount(count ?? 0);

          const { data: report } = await supabase.from("meeting_reports")
            .select("meeting_date").eq("life_group_id", lgId)
            .order("meeting_date", { ascending: false }).limit(1).maybeSingle();
          setLastReport(report?.meeting_date ?? null);
        }
        setLoading(false);
      });
  }, [lgId]);

  const WEEKDAY_LABELS: Record<string, string> = {
    domingo: "Domingo", segunda: "Segunda", terca: "Terça",
    quarta: "Quarta", quinta: "Quinta", sexta: "Sexta", sabado: "Sábado",
  };

  return (
    <div className="rounded-md border-2 border-gold/40 bg-gold/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-navy">{detail?.name ?? "Carregando…"}</p>
        <Button onClick={onClose} variant="ghost" size="sm" className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
      </div>

      {loading && <p className="text-xs italic text-muted">Carregando ficha…</p>}

      {!loading && detail && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-white p-2 text-center">
              <p className="font-display text-lg font-bold text-navy">{memberCount ?? "—"}</p>
              <p className="text-[10px] text-muted">Membros ativos</p>
            </div>
            <div className="rounded-md bg-white p-2 text-center">
              {detail.status_lg ? (
                <span className={[
                  "inline-block rounded-full px-2 py-1 text-[10px] font-bold",
                  detail.status_lg === "muito_saudavel" ? "bg-green-100 text-green-700" :
                  detail.status_lg === "saudavel"       ? "bg-green-50 text-green-600" :
                  detail.status_lg === "atencao"        ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700",
                ].join(" ")}>
                  {detail.status_lg.replace(/_/g, " ")}
                </span>
              ) : <span className="text-[10px] text-muted">Sem avaliação</span>}
              <p className="text-[10px] text-muted mt-1">Saúde do LG</p>
            </div>
          </div>

          {(detail.meeting_weekday || detail.meeting_time) && (
            <div className="rounded-md bg-white p-2 text-xs text-navy">
              <b>Encontros:</b> {WEEKDAY_LABELS[detail.meeting_weekday ?? ""] ?? detail.meeting_weekday}
              {detail.meeting_time ? ` às ${detail.meeting_time.slice(0,5)}` : ""}
            </div>
          )}

          {(detail.address || detail.neighborhood) && (
            <div className="rounded-md bg-white p-2 text-xs text-muted">
              📍 {[detail.address, detail.neighborhood, detail.city].filter(Boolean).join(", ")}
            </div>
          )}

          <div className="rounded-md bg-white p-2 space-y-1.5">
            <p className="text-[10px] font-bold uppercase text-muted">Liderança</p>
            {[
              { label: "Líder",      id: detail.leader_id },
              { label: "Colíder",    id: detail.coleader_id },
              { label: "Anfitrião",  id: detail.host_id },
              { label: "Supervisor", id: detail.supervisor_id },
            ].filter(r => r.id).map(r => (
              <div key={r.label} className="flex items-center justify-between text-xs">
                <span className="text-muted">{r.label}</span>
                <span className="font-medium text-navy">{people[r.id!]?.full_name ?? "—"}</span>
              </div>
            ))}
            {![detail.leader_id, detail.coleader_id, detail.host_id, detail.supervisor_id].some(Boolean) && (
              <p className="text-xs italic text-muted">Nenhuma liderança definida.</p>
            )}
          </div>

          <div className="rounded-md bg-white p-2 text-xs">
            <b className="text-navy">Último relatório semanal:</b>{" "}
            {lastReport
              ? <span className="text-green-700">{new Date(lastReport).toLocaleDateString("pt-BR")}</span>
              : <span className="text-red-600">Nenhum registrado</span>}
          </div>

          {detail.founded_at && (
            <p className="text-[10px] text-muted">
              Fundado em {new Date(detail.founded_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LocationPanel({ marker, onClose }: { marker: MarkerData; onClose: () => void }) {
  const [churches,  setChurches]  = useState<ChurchDetail[]>([]);
  const [lgs,       setLgs]       = useState<LgSummary[]>([]);
  const [finance,   setFinance]   = useState<FinanceSummary | null>(null);
  const [patrimony, setPatrimony] = useState<PatrimonyInfo | null>(null);
  const [reports,   setReports]   = useState<ReportStatus | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [section,   setSection]   = useState("overview");

  const load = useCallback(async () => {
    setLoading(true);
    const ids = marker.church_ids ?? [];
    if (ids.length === 0) { setLoading(false); return; }

    await Promise.all([
      supabase.from("churches").select("id, name, type, status_admin, created_at").in("id", ids)
        .then(({ data }) => setChurches((data as ChurchDetail[]) ?? [])),

      supabase.from("life_groups").select("id, name, status_lg").in("church_id", ids).eq("is_active", true).order("name")
        .then(({ data }) => setLgs((data as LgSummary[]) ?? [])),

      supabase.from("finances").select("direction, amount").in("church_id", ids)
        .then(({ data }) => {
          const rows = data ?? [];
          const entrada = rows.filter((r: { direction: string }) => r.direction === "entrada").reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
          const saida   = rows.filter((r: { direction: string }) => r.direction === "saida").reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
          setFinance({ total_entrada: entrada, total_saida: saida, saldo: entrada - saida });
        }),

      supabase.from("assets").select("id, acquisition_value").in("church_id", ids).eq("is_active", true)
        .then(async ({ data: assets }) => {
          const { data: props } = await supabase.from("properties").select("id").in("church_id", ids).eq("is_active", true);
          setPatrimony({
            properties_count: (props ?? []).length,
            assets_count: (assets ?? []).length,
            total_value: (assets ?? []).reduce((s: number, a: { acquisition_value: number }) => s + Number(a.acquisition_value ?? 0), 0),
          });
        }),
    ]);
    setLoading(false);
  }, [marker]);

  useEffect(() => { load(); setSelectedLgId(null); }, [load]);

  useEffect(() => {
    if (lgs.length === 0) return;
    const lgIds = lgs.map(lg => lg.id);
    const now = new Date();
    Promise.all([
      supabase.from("meeting_reports").select("life_group_id").in("life_group_id", lgIds),
      supabase.from("monthly_reports").select("life_group_id").in("life_group_id", lgIds)
        .eq("year", now.getFullYear()).eq("month", now.getMonth() + 1),
    ]).then(([w, m]) => {
      setReports({
        total_lgs: lgIds.length,
        lgs_with_weekly:  new Set((w.data ?? []).map((r: { life_group_id: string }) => r.life_group_id)).size,
        lgs_with_monthly: new Set((m.data ?? []).map((r: { life_group_id: string }) => r.life_group_id)).size,
      });
    });
  }, [lgs]);

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const pct = (n: number, t: number) => t > 0 ? Math.round((n / t) * 100) : 0;

  const SECTIONS = [
    { id: "overview",  label: "Visão Geral" },
    { id: "lgs",       label: "Life Groups" },
    { id: "financial", label: "Financeiro" },
    { id: "patrimony", label: "Patrimônio" },
    { id: "reports",   label: "Relatórios" },
  ];

  const [selectedLgId, setSelectedLgId] = useState<string | null>(null);

  return (
    <div className="flex h-full w-full flex-col bg-white shadow-2xl overflow-hidden">
      {/* Header navy */}
      <div className="bg-navy px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">{marker.city}, {marker.state}</h2>
            <p className="text-xs text-white/60 mt-0.5">
              {marker.churches_count} comunidade{marker.churches_count !== 1 ? "s" : ""} · {marker.lgs_count} LG{marker.lgs_count !== 1 ? "s" : ""} · {marker.members_count} membros
            </p>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm" className="text-white hover:bg-white/10 shrink-0 p-1.5">
            <X size={16} />
          </Button>
        </div>

        {/* KPIs */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Comunidades", value: marker.churches_count },
            { label: "Life Groups", value: marker.lgs_count },
            { label: "Membros",     value: marker.members_count },
          ].map(k => (
            <div key={k.label} className="rounded-md bg-white/10 p-2 text-center">
              <p className="text-lg font-bold text-gold">{k.value}</p>
              <p className="text-[10px] text-white/60">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Nav seções */}
        <div className="mt-3 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={[
                "flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                section === s.id ? "bg-gold text-navy" : "bg-white/10 text-white/70 hover:bg-white/20",
              ].join(" ")}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && <p className="py-8 text-center text-sm text-muted italic">Carregando dados…</p>}

        {!loading && (
          <>
            {section === "overview" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-navy text-sm">Comunidades</h3>
                {churches.map(c => (
                  <div key={c.id} className="rounded-md border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-navy text-sm">{c.name}</p>
                        <p className="text-[11px] text-muted mt-0.5">
                          {c.type === "sede" ? "Sede" : c.type === "nucleo" ? "Núcleo" : "Igreja Local"}
                          {c.status_admin && ` · ${c.status_admin}`}
                        </p>
                        {c.created_at && (
                          <p className="text-[10px] text-muted">
                            Desde {new Date(c.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>
                      <span className={[
                        "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                        c.type === "sede" ? "bg-gold/10 text-gold border-gold/30" :
                        c.type === "nucleo" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        "bg-green-50 text-green-700 border-green-200",
                      ].join(" ")}>
                        {c.type === "sede" ? "Sede" : c.type === "nucleo" ? "Núcleo" : "Igreja"}
                      </span>
                    </div>
                  </div>
                ))}
                {reports && (
                  <div className="rounded-md border bg-card p-3 space-y-2">
                    <p className="text-xs font-bold uppercase text-muted">Indicadores Operacionais</p>
                    {[
                      { label: "Rel. semanais",        n: reports.lgs_with_weekly,  color: "bg-green-500" },
                      { label: "Rel. mensais (mês)",   n: reports.lgs_with_monthly, color: "bg-blue-500" },
                    ].map(item => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted">{item.label}</span>
                          <span className="font-bold text-navy">{item.n}/{reports.total_lgs} ({pct(item.n, reports.total_lgs)}%)</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-gray-100">
                          <div className={`h-1.5 rounded-full ${item.color}`} style={{ width: `${pct(item.n, reports.total_lgs)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {section === "lgs" && (
              <div className="space-y-2">
                <h3 className="font-semibold text-navy text-sm">{lgs.length} Life Group{lgs.length !== 1 ? "s" : ""}</h3>
                {lgs.length === 0 && <p className="text-sm italic text-muted">Nenhum Life Group ativo.</p>}
                {lgs.map(lg => (
                  <div key={lg.id}>
                    <button
                      onClick={() => setSelectedLgId(selectedLgId === lg.id ? null : lg.id)}
                      className={[
                        "flex w-full items-center gap-3 rounded-md border bg-card p-2.5 text-left transition-colors",
                        selectedLgId === lg.id ? "border-gold bg-gold/5" : "hover:bg-gold/5",
                      ].join(" ")}
                    >
                      <Flame className="h-4 w-4 shrink-0 text-orange-500" />
                      <span className="flex-1 text-sm font-medium text-navy truncate">{lg.name}</span>
                      {lg.status_lg && (
                        <span className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0",
                          lg.status_lg === "muito_saudavel" ? "bg-green-100 text-green-700" :
                          lg.status_lg === "saudavel"       ? "bg-green-50 text-green-600" :
                          lg.status_lg === "atencao"        ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700",
                        ].join(" ")}>
                          {lg.status_lg.replace(/_/g, " ")}
                        </span>
                      )}
                    </button>
                    {selectedLgId === lg.id && (
                      <div className="mt-1.5">
                        <LgDetailCard lgId={lg.id} onClose={() => setSelectedLgId(null)} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {section === "financial" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-navy text-sm">Financeiro — Acumulado</h3>
                {finance ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md border-l-4 border-l-green-500 bg-card p-3">
                      <p className="text-[10px] text-muted uppercase">Entradas</p>
                      <p className="font-bold text-green-700 text-sm mt-1">{fmt(finance.total_entrada)}</p>
                    </div>
                    <div className="rounded-md border-l-4 border-l-red-400 bg-card p-3">
                      <p className="text-[10px] text-muted uppercase">Saídas</p>
                      <p className="font-bold text-red-600 text-sm mt-1">{fmt(finance.total_saida)}</p>
                    </div>
                    <div className={`rounded-md border-l-4 ${finance.saldo >= 0 ? "border-l-blue-500" : "border-l-orange-500"} bg-card p-3`}>
                      <p className="text-[10px] text-muted uppercase">Saldo</p>
                      <p className={`font-bold text-sm mt-1 ${finance.saldo >= 0 ? "text-blue-700" : "text-orange-600"}`}>{fmt(finance.saldo)}</p>
                    </div>
                  </div>
                ) : <p className="text-sm italic text-muted">Sem dados financeiros.</p>}
              </div>
            )}

            {section === "patrimony" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-navy text-sm">Patrimônio</h3>
                {patrimony ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md border bg-card p-3 text-center">
                      <p className="font-display text-2xl font-bold text-navy">{patrimony.properties_count}</p>
                      <p className="text-[10px] text-muted">Imóveis</p>
                    </div>
                    <div className="rounded-md border bg-card p-3 text-center">
                      <p className="font-display text-2xl font-bold text-navy">{patrimony.assets_count}</p>
                      <p className="text-[10px] text-muted">Bens</p>
                    </div>
                    <div className="rounded-md border bg-card p-3 text-center">
                      <p className="font-display text-sm font-bold text-gold">{fmt(patrimony.total_value)}</p>
                      <p className="text-[10px] text-muted">Valor total</p>
                    </div>
                  </div>
                ) : <p className="text-sm italic text-muted">Sem dados patrimoniais.</p>}
              </div>
            )}

            {section === "reports" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-navy text-sm">Status de Relatórios</h3>
                {reports ? (
                  <div className="space-y-3">
                    <div className="rounded-md border bg-card p-3 space-y-3">
                      {[
                        { label: "Relatórios Semanais",           n: reports.lgs_with_weekly,  color: "bg-green-500", textColor: "text-green-600" },
                        { label: "Relatórios Mensais (mês atual)", n: reports.lgs_with_monthly, color: "bg-blue-500",  textColor: "text-blue-600" },
                      ].map(item => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-navy">{item.label}</span>
                            <span className={`font-bold ${item.textColor}`}>{pct(item.n, reports.total_lgs)}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-100">
                            <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${pct(item.n, reports.total_lgs)}%` }} />
                          </div>
                          <p className="text-[10px] text-muted mt-1">{item.n} de {reports.total_lgs} LGs</p>
                        </div>
                      ))}
                    </div>
                    {pct(reports.lgs_with_weekly, reports.total_lgs) < 80 && (
                      <div className="flex items-start gap-2 rounded-md border-l-4 border-l-yellow-400 bg-yellow-50 p-3">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-800">
                          {reports.total_lgs - reports.lgs_with_weekly} Life Group{reports.total_lgs - reports.lgs_with_weekly !== 1 ? "s" : ""} sem relatório semanal recente.
                        </p>
                      </div>
                    )}
                  </div>
                ) : <p className="text-sm italic text-muted">Carregando…</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ExpansionMapAdmin() {
  const { data: cities = [] } = useExpansionCities();
  const { data: states = [] } = useExpansionStates();
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);

  const cityMarkers = useMemo(() =>
    cities.map(c => ({
      ...c,
      coords: getCoord(c.city, c.state),
      church_ids: (c as { church_ids?: string[] }).church_ids ?? [],
    })).filter(c => c.coords !== null) as MarkerData[],
    [cities]
  );

  const totalMembers = cities.reduce((s, c) => s + c.members_count, 0);
  const totalLgs     = cities.reduce((s, c) => s + c.lgs_count, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapIcon className="h-5 w-5 text-gold" />Mapa de Expansão</CardTitle>
          <CardDescription>Painel Executivo Territorial — clique em um marcador para ver o painel completo da localidade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { icon: <Building2 />, label: "Cidades",        value: cities.length },
              { icon: <MapIcon />,   label: "Estados",        value: states.length },
              { icon: <Flame />,     label: "Life Groups",    value: totalLgs },
              { icon: <Users />,     label: "Membros ativos", value: totalMembers.toLocaleString("pt-BR") },
            ].map(s => (
              <div key={s.label} className="rounded-md border bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="text-gold [&>svg]:h-4 [&>svg]:w-4">{s.icon}</span>
                  <p className="text-[10px] uppercase tracking-wider text-muted">{s.label}</p>
                </div>
                <p className="mt-1 text-2xl font-bold text-navy">{s.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <LeafletMapInteractive markers={cityMarkers} onMarkerClick={setSelectedMarker} />
          <p className="mt-2 text-[11px] text-center text-muted">Clique em um marcador para abrir o Painel da Localidade</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Resumo por estado</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {states.sort((a, b) => b.members_count - a.members_count).map(s => (
              <div key={s.state} className="rounded-md border bg-card p-3">
                <div className="flex items-center justify-between">
                  <b className="text-navy">{s.state}</b>
                  <span className="text-[10px] uppercase tracking-wider text-muted">{s.cities_count} cidade(s)</span>
                </div>
                <div className="mt-2 flex gap-3 text-xs text-muted">
                  <span>🏢 {s.churches_count}</span>
                  <span>🔥 {s.lgs_count} LGs</span>
                  <span>👥 {s.members_count}</span>
                </div>
              </div>
            ))}
            {states.length === 0 && <p className="col-span-full text-sm italic text-muted">Sem dados ainda.</p>}
          </div>
        </CardContent>
      </Card>

      {selectedMarker && (
        <>
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            style={{ zIndex: 2000 }}
            onClick={() => setSelectedMarker(null)}
          />
          <div style={{ zIndex: 2001, position: "fixed", inset: "0 0 0 auto", width: "100%", maxWidth: 420 }}>
            <LocationPanel marker={selectedMarker} onClose={() => setSelectedMarker(null)} />
          </div>
        </>
      )}
    </div>
  );
}
