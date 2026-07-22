"use client";
import { useEffect, useState } from "react";
import {
  getMyProfile, isAdminRole, listProfiles, updateLifeGroup, getMyLifeGroups,
  listEvents, createEvent, updateEvent, deleteEvent,
  listSermons, createSermon, updateSermon, deleteSermon,
  listChurches, CHURCH_TYPE_LABELS,
  youtubeThumb, youtubeId, EVENT_STATUS_LABELS, ROLE_LABELS,
  type Tables, type Enums,
} from "@/lib/cec";
import { supabase } from "@/lib/supabase";

type ChurchLite = { id: string; name: string; type: Enums<"church_type">; parent_id: string | null };

/** Contexto simples de igreja: lista acessível + seleção atual. */
function useChurchContext() {
  const [churches, setChurches] = useState<ChurchLite[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [myChurch, setMyChurch] = useState<string>("");
  useEffect(() => {
    Promise.all([listChurches(supabase), getMyProfile(supabase)])
      .then(([cs, p]) => {
        setChurches(cs as ChurchLite[]);
        const mine = p?.church_id ?? (cs[0]?.id ?? "");
        setMyChurch(mine);
        setSelected(mine);
      })
      .catch(() => {});
  }, []);
  return { churches, selected, setSelected, myChurch };
}

type Profile = { id: string; full_name: string; role: Enums<"user_role"> };
type Tab = "sermons" | "events" | "groups";

export default function Admin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("sermons");
  const church = useChurchContext();

  useEffect(() => {
    getMyProfile(supabase)
      .then((p) => setAllowed(isAdminRole(p?.role)))
      .catch(() => setAllowed(false));
  }, []);

  if (allowed === null) return <Shell><p style={{ color: "var(--muted)" }}>Carregando…</p></Shell>;
  if (!allowed) return (
    <Shell>
      <div style={S.lock}>
        <h2 style={{ fontFamily: "var(--display)", color: "var(--navy)" }}>Acesso restrito</h2>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>
          O painel administrativo é exclusivo para liderança apostólica (apóstolo ou pastor).
          Ajuste seu papel na tabela <code>profiles</code> para acessar.
        </p>
        <a href="/" style={S.linkBtn}>← Voltar ao painel</a>
      </div>
    </Shell>
  );

  return (
    <Shell>
      {church.churches.length > 1 && (
        <div style={S.churchBar}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--navy2)" }}>Igreja:</span>
          <select style={S.churchSel} value={church.selected} onChange={(e) => church.setSelected(e.target.value)}>
            {church.churches.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {CHURCH_TYPE_LABELS[c.type]}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Conteúdo criado entra nesta igreja</span>
        </div>
      )}
      <div style={S.tabs}>
        <TabBtn active={tab === "sermons"} onClick={() => setTab("sermons")}>Pregações</TabBtn>
        <TabBtn active={tab === "events"} onClick={() => setTab("events")}>Agenda</TabBtn>
        <TabBtn active={tab === "groups"} onClick={() => setTab("groups")}>Life Groups</TabBtn>
      </div>
      {tab === "sermons" && <SermonsAdmin churchId={church.selected} />}
      {tab === "events" && <EventsAdmin churchId={church.selected} />}
      {tab === "groups" && <GroupsAdmin churchId={church.selected} />}
    </Shell>
  );
}

