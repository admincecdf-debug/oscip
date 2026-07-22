"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Pencil, X, Users, Building2, Send, FileText,
  Flame, Music, Sparkles, Flower, HandHelping, Heart, Crown, Award, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ministrySchema, type MinistryInput,
  ministryPostSchema, type MinistryPostInput,
} from "@/schemas";
import { useMinistries, useMinistryMembers, useMinistryPosts, useChurches, useAllMembers, useMinistryGoalsVsActual } from "@/hooks/use-queries";
import { setMinistryGoal } from "@/services/goals";
import { supabase } from "@/lib/supabase/client";
import {
  createMinistry, updateMinistry, deleteMinistry,
  addMinistryMember, updateMinistryMemberRole, removeMinistryMember,
  createMinistryPost, deleteMinistryPost,
} from "@/services/ministries";
import { logAudit } from "@/services/audit";
import type { Ministry, MinistryRole } from "@/types/domain";

const ICONS: Record<string, React.ComponentType<{className?:string}>> = {
  "flame": Flame, "music": Music, "sparkles": Sparkles, "flower": Flower,
  "praying-hands": HandHelping, "hand-helping": HandHelping, "heart": Heart,
  "crown": Crown,
};

const ROLE_LABELS: Record<MinistryRole, string> = {
  lider: "Líder", vice: "Vice-líder", membro: "Membro",
};

const ROLE_COLORS: Record<MinistryRole, string> = {
  lider: "bg-gold/15 text-gold border-gold/30",
  vice: "bg-blue-50 text-blue-700 border-blue-200",
  membro: "bg-muted/15 text-muted border-border",
};

