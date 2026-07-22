"use client";
import { useEffect, useState } from "react";
import {
  getDashboardStatsFor, getNetworkBreakdown, getMyProfile, listChurches,
  JOURNEY_LABELS, ROLE_LABELS, CHURCH_TYPE_LABELS, isAdminRole,
  type DashboardStats, type ChurchBreakdown, type Enums,
} from "@/lib/cec";
import { supabase } from "@/lib/supabase";

type ChurchLite = { id: string; name: string; type: Enums<"church_type">; parent_id: string | null };

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [who, setWho] = useState<{ name: string; role: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [churches, setChurches] = useState<ChurchLite[]>([]);
  const [scope, setScope] = useState<string>(""); // "" = toda a rede
  const [breakdown, setBreakdown] = useState<ChurchBreakdown[]>([]);
  const [err, setErr] = useState("");

  // perfil + lista de igrejas (uma vez)
  useEffect(() => {
    getMyProfile(supabase)
      .then((p) => { if (p) { setWho({ name: p.full_name, role: ROLE_LABELS[p.role] }); setIsAdmin(isAdminRole(p.role)); } })
      .catch(() => {});
    listChurches(supabase).then((cs) => setChurches(cs as ChurchLite[])).catch(() => {});
    getNetworkBreakdown(supabase).then(setBreakdown).catch(() => {});
  }, []);

  // estatísticas reagem ao escopo selecionado
  useEffect(() => {
    setStats(null);
    getDashboardStatsFor(supabase, scope || null).then(setStats).catch((e) => setErr(e.message));
  }, [scope]);

  const multi = churches.length > 1;
  const scopeName = scope ? (churches.find((c) => c.id === scope)?.name ?? "Igreja") : "Toda a rede";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Topbar */}
      <header style={S.top}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 70 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={S.brandMark}>✦</span>
            <span style={{ fontFamily: "var(--display)", color: "#fff", fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>
              CEC FAMILY
            </span>
            <span style={S.brandSep}>Painel Apostólico</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isAdmin && <a href="/admin" style={{ ...S.signout, textDecoration: "none", borderColor: "var(--gold)", color: "var(--gold)" }}>Administração ✦</a>}
            <button onClick={() => supabase.auth.signOut()} style={S.signout}>Sair</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1140, margin: "0 auto", padding: "32px 28px 60px" }}>
        {/* Greeting + seletor de rede */}
        <div style={{ animation: "rise .5s ease both", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <p style={{ color: "var(--muted)", fontSize: 14, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
              {scopeName}
            </p>
            <h1 style={{ fontSize: 34, color: "var(--navy)", marginTop: 4 }}>
              {who ? `Paz, ${who.name.split(" ")[0]}.` : "Governo pastoral"}
            </h1>
            {who && <p style={{ color: "var(--gold)", fontWeight: 700, marginTop: 2 }}>{who.role}</p>}
          </div>
          {multi && (
            <div style={S.scopeBox}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>Visão</label>
              <select style={S.scopeSel} value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="">Toda a rede</option>
                {churches.map((c) => <option key={c.id} value={c.id}>{c.name} · {CHURCH_TYPE_LABELS[c.type]}</option>)}
              </select>
            </div>
          )}
        </div>

        {err && <p style={S.err}>Não foi possível carregar os indicadores: {err}</p>}

        {!stats && !err && <p style={{ color: "var(--muted)", marginTop: 28 }}>Carregando indicadores…</p>}

        {stats && (
          <>
            {/* KPIs */}
            <section style={S.kpiGrid}>
              <Kpi i={0} label="Membros" value={stats.total_members} accent />
              <Kpi i={1} label="Visitantes" value={stats.total_visitors} />
              <Kpi i={2} label="Células" value={stats.total_groups} />
              <Kpi i={3} label="Relatórios" value={stats.total_reports} />
              <Kpi i={4} label="Batismos" value={stats.baptisms} />
            </section>

            <section style={S.twoCol}>
              {/* Journey distribution */}
              <div style={S.panel}>
                <h2 style={S.panelTitle}>Jornada espiritual</h2>
                <p style={S.panelSub}>Distribuição dos membros por etapa</p>
                <JourneyBars byStage={stats.by_stage} />
              </div>

              {/* Reports trend */}
              <div style={S.panel}>
                <h2 style={S.panelTitle}>Tendência de presença</h2>
                <p style={S.panelSub}>Presentes e visitantes por reunião</p>
                <TrendChart data={stats.reports_trend} />
              </div>
            </section>

            {/* Detalhamento por igreja (só faz sentido com rede) */}
            {multi && breakdown.length > 1 && (
              <div style={{ ...S.panel, marginTop: 22 }}>
                <h2 style={S.panelTitle}>Por igreja / setor</h2>
                <p style={S.panelSub}>Comparativo entre as igrejas da rede</p>
                <NetworkTable rows={breakdown} onPick={(id) => setScope(id)} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function NetworkTable({ rows, onPick }: { rows: ChurchBreakdown[]; onPick: (id: string) => void }) {
  return (
    <div style={{ marginTop: 14, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <th style={S.th}>Igreja</th><th style={S.th}>Tipo</th>
            <th style={S.thN}>Membros</th><th style={S.thN}>Visitantes</th>
            <th style={S.thN}>Células</th><th style={S.thN}>Relatórios</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.church_id} style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }} onClick={() => onPick(r.church_id)}>
              <td style={{ ...S.td, fontWeight: 700, color: "var(--navy)" }}>{r.church_name}</td>
              <td style={S.td}>{CHURCH_TYPE_LABELS[r.church_type]}</td>
              <td style={S.tdN}>{r.membros}</td>
              <td style={S.tdN}>{r.visitantes}</td>
              <td style={S.tdN}>{r.grupos}</td>
              <td style={S.tdN}>{r.relatorios}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value, accent, i }: { label: string; value: number; accent?: boolean; i: number }) {
  return (
    <div style={{ ...S.kpi, ...(accent ? S.kpiAccent : {}), animation: `rise .5s ease both`, animationDelay: `${0.06 * i + 0.1}s` }}>
      <span style={{ ...S.kpiValue, color: accent ? "var(--gold)" : "var(--navy)" }}>{value}</span>
      <span style={{ ...S.kpiLabel, color: accent ? "#cdd9ea" : "var(--muted)" }}>{label}</span>
    </div>
  );
}

function JourneyBars({ byStage }: { byStage: DashboardStats["by_stage"] }) {
  const entries = Object.entries(byStage) as [keyof typeof JOURNEY_LABELS, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  if (entries.length === 0) return <p style={S.empty}>Sem dados ainda.</p>;
  return (
    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      {entries.map(([stage, n], idx) => (
        <div key={stage} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 130, fontSize: 13, color: "var(--navy2)", fontWeight: 600, textAlign: "right" }}>
            {JOURNEY_LABELS[stage]}
          </span>
          <div style={{ flex: 1, height: 22, background: "var(--bg)", borderRadius: 6, overflow: "hidden" }}>
            <div
              style={{
                width: `${(n / max) * 100}%`, height: "100%",
                background: "linear-gradient(90deg, var(--navy2), var(--gold))",
                borderRadius: 6, transformOrigin: "left",
                animation: `grow .7s cubic-bezier(.2,.8,.2,1) both`, animationDelay: `${0.05 * idx + 0.2}s`,
              }}
            />
          </div>
          <span style={{ width: 28, fontWeight: 800, color: "var(--navy)", fontSize: 14 }}>{n}</span>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ data }: { data: DashboardStats["reports_trend"] }) {
  if (!data || data.length === 0) return <p style={S.empty}>Sem relatórios registrados ainda.</p>;
  const W = 460, H = 200, pad = 30;
  const max = Math.max(1, ...data.map((d) => Math.max(d.attendance, d.visitors)));
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, data.length - 1);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = (key: "attendance" | "visitors") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");

  return (
    <div style={{ marginTop: 14 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={pad} x2={W - pad} y1={y(max * t)} y2={y(max * t)} stroke="var(--border)" strokeWidth={1} />
        ))}
        <path d={line("attendance")} fill="none" stroke="var(--navy)" strokeWidth={2.5} strokeLinejoin="round" />
        <path d={line("visitors")} fill="none" stroke="var(--gold)" strokeWidth={2.5} strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.attendance)} r={3.5} fill="var(--navy)" />
            <circle cx={x(i)} cy={y(d.visitors)} r={3.5} fill="var(--gold)" />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)" fontFamily="var(--body)">{d.week}</text>
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 18, marginTop: 8, justifyContent: "center" }}>
        <Legend color="var(--navy)" label="Presentes" />
        <Legend color="var(--gold)" label="Visitantes" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
      <span style={{ width: 12, height: 3, background: color, borderRadius: 2 }} /> {label}
    </span>
  );
}

const S: Record<string, React.CSSProperties> = {
  top: { background: "var(--navy)", borderBottom: "3px solid var(--gold)" },
  brandMark: { color: "var(--gold)", fontSize: 18 },
  brandSep: { color: "#9fb1c8", fontSize: 13, fontWeight: 600, borderLeft: "1px solid #2C4A6E", paddingLeft: 12, marginLeft: 4 },
  signout: { background: "transparent", color: "#cdd9ea", border: "1px solid #2C4A6E", borderRadius: 9, padding: "8px 16px", cursor: "pointer", fontFamily: "var(--body)", fontWeight: 600, fontSize: 14 },
  err: { marginTop: 24, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", padding: 14, borderRadius: 10 },
  kpiGrid: { marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16 },
  kpi: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 22px 18px", display: "flex", flexDirection: "column", gap: 6 },
  kpiAccent: { background: "var(--navy)", border: "1px solid var(--navy)" },
  kpiValue: { fontFamily: "var(--display)", fontSize: 44, fontWeight: 700, lineHeight: 1 },
  kpiLabel: { fontSize: 13, fontWeight: 600, letterSpacing: 0.4 },
  twoCol: { marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 22 },
  panel: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, animation: "rise .5s ease both", animationDelay: ".25s" },
  panelTitle: { fontSize: 20, color: "var(--navy)" },
  panelSub: { fontSize: 13, color: "var(--muted)", marginTop: 2 },
  empty: { color: "var(--muted)", marginTop: 18, fontStyle: "italic" },
  scopeBox: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px" },
  scopeSel: { padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 9, fontSize: 14, fontFamily: "var(--body)", fontWeight: 700, color: "var(--navy)", background: "var(--bg)", minWidth: 200 },
  th: { padding: "8px 10px", fontWeight: 700 },
  thN: { padding: "8px 10px", fontWeight: 700, textAlign: "right" },
  td: { padding: "11px 10px" },
  tdN: { padding: "11px 10px", textAlign: "right", fontWeight: 700, color: "var(--navy2)" },
};