/* ---------------- Pregações ---------------- */
function SermonsAdmin({ churchId }: { churchId: string }) {
  const [items, setItems] = useState<Tables<"sermons">[]>([]);
  const [form, setForm] = useState({ title: "", reference: "", speaker: "", youtube_url: "", category: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => listSermons(supabase).then(setItems).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.title || !form.youtube_url) { setMsg("Título e link do YouTube são obrigatórios."); return; }
    if (!youtubeId(form.youtube_url)) { setMsg("Link do YouTube inválido."); return; }
    if (!churchId) { setMsg("Selecione uma igreja."); return; }
    setBusy(true); setMsg("");
    try {
      await createSermon(supabase, {
        title: form.title, reference: form.reference || null, speaker: form.speaker || null,
        youtube_url: form.youtube_url, category: form.category || null,
        thumbnail_url: youtubeThumb(form.youtube_url), church_id: churchId,
      });
      setForm({ title: "", reference: "", speaker: "", youtube_url: "", category: "" });
      load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm("Remover esta pregação?")) return;
    await deleteSermon(supabase, id); load();
  }

  const shown = items.filter((s) => !churchId || s.church_id === churchId);

  return (
    <div>
      <Card title="Adicionar pregação (YouTube)">
        <Field label="Título"><input style={S.inp} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: O Bezerro de Ouro" /></Field>
        <Field label="Link do YouTube"><input style={S.inp} value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." /></Field>
        <Row>
          <Field label="Referência"><input style={S.inp} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Ex 32:1-14" /></Field>
          <Field label="Pregador"><input style={S.inp} value={form.speaker} onChange={(e) => setForm({ ...form, speaker: e.target.value })} placeholder="Pra. Anne" /></Field>
          <Field label="Categoria"><input style={S.inp} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Série" /></Field>
        </Row>
        {form.youtube_url && youtubeThumb(form.youtube_url) && (
          <img src={youtubeThumb(form.youtube_url)!} alt="" style={{ width: 160, borderRadius: 10, marginTop: 8 }} />
        )}
        {msg && <p style={S.err}>{msg}</p>}
        <button style={S.primary} onClick={add} disabled={busy}>{busy ? "Salvando…" : "+ Adicionar pregação"}</button>
      </Card>

      <h3 style={S.listTitle}>Pregações publicadas ({shown.length})</h3>
      {shown.map((s) => (
        <div key={s.id} style={S.listRow}>
          <img src={s.thumbnail_url || youtubeThumb(s.youtube_url) || ""} alt="" style={{ width: 92, height: 52, objectFit: "cover", borderRadius: 8, background: "#0001" }} />
          <div style={{ flex: 1 }}>
            <b style={{ color: "var(--navy)" }}>{s.title}</b>
            <div style={S.meta}>{[s.reference, s.speaker, s.category].filter(Boolean).join(" · ")}</div>
          </div>
          <a href={s.youtube_url} target="_blank" rel="noreferrer" style={S.ghost}>Abrir</a>
          <button style={S.del} onClick={() => remove(s.id)}>Excluir</button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Agenda ---------------- */
function EventsAdmin({ churchId }: { churchId: string }) {
  const [items, setItems] = useState<Tables<"events">[]>([]);
  const [form, setForm] = useState({ title: "", starts_at: "", location: "", status: "abertas" as Enums<"event_status">, registration_url: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => listEvents(supabase).then(setItems).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.title || !form.starts_at) { setMsg("Título e data são obrigatórios."); return; }
    if (!churchId) { setMsg("Selecione uma igreja."); return; }
    setBusy(true); setMsg("");
    try {
      await createEvent(supabase, {
        title: form.title, starts_at: new Date(form.starts_at).toISOString(),
        location: form.location || null, status: form.status,
        registration_url: form.registration_url || null, church_id: churchId,
      });
      setForm({ title: "", starts_at: "", location: "", status: "abertas", registration_url: "" });
      load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  async function changeStatus(id: string, status: Enums<"event_status">) {
    await updateEvent(supabase, id, { status }); load();
  }
  async function remove(id: string) {
    if (!confirm("Remover este evento?")) return;
    await deleteEvent(supabase, id); load();
  }

  const shown = items.filter((ev) => !churchId || ev.church_id === churchId);

  return (
    <div>
      <Card title="Adicionar evento à agenda">
        <Field label="Título"><input style={S.inp} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Curso de Noivos" /></Field>
        <Row>
          <Field label="Data e hora"><input type="datetime-local" style={S.inp} value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></Field>
          <Field label="Local"><input style={S.inp} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Templo Sede" /></Field>
        </Row>
        <Row>
          <Field label="Status">
            <select style={S.inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Enums<"event_status"> })}>
              {(Object.keys(EVENT_STATUS_LABELS) as Enums<"event_status">[]).map((k) => <option key={k} value={k}>{EVENT_STATUS_LABELS[k]}</option>)}
            </select>
          </Field>
          <Field label="Link de inscrição (opcional)"><input style={S.inp} value={form.registration_url} onChange={(e) => setForm({ ...form, registration_url: e.target.value })} placeholder="https://..." /></Field>
        </Row>
        {msg && <p style={S.err}>{msg}</p>}
        <button style={S.primary} onClick={add} disabled={busy}>{busy ? "Salvando…" : "+ Adicionar evento"}</button>
      </Card>

      <h3 style={S.listTitle}>Próximos eventos ({shown.length})</h3>
      {shown.map((ev) => (
        <div key={ev.id} style={S.listRow}>
          <div style={{ flex: 1 }}>
            <b style={{ color: "var(--navy)" }}>{ev.title}</b>
            <div style={S.meta}>{new Date(ev.starts_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{ev.location ? ` · ${ev.location}` : ""}</div>
          </div>
          <select style={{ ...S.inp, width: "auto", padding: "8px 10px" }} value={ev.status} onChange={(e) => changeStatus(ev.id, e.target.value as Enums<"event_status">)}>
            {(Object.keys(EVENT_STATUS_LABELS) as Enums<"event_status">[]).map((k) => <option key={k} value={k}>{EVENT_STATUS_LABELS[k]}</option>)}
          </select>
          <button style={S.del} onClick={() => remove(ev.id)}>Excluir</button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Life Groups ---------------- */
function GroupsAdmin({ churchId }: { churchId: string }) {
  const [groups, setGroups] = useState<Tables<"life_groups">[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [msg, setMsg] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = () => Promise.all([getMyLifeGroups(supabase), listProfiles(supabase)])
    .then(([g, p]) => { setGroups(g); setProfiles(p as Profile[]); })
    .catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  async function save(id: string, patch: { name?: string; leader_id?: string | null; coleader_id?: string | null }) {
    setSavingId(id); setMsg("");
    try { await updateLifeGroup(supabase, id, patch); }
    catch (e: any) { setMsg(e.message); }
    finally { setSavingId(null); }
  }

  const shown = groups.filter((g) => !churchId || g.church_id === churchId);

  return (
    <div>
      {msg && <p style={S.err}>{msg}</p>}
      {profiles.length === 0 && (
        <p style={{ ...S.meta, marginBottom: 12 }}>
          Dica: líderes e colíderes são escolhidos entre os usuários cadastrados (perfis). À medida que pessoas criam conta no app, elas aparecem aqui.
        </p>
      )}
      {shown.map((g) => (
        <Card key={g.id} title="">
          <Field label="Nome da célula">
            <input style={S.inp} defaultValue={g.name} onBlur={(e) => e.target.value !== g.name && save(g.id, { name: e.target.value })} />
          </Field>
          <Row>
            <Field label="Líder">
              <select style={S.inp} defaultValue={g.leader_id ?? ""} onChange={(e) => save(g.id, { leader_id: e.target.value || null })}>
                <option value="">— sem líder —</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({ROLE_LABELS[p.role]})</option>)}
              </select>
            </Field>
            <Field label="Colíder">
              <select style={S.inp} defaultValue={g.coleader_id ?? ""} onChange={(e) => save(g.id, { coleader_id: e.target.value || null })}>
                <option value="">— sem colíder —</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({ROLE_LABELS[p.role]})</option>)}
              </select>
            </Field>
          </Row>
          <div style={{ fontSize: 12, color: savingId === g.id ? "var(--gold)" : "var(--muted)", marginTop: 4 }}>
            {savingId === g.id ? "Salvando…" : "Alterações salvas automaticamente"}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- UI helpers ---------------- */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={S.top}>
        <div style={S.topin}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)", fontSize: 18 }}>✦</span>
            <span style={{ fontFamily: "var(--display)", color: "#fff", fontWeight: 700, fontSize: 19 }}>CEC FAMILY</span>
            <span style={S.sep}>Administração</span>
          </div>
          <a href="/" style={S.signout}>← Painel</a>
        </div>
      </header>
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "28px 22px 60px" }}>{children}</main>
    </div>
  );
}
function TabBtn({ active, onClick, children }: any) {
  return <button onClick={onClick} style={{ ...S.tab, ...(active ? S.tabOn : {}) }}>{children}</button>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.card}>
      {title && <h3 style={{ fontFamily: "var(--display)", color: "var(--navy)", marginBottom: 14, fontSize: 18 }}>{title}</h3>}
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ flex: 1, marginBottom: 12 }}><label style={S.lbl}>{label}</label>{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{children}</div>;
}

const S: Record<string, React.CSSProperties> = {
  top: { background: "var(--navy)", borderBottom: "3px solid var(--gold)" },
  topin: { maxWidth: 920, margin: "0 auto", padding: "0 22px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" },
  sep: { color: "#9fb1c8", fontSize: 13, fontWeight: 600, borderLeft: "1px solid #2C4A6E", paddingLeft: 10, marginLeft: 2 },
  signout: { color: "#cdd9ea", textDecoration: "none", border: "1px solid #2C4A6E", borderRadius: 9, padding: "8px 14px", fontWeight: 600, fontSize: 14 },
  tabs: { display: "flex", gap: 8, marginBottom: 22 },
  churchBar: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 },
  churchSel: { padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 9, fontSize: 14, fontFamily: "var(--body)", background: "var(--bg)", fontWeight: 700, color: "var(--navy)" },
  tab: { flex: 1, padding: "12px", borderRadius: 12, border: "1px solid var(--border)", background: "#fff", color: "var(--muted)", fontWeight: 700, fontFamily: "var(--body)", fontSize: 15, cursor: "pointer" },
  tabOn: { background: "var(--navy)", color: "#fff", borderColor: "var(--navy)" },
  card: { background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 16 },
  lbl: { display: "block", fontSize: 13, fontWeight: 700, color: "var(--navy2)", marginBottom: 6 },
  inp: { width: "100%", padding: 11, border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, fontFamily: "var(--body)", background: "var(--bg)" },
  primary: { marginTop: 8, background: "var(--gold)", color: "var(--navy)", fontWeight: 800, border: "none", borderRadius: 11, padding: "12px 20px", cursor: "pointer", fontSize: 15, fontFamily: "var(--body)" },
  listTitle: { fontFamily: "var(--display)", color: "var(--navy)", fontSize: 17, margin: "22px 0 12px" },
  listRow: { display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 10 },
  meta: { fontSize: 13, color: "var(--muted)", marginTop: 2 },
  ghost: { color: "var(--navy)", textDecoration: "none", fontWeight: 700, fontSize: 13, border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px" },
  del: { color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "7px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "var(--body)" },
  err: { color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", padding: 10, borderRadius: 9, margin: "10px 0", fontSize: 14 },
  lock: { background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 28, textAlign: "center", maxWidth: 460, margin: "40px auto" },
  linkBtn: { display: "inline-block", marginTop: 16, color: "var(--navy)", fontWeight: 700, textDecoration: "none" },
};