export function MinistriesAdmin({ initialChurchId = "" }: { initialChurchId?: string } = {}) {
  const [churchFilter, setChurchFilter] = useState<string>(initialChurchId);
  const [selectedMinistry, setSelectedMinistry] = useState<Ministry | null>(null);
  const { data: ministries = [] } = useMinistries(churchFilter || null);
  const { data: churches = [] } = useChurches();
  const qc = useQueryClient();

  const churchMap = new Map(churches.map((c) => [c.id, c]));

  return (
    <div className="space-y-4">
      {selectedMinistry && (
        <MinistryDetail
          ministry={selectedMinistry}
          church={churchMap.get(selectedMinistry.church_id)}
          onClose={() => setSelectedMinistry(null)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-gold" />Ministérios</CardTitle>
          <CardDescription>Cada igreja organiza seus ministérios e os membros vinculados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {churches.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted">Comunidade</Label>
              <select value={churchFilter} onChange={(e) => setChurchFilter(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:w-72">
                <option value="">Todas as comunidades</option>
                {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Form de criar novo */}
          <CreateMinistryForm churchFilter={churchFilter} churches={churches}
            onCreated={() => qc.invalidateQueries({ queryKey: ["ministries"] })} />
        </CardContent>
      </Card>

      {/* Lista de ministérios */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ministries.length === 0 && (
          <p className="col-span-full text-sm italic text-muted">
            Nenhum ministério cadastrado. {churches.length > 0 ? "Use o formulário acima ou aplique o seed inicial." : ""}
          </p>
        )}
        {ministries.map((m) => (
          <MinistryCard key={m.id} ministry={m} church={churchMap.get(m.church_id)}
            onOpen={() => setSelectedMinistry(m)} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// CARD COMPACTO DE MINISTÉRIO
// ============================================================
function MinistryCard({ ministry: ms, church, onOpen }: { ministry: Ministry; church?: { name: string } | undefined; onOpen: () => void }) {
  const { data: members = [] } = useMinistryMembers(ms.id);
  const { data: posts = [] } = useMinistryPosts(ms.id);
  const Ico = ICONS[ms.icon ?? "sparkles"] ?? Sparkles;

  return (
    <button onClick={onOpen} className="text-left">
      <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md"
        style={{ borderTop: `4px solid ${ms.color ?? "#C9A227"}` }}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl p-2.5 text-white"
              style={{ backgroundColor: ms.color ?? "#C9A227" }}>
              <Ico className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <b className="block truncate text-navy">{ms.name}</b>
              {church && (
                <p className="flex items-center gap-1 text-xs text-muted">
                  <Building2 className="h-3 w-3" />{church.name}
                </p>
              )}
              {ms.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{ms.description}</p>}
              <div className="mt-2 flex gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{members.length}</span>
                <span className="flex items-center gap-0.5"><FileText className="h-3 w-3" />{posts.length}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

// ============================================================
// FORM: CRIAR MINISTÉRIO
// ============================================================
function CreateMinistryForm({ churchFilter, churches, onCreated }: {
  churchFilter: string;
  churches: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [churchId, setChurchId] = useState(churchFilter || (churches[0]?.id ?? ""));
  const [err, setErr] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<MinistryInput>({ resolver: zodResolver(ministrySchema), defaultValues: { color: "#C9A227", icon: "sparkles" } });

  async function onSubmit(v: MinistryInput) {
    setErr("");
    if (!churchId) { setErr("Selecione uma comunidade"); return; }
    try {
      const created = await createMinistry(supabase, {
        church_id: churchId,
        name: v.name,
        description: v.description || null,
        color: v.color || "#C9A227",
        icon: v.icon || "sparkles",
        is_active: true,
      });
      await logAudit(supabase, "insert", "ministries", created.id, { name: v.name });
      reset({ color: "#C9A227", icon: "sparkles" });
      setOpen(false);
      onCreated();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao criar");
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" className="gap-2 self-start">
        <Plus className="h-4 w-4" />Criar novo ministério
      </Button>
    );
  }

  return (
    <Card className="border-2 border-dashed border-gold/40 bg-gold/5">
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="flex items-center justify-between">
            <b className="text-navy">Novo ministério</b>
            <Button type="button" onClick={() => setOpen(false)} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Cancelar</Button>
          </div>
          {churches.length > 1 && (
            <Field label="Comunidade">
              <select value={churchId} onChange={(e) => setChurchId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Selecione —</option>
                {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Nome" error={errors.name?.message}>
            <Input {...register("name")} placeholder="Ex: Casais com Propósito" />
          </Field>
          <Field label="Descrição" error={errors.description?.message}>
            <textarea {...register("description")} rows={2}
              className="w-full rounded-md border bg-background p-3 text-sm" placeholder="Foco e objetivo do ministério" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cor (hex)" error={errors.color?.message}>
              <Input {...register("color")} placeholder="#C9A227" />
            </Field>
            <Field label="Ícone">
              <select {...register("icon")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="sparkles">✨ Genérico</option>
                <option value="flame">🔥 Chama (Jovens)</option>
                <option value="music">🎵 Música (Louvor)</option>
                <option value="flower">🌸 Flor (Feminino)</option>
                <option value="praying-hands">🙏 Mãos (Intercessão)</option>
                <option value="hand-helping">🤝 Ajuda (Social)</option>
                <option value="heart">❤️ Coração (Casais)</option>
                <option value="crown">👑 Coroa (Liderança)</option>
              </select>
            </Field>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={isSubmitting} className="gap-2"><Plus className="h-4 w-4" />Criar ministério</Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================
// DETAIL: GERENCIAR MINISTÉRIO (membros + posts)
// ============================================================
function MinistryDetail({ ministry: ms, church, onClose }: { ministry: Ministry; church?: { name: string } | undefined; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: members = [] } = useMinistryMembers(ms.id);
  const { data: allMembers = [] } = useAllMembers();
  const { data: posts = [] } = useMinistryPosts(ms.id);
  const [editingMs, setEditingMs] = useState(false);

  // Map id → full_name dos members do sistema (pra mostrar nome no card de membro)
  const memberInfo = new Map(allMembers.map((m) => [m.id, m]));

  async function removeMs() {
    if (!confirm(`Apagar ministério "${ms.name}"?\n\nIsso remove vinculações e posts deste ministério.`)) return;
    try {
      await deleteMinistry(supabase, ms.id);
      await logAudit(supabase, "delete", "ministries", ms.id, { name: ms.name });
      qc.invalidateQueries({ queryKey: ["ministries"] });
      onClose();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  const Ico = ICONS[ms.icon ?? "sparkles"] ?? Sparkles;

  return (
    <Card className="border-2" style={{ borderColor: ms.color ?? "#C9A227" }}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl p-2.5 text-white" style={{ backgroundColor: ms.color ?? "#C9A227" }}>
              <Ico className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{ms.name}</CardTitle>
              <CardDescription className="flex items-center gap-1"><Building2 className="h-3 w-3" />{church?.name ?? "—"}</CardDescription>
              {ms.description && <p className="mt-2 text-sm text-muted">{ms.description}</p>}
            </div>
          </div>
          <div className="flex gap-1">
            <Button onClick={() => setEditingMs((v) => !v)} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
            <Button onClick={removeMs} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
            <Button onClick={onClose} variant="ghost" size="sm"><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {editingMs && (
          <EditMinistryForm ministry={ms} onSaved={() => { setEditingMs(false); qc.invalidateQueries({ queryKey: ["ministries"] }); }} />
        )}

        <MinistryGoalWidget ministryId={ms.id} ministryName={ms.name} currentCount={members.length} />

        {/* MEMBROS DO MINISTÉRIO */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy-600">
            <Users className="h-4 w-4 text-gold" />Membros ({members.length})
          </h3>

          <AddMemberForm ministryId={ms.id} alreadyInMembers={new Set(members.map((m) => m.member_id))} allMembers={allMembers}
            onAdded={() => qc.invalidateQueries({ queryKey: ["ministry-members", ms.id] })} />

          {members.length === 0 ? (
            <p className="mt-2 text-sm italic text-muted">Nenhum membro vinculado ainda.</p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {members.map((mm) => {
                const info = memberInfo.get(mm.member_id);
                return (
                  <div key={mm.id} className="flex items-center gap-2 rounded-md border bg-card p-2.5">
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-sm text-navy">{info?.full_name ?? "Membro removido"}</b>
                      {info?.phone && <p className="text-[11px] text-muted">{info.phone}</p>}
                    </div>
                    <select value={mm.role}
                      onChange={async (e) => {
                        await updateMinistryMemberRole(supabase, mm.id, e.target.value as MinistryRole);
                        qc.invalidateQueries({ queryKey: ["ministry-members", ms.id] });
                      }}
                      className={`h-7 rounded-md border px-2 text-[11px] font-bold uppercase ${ROLE_COLORS[mm.role]}`}>
                      <option value="lider">Líder</option>
                      <option value="vice">Vice</option>
                      <option value="membro">Membro</option>
                    </select>
                    <Button onClick={async () => {
                      if (!confirm(`Remover ${info?.full_name ?? "este membro"} de ${ms.name}?`)) return;
                      await removeMinistryMember(supabase, mm.id);
                      qc.invalidateQueries({ queryKey: ["ministry-members", ms.id] });
                    }} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* POSTS DO MINISTÉRIO */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy-600">
            <FileText className="h-4 w-4 text-gold" />Posts ({posts.length})
          </h3>

          <CreatePostForm ministryId={ms.id}
            onCreated={() => qc.invalidateQueries({ queryKey: ["ministry-posts", ms.id] })} />

          {posts.length === 0 ? (
            <p className="mt-2 text-sm italic text-muted">Nenhum post publicado ainda.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {posts.map((p) => (
                <div key={p.id} className="rounded-md border bg-card p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <b className="block text-navy">{p.title}</b>
                      {p.published_at && (
                        <p className="text-[11px] text-muted">
                          {new Date(p.published_at).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                      {p.body && <p className="mt-1 text-sm text-ink line-clamp-3">{p.body}</p>}
                    </div>
                    <Button onClick={async () => {
                      if (!confirm("Apagar este post?")) return;
                      await deleteMinistryPost(supabase, p.id);
                      qc.invalidateQueries({ queryKey: ["ministry-posts", ms.id] });
                    }} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

// ============================================================
// FORM: EDITAR MINISTÉRIO
// ============================================================
function EditMinistryForm({ ministry: ms, onSaved }: { ministry: Ministry; onSaved: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<MinistryInput>({
      resolver: zodResolver(ministrySchema),
      defaultValues: {
        name: ms.name,
        description: ms.description ?? "",
        color: ms.color ?? "#C9A227",
        icon: ms.icon ?? "sparkles",
      },
    });

  async function onSubmit(v: MinistryInput) {
    try {
      await updateMinistry(supabase, ms.id, {
        name: v.name,
        description: v.description || null,
        color: v.color || "#C9A227",
        icon: v.icon || "sparkles",
      });
      await logAudit(supabase, "update", "ministries", ms.id, { name: v.name });
      onSaved();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-md border bg-navy-50/50 p-3 space-y-2">
      <Field label="Nome" error={errors.name?.message}><Input {...register("name")} /></Field>
      <Field label="Descrição"><textarea {...register("description")} rows={2} className="w-full rounded-md border bg-background p-3 text-sm" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cor"><Input {...register("color")} /></Field>
        <Field label="Ícone">
          <select {...register("icon")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="sparkles">Genérico</option><option value="flame">Chama</option>
            <option value="music">Música</option><option value="flower">Flor</option>
            <option value="praying-hands">Mãos</option><option value="hand-helping">Ajuda</option>
            <option value="heart">Coração</option><option value="crown">Coroa</option>
          </select>
        </Field>
      </div>
      <Button type="submit" disabled={isSubmitting} size="sm" className="gap-1"><Pencil className="h-3 w-3" />Salvar</Button>
    </form>
  );
}

// ============================================================
// FORM: ADICIONAR MEMBRO AO MINISTÉRIO
// ============================================================
function AddMemberForm({ ministryId, alreadyInMembers, allMembers, onAdded }: {
  ministryId: string;
  alreadyInMembers: Set<string>;
  allMembers: { id: string; full_name: string }[];
  onAdded: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [role, setRole] = useState<MinistryRole>("membro");
  const [busy, setBusy] = useState(false);

  const candidates = allMembers.filter((m) => !alreadyInMembers.has(m.id));

  async function add() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await addMinistryMember(supabase, ministryId, selectedId, role);
      await logAudit(supabase, "insert", "ministry_members", selectedId, { ministry_id: ministryId });
      setSelectedId(""); setRole("membro");
      onAdded();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border bg-card p-2">
      <div className="min-w-[180px] flex-1">
        <Label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">Adicionar membro</Label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">— Escolha um membro —</option>
          {candidates.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      </div>
      <select value={role} onChange={(e) => setRole(e.target.value as MinistryRole)}
        className="h-9 rounded-md border bg-background px-3 text-sm">
        <option value="lider">Líder</option>
        <option value="vice">Vice-líder</option>
        <option value="membro">Membro</option>
      </select>
      <Button onClick={add} disabled={!selectedId || busy} size="sm" className="gap-1">
        <Plus className="h-3 w-3" />Adicionar
      </Button>
    </div>
  );
}

// ============================================================
// FORM: CRIAR POST DO MINISTÉRIO
// ============================================================
function CreatePostForm({ ministryId, onCreated }: { ministryId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<MinistryPostInput>({ resolver: zodResolver(ministryPostSchema), defaultValues: { is_published: true } });

  async function onSubmit(v: MinistryPostInput) {
    try {
      await createMinistryPost(supabase, {
        ministry_id: ministryId,
        title: v.title, body: v.body || null,
        cover_url: v.cover_url || null,
        is_published: v.is_published,
        published_at: v.is_published ? new Date().toISOString() : null,
      });
      reset({ is_published: true });
      setOpen(false);
      onCreated();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" size="sm" className="gap-2">
        <Send className="h-3.5 w-3.5" />Criar post pra este ministério
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-md border bg-navy-50/50 p-3 space-y-2">
      <Field label="Título" error={errors.title?.message}>
        <Input {...register("title")} placeholder="Ex: Ensaio na quarta às 19h" />
      </Field>
      <Field label="Mensagem">
        <textarea {...register("body")} rows={3} className="w-full rounded-md border bg-background p-3 text-sm"
          placeholder="O recado que vai aparecer pros membros do ministério" />
      </Field>
      <div className="flex justify-between">
        <Button type="button" onClick={() => setOpen(false)} variant="ghost" size="sm">Cancelar</Button>
        <Button type="submit" disabled={isSubmitting} size="sm" className="gap-1">
          <Send className="h-3 w-3" />Publicar
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ============================================================
// META DE INTEGRANTES DO MINISTÉRIO (UX-003 Cap. 3 Parte 3)
// ============================================================
function MinistryGoalWidget({ ministryId, ministryName, currentCount }: { ministryId: string; ministryName: string; currentCount: number }) {
  const qc = useQueryClient();
  const { data: goals = [] } = useMinistryGoalsVsActual();
  const goal = goals.find((g) => g.scope_id === ministryId);
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(String(goal?.target_value ?? ""));
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = Number(target);
    if (!n || n <= 0) return;
    setBusy(true);
    try {
      await setMinistryGoal(supabase, ministryId, ministryName, new Date().getFullYear(), n);
      qc.invalidateQueries({ queryKey: ["ministry-goals-vs-actual"] });
      setEditing(false);
    } finally { setBusy(false); }
  }

  const STATUS_COLOR: Record<string, string> = { atingido: "text-green-600", no_caminho: "text-gold", atencao: "text-red-500" };

  return (
    <section className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-600">
          <Target className="h-3.5 w-3.5 text-gold" />Meta de integrantes ({new Date().getFullYear()})
        </h3>
        {!editing && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>{goal ? "Editar" : "Definir meta"}</Button>}
      </div>
      {editing ? (
        <div className="mt-2 flex items-center gap-2">
          <Input type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Ex: 20" className="h-8 w-28" />
          <Button size="sm" onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
        </div>
      ) : goal ? (
        <div className="mt-1.5">
          <p className={`text-sm font-bold ${STATUS_COLOR[goal.status_meta]}`}>{currentCount} de {goal.target_value} ({goal.pct_atingido}%)</p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, goal.pct_atingido)}%` }} />
          </div>
        </div>
      ) : (
        <p className="mt-1 text-xs italic text-muted-foreground">Sem meta definida ainda.</p>
      )}
    </section>
  );
}
