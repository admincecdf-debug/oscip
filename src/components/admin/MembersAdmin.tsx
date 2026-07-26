"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, X, KeyRound, Check, Copy, AlertCircle, ExternalLink, ArrowRightLeft, History, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  memberSchema, type MemberInput,
  memberCreateSchema, type MemberCreateInput,
} from "@/schemas";
import { useAllMembers, useCells, useChurches, useStates, useNucleos, useDistricts, useSectors, useChurchAncestry, useMemberRelocations } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { updateMember, deleteMember } from "@/services/members";
import { relocateMember } from "@/services/relocations";
import { MemberEditDialog } from "./MemberEditDialog";
import { logAudit } from "@/services/audit";
import type { Member, RelocationReason } from "@/types/domain";

const RELOCATION_REASONS: [RelocationReason, string][] = [
  ["correcao_cadastro","Correção de cadastro"], ["mudanca_endereco","Mudança de endereço"],
  ["transferencia_ministerial","Transferência ministerial"], ["mudanca_igreja","Mudança de igreja"],
  ["multiplicacao_lg","Multiplicação de Life Group"], ["reorganizacao_territorial","Reorganização territorial"],
  ["designacao_pastoral","Designação pastoral"], ["solicitacao_membro","Solicitação do membro"], ["outro","Outro"],
];

const STAGES: [Member["journey_stage"], string][] = [
  ["visitante","Visitante"],["novo_convertido","Novo convertido"],["consolidacao","Consolidação"],
  ["discipulado","Discipulado"],["batismo","Batismo"],["membro_ativo","Membro ativo"],
  ["servo","Servo"],["lider_formacao","Líder em formação"],["lider","Líder"],
  ["supervisor","Supervisor"],["missionario","Missionário"],
];

export function MembersAdmin() {
  const { data: members = [] } = useAllMembers();
  const { data: cells = [] } = useCells();
  const { data: churches = [] } = useChurches();
  const { data: statesList = [] } = useStates();
  const { data: nucleosList = [] } = useNucleos();
  const { data: districtsList = [] } = useDistricts();
  const { data: sectorsList = [] } = useSectors();
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [relocating, setRelocating] = useState<Member | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Member | null>(null);
  const [fullEditing, setFullEditing] = useState<Member | null>(null);
  const [credentials, setCredentials] = useState<{ name: string; email: string; password: string } | null>(null);

  // ============ FILTROS DA LISTAGEM (busca + estrutura territorial) ============
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStageList, setFilterStageList] = useState("");
  const [filterStateId, setFilterStateId] = useState("");
  const [filterDistrictId, setFilterDistrictId] = useState("");
  const [filterSectorId, setFilterSectorId] = useState("");
  const [filterChurchId, setFilterChurchId] = useState("");

  // Mapa auxiliar pra resolver Núcleo→Estado (distrito que pula direto pro núcleo)
  const nucleoById = useMemo(() => new Map(nucleosList.map((n) => [n.id, n])), [nucleosList]);

  const { data: ancestry = [] } = useChurchAncestry();
  const ancestryByChurch = useMemo(() => new Map(ancestry.map((a) => [a.church_id, a])), [ancestry]);

  const districtsForFilter = useMemo(
    () => filterStateId
      ? districtsList.filter((d) => {
          if (d.parent_level === "nucleo") return nucleoById.get(d.parent_id)?.state_id === filterStateId;
          if (d.parent_level === "estado") return d.parent_id === filterStateId;
          return false;
        })
      : districtsList,
    [districtsList, filterStateId, nucleoById]
  );
  const sectorsForFilter = useMemo(
    () => filterDistrictId ? sectorsList.filter((s) => s.parent_level === "distrito" && s.parent_id === filterDistrictId) : sectorsList,
    [sectorsList, filterDistrictId]
  );
  const churchesForFilter = useMemo(
    () => filterSectorId ? churches.filter((c) => ancestryByChurch.get(c.id)?.sector_id === filterSectorId) : churches,
    [churches, filterSectorId, ancestryByChurch]
  );

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      if (q && !(
        m.full_name.toLowerCase().includes(q) ||
        (m.phone ?? "").toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q)
      )) return false;
      if (filterStageList && m.journey_stage !== filterStageList) return false;
      if (filterChurchId && m.church_id !== filterChurchId) return false;
      const anc = m.church_id ? ancestryByChurch.get(m.church_id) : null;
      if (filterSectorId && anc?.sector_id !== filterSectorId) return false;
      if (filterDistrictId && anc?.district_id !== filterDistrictId) return false;
      if (filterStateId && anc?.state_id !== filterStateId) return false;
      return true;
    });
  }, [members, searchQuery, filterStageList, filterChurchId, filterSectorId, filterDistrictId, filterStateId, ancestryByChurch]);


  // ============ FORM PRINCIPAL (criar OU editar) ============
  // Usa schema diferente conforme o modo: edição → schema flexível, criação → schema com email obrigatório
  const createForm = useForm<MemberCreateInput>({
    resolver: zodResolver(memberCreateSchema),
    defaultValues: { journey_stage: "visitante" },
  });
  const editForm = useForm<MemberInput>({
    resolver: zodResolver(memberSchema),
    defaultValues: { journey_stage: "visitante" },
  });

  // ============ CASCATA estado → cidade → igreja → LG ============
  const activeCells = useMemo(() => cells.filter((c) => c.is_active), [cells]);
  const watchState   = createForm.watch("state");
  const watchCity    = createForm.watch("city");
  const watchChurch  = createForm.watch("church_id");

  const states = useMemo(() => {
    const s = new Set<string>();
    activeCells.forEach((c) => c.state && s.add(c.state));
    return Array.from(s).sort();
  }, [activeCells]);
  const cities = useMemo(() => {
    const s = new Set<string>();
    activeCells.filter((c) => !watchState || c.state === watchState)
      .forEach((c) => c.city && s.add(c.city));
    return Array.from(s).sort();
  }, [activeCells, watchState]);
  const churchesFiltered = useMemo(() => {
    const cellChurchIds = new Set(
      activeCells
        .filter((c) => (!watchState || c.state === watchState) && (!watchCity || c.city === watchCity))
        .map((c) => c.church_id).filter(Boolean)
    );
    return churches.filter((ch) => cellChurchIds.has(ch.id));
  }, [activeCells, churches, watchState, watchCity]);
  const lgsFiltered = useMemo(() => {
    return activeCells.filter((c) => {
      if (watchState  && c.state  !== watchState)  return false;
      if (watchCity   && c.city   !== watchCity)   return false;
      if (watchChurch && c.church_id !== watchChurch) return false;
      return true;
    });
  }, [activeCells, watchState, watchCity, watchChurch]);

  // ============ HANDLERS ============
  function startEdit(m: Member) {
    setEditing(m); setErr("");
    editForm.reset({
      full_name: m.full_name, email: m.email ?? "", phone: m.phone ?? "",
      birth_date: m.birth_date ?? "", life_group_id: m.life_group_id,
      journey_stage: m.journey_stage,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() {
    setEditing(null);
    editForm.reset({ journey_stage: "visitante" });
    createForm.reset({ journey_stage: "visitante" });
  }

  async function onCreate(v: MemberCreateInput) {
    setErr("");
    if (!v.church_id && !v.life_group_id) {
      setErr("Selecione ao menos a Igreja (ou o Life Group) antes de cadastrar. Sem isso o membro fica sem escopo e não aparece pra ninguém depois.");
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErr("Sessão expirada. Faça login novamente."); return; }

      const res = await fetch("/api/admin/create-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: v.email,
          full_name: v.full_name,
          phone: v.phone || null,
          birth_date: v.birth_date || null,
          church_id: v.church_id || null,
          life_group_id: v.life_group_id || null,
          role: "membro",
          access_token: session.access_token,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Erro ao criar membro");
        return;
      }
      await logAudit(supabase, "insert", "members", data.member.id, { name: v.full_name });
      setCredentials({ name: v.full_name, email: v.email, password: data.initial_password });
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["all-members"] });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function onUpdate(v: MemberInput) {
    if (!editing) return;
    setErr("");
    try {
      let church_id: string | null | undefined;
      if (v.life_group_id) {
        const cell = cells.find((c) => c.id === v.life_group_id);
        church_id = cell?.church_id ?? undefined;
      }
      const payload: Partial<Member> = {
        full_name: v.full_name,
        email: v.email || null,
        phone: v.phone || null,
        birth_date: v.birth_date || null,
        life_group_id: v.life_group_id || null,
        journey_stage: v.journey_stage,
        ...(church_id !== undefined ? { church_id } : {}),
      };
      await updateMember(supabase, editing.id, payload);
      await logAudit(supabase, "update", "members", editing.id, { name: v.full_name });
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["all-members"] });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function remove(m: Member) {
    if (!confirm(`Remover ${m.full_name}?\n\nEsta ação remove apenas o registro de membro. A conta de acesso (se houver) continua existindo.`)) return;
    try {
      await deleteMember(supabase, m.id);
      await logAudit(supabase, "delete", "members", m.id, { name: m.full_name });
      qc.invalidateQueries({ queryKey: ["all-members"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro ao remover"); }
  }

  async function activateAccess(m: Member) {
    if (!m.email) { alert("Este membro não tem e-mail cadastrado. Edite e adicione um e-mail antes de ativar o acesso."); return; }
    if (!confirm(`Criar acesso para ${m.full_name}?\n\nSerá criada uma conta com o e-mail ${m.email} e a senha inicial cec1234.`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert("Sessão expirada."); return; }
      const res = await fetch("/api/admin/activate-member-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: m.id, email: m.email, access_token: session.access_token }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { alert(data.error ?? "Erro ao ativar acesso"); return; }
      setCredentials({ name: m.full_name, email: m.email, password: data.initial_password });
      qc.invalidateQueries({ queryKey: ["all-members"] });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="space-y-6">
      {credentials && <CredentialsDialog data={credentials} onClose={() => setCredentials(null)} />}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{editing ? "Editar membro" : "Cadastrar membro"}</CardTitle>
              <CardDescription>
                {editing ? `Alterando ${editing.full_name}` : "Cria a conta de acesso e o cadastro de membro"}
              </CardDescription>
            </div>
            {editing && <Button onClick={cancelEdit} variant="ghost" size="sm" className="gap-1"><X className="h-3.5 w-3.5" />Cancelar</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={editForm.handleSubmit(onUpdate)} className="space-y-3">
              <Field label="Nome completo" error={editForm.formState.errors.full_name?.message}>
                <Input {...editForm.register("full_name")} placeholder="Maria Silva" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="E-mail" error={editForm.formState.errors.email?.message}>
                  <Input type="email" {...editForm.register("email")} placeholder="maria@email.com" />
                </Field>
                <Field label="Telefone"><Input {...editForm.register("phone")} placeholder="(00) 00000-0000" /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Data de nascimento" error={editForm.formState.errors.birth_date?.message}>
                  <Input type="date" {...editForm.register("birth_date")} />
                </Field>
                <Field label="Célula">
                  <select {...editForm.register("life_group_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">— Sem célula —</option>
                    {cells.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Etapa da jornada">
                <select {...editForm.register("journey_stage")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {STAGES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" disabled={editForm.formState.isSubmitting} className="gap-2">
                <Plus className="h-4 w-4" />Salvar alterações
              </Button>
            </form>
          ) : (
            <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-3">
              <Field label="Nome completo" error={createForm.formState.errors.full_name?.message}>
                <Input {...createForm.register("full_name")} placeholder="Maria Silva" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="E-mail (obrigatório para acessar o sistema)" error={createForm.formState.errors.email?.message}>
                  <Input type="email" {...createForm.register("email")} placeholder="maria@email.com" />
                </Field>
                <Field label="Telefone"><Input {...createForm.register("phone")} placeholder="(00) 00000-0000" /></Field>
              </div>
              <Field label="Data de nascimento" error={createForm.formState.errors.birth_date?.message}>
                <Input type="date" {...createForm.register("birth_date")} />
              </Field>

              {/* Cascata Estado → Cidade → Igreja → LG */}
              <div className="rounded-md border bg-navy-50/40 p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-navy-600">Localizar Life Group</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Estado">
                    <select {...createForm.register("state")}
                      onChange={(e) => { createForm.setValue("state", e.target.value); createForm.setValue("city", ""); createForm.setValue("church_id", ""); createForm.setValue("life_group_id", ""); }}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="">— Todos —</option>
                      {states.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Cidade">
                    <select {...createForm.register("city")}
                      onChange={(e) => { createForm.setValue("city", e.target.value); createForm.setValue("church_id", ""); createForm.setValue("life_group_id", ""); }}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="">— Todas —</option>
                      {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Igreja / Comunidade">
                    <select {...createForm.register("church_id")}
                      onChange={(e) => { createForm.setValue("church_id", e.target.value); createForm.setValue("life_group_id", ""); }}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="">— Todas —</option>
                      {churchesFiltered.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Life Group">
                    <select {...createForm.register("life_group_id")}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="">— Sem célula —</option>
                      {lgsFiltered.map((c) => <option key={c.id} value={c.id}>{c.name}{c.neighborhood ? ` · ${c.neighborhood}` : ""}</option>)}
                    </select>
                  </Field>
                </div>
                <p className="mt-2 text-[11px] text-muted">{lgsFiltered.length} célula(s) disponível(is) com esses filtros.</p>
              </div>

              <Field label="Etapa da jornada">
                <select {...createForm.register("journey_stage")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {STAGES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>

              <div className="flex items-start gap-2 rounded-md border border-gold/30 bg-gold/5 p-3 text-xs">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p className="text-ink">A senha inicial será <code className="rounded bg-navy-50 px-1 font-bold">cec1234</code>. O membro poderá trocá-la depois nas configurações do perfil.</p>
              </div>

              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" disabled={createForm.formState.isSubmitting} className="gap-2">
                <Plus className="h-4 w-4" />Cadastrar membro e criar acesso
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <h3 className="font-display text-lg text-navy">Membros cadastrados ({filteredMembers.length} de {members.length})</h3>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar membro por nome, telefone ou e-mail…" className="h-11 pl-9 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2.5">
        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3 w-3" /> Filtrar por:
        </span>
        <select value={filterStateId} onChange={(e) => { setFilterStateId(e.target.value); setFilterDistrictId(""); }} className="h-8 rounded-md border bg-background px-2 text-xs">
          <option value="">Todos os estados</option>
          {statesList.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.uf})</option>)}
        </select>
        <select value={filterDistrictId} onChange={(e) => { setFilterDistrictId(e.target.value); setFilterSectorId(""); }} className="h-8 rounded-md border bg-background px-2 text-xs">
          <option value="">Todos os distritos</option>
          {districtsForFilter.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filterSectorId} onChange={(e) => { setFilterSectorId(e.target.value); setFilterChurchId(""); }} className="h-8 rounded-md border bg-background px-2 text-xs">
          <option value="">Todos os setores</option>
          {sectorsForFilter.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterChurchId} onChange={(e) => setFilterChurchId(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
          <option value="">Todas as igrejas</option>
          {churchesForFilter.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStageList} onChange={(e) => setFilterStageList(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
          <option value="">Todas as situações</option>
          {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {(searchQuery || filterStateId || filterDistrictId || filterSectorId || filterChurchId || filterStageList) && (
          <button
            onClick={() => { setSearchQuery(""); setFilterStateId(""); setFilterDistrictId(""); setFilterSectorId(""); setFilterChurchId(""); setFilterStageList(""); }}
            className="text-xs text-muted-foreground underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filteredMembers.length === 0 && <p className="text-sm italic text-muted">Nenhum membro encontrado com esses filtros.</p>}
        {filteredMembers.map((m) => {
          const cell = cells.find((c) => c.id === m.life_group_id);
          const hasAccess = !!m.profile_id;
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <b className="text-navy">{m.full_name}</b>
                  {hasAccess
                    ? <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700 border border-green-200"><Check className="h-2.5 w-2.5" />Tem acesso</span>
                    : <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-700 border border-yellow-200"><AlertCircle className="h-2.5 w-2.5" />Sem acesso</span>
                  }
                </div>
                <p className="text-xs text-muted">
                  {STAGES.find(([s]) => s === m.journey_stage)?.[1] ?? m.journey_stage}
                  {cell ? ` · ${cell.name}` : ""}
                  {m.phone ? ` · ${m.phone}` : ""}
                  {m.email ? ` · ${m.email}` : ""}
                </p>
              </div>
              {!hasAccess && (
                <Button onClick={() => activateAccess(m)} variant="outline" size="sm" className="gap-1" title="Criar conta de acesso">
                  <KeyRound className="h-3.5 w-3.5" />Ativar acesso
                </Button>
              )}
              <Button onClick={() => setRelocating(m)} variant="outline" size="sm" title="Realocar/Transferir">
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </Button>
              <Button onClick={() => setViewingHistory(m)} variant="ghost" size="sm" title="Histórico de realocações">
                <History className="h-3.5 w-3.5" />
              </Button>
              <Button asChild variant="navy" size="sm">
                <Link href={`/pessoas/membros/${m.id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
              </Button>
              <Button onClick={() => setFullEditing(m)} variant="outline" size="sm" title="Editar completo (dados, classificação, estrutura, liderança, histórico)"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button onClick={() => remove(m)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          );
        })}
      </div>

      {relocating && (
        <RelocateDialog
          member={relocating}
          churches={churches} cells={cells}
          statesList={statesList} nucleosList={nucleosList} districtsList={districtsList} sectorsList={sectorsList}
          onClose={() => setRelocating(null)}
        />
      )}
      {viewingHistory && (
        <HistoryDialog member={viewingHistory} onClose={() => setViewingHistory(null)} />
      )}
      {fullEditing && (
        <MemberEditDialog member={fullEditing} onClose={() => setFullEditing(null)} />
      )}
    </div>
  );
}

function RelocateDialog({ member, churches, cells, statesList, nucleosList, districtsList, sectorsList, onClose }: {
  member: Member;
  churches: { id: string; name: string; sector_id: string | null }[];
  cells: { id: string; name: string; church_id: string | null }[];
  statesList: { id: string; name: string; uf: string }[];
  nucleosList: { id: string; name: string; state_id: string }[];
  districtsList: { id: string; name: string; parent_level: string; parent_id: string }[];
  sectorsList: { id: string; name: string; parent_level: string; parent_id: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [stateId, setStateId] = useState("");
  const [nucleoId, setNucleoId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [churchId, setChurchId] = useState("");
  const [lgId, setLgId] = useState("");
  const [reason, setReason] = useState<RelocationReason>("mudanca_igreja");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");

  const { data: ancestry = [] } = useChurchAncestry();
  const ancestryByChurch = useMemo(() => new Map(ancestry.map((a) => [a.church_id, a])), [ancestry]);
  const nucleosOpts = stateId ? nucleosList.filter(n => n.state_id === stateId) : nucleosList;
  const districtsOpts = nucleoId
    ? districtsList.filter(d => d.parent_level === "nucleo" && d.parent_id === nucleoId)
    : districtsList;
  const sectorsOpts = districtId
    ? sectorsList.filter(s => s.parent_level === "distrito" && s.parent_id === districtId)
    : sectorsList;
  const churchesOpts = sectorId ? churches.filter(c => ancestryByChurch.get(c.id)?.sector_id === sectorId) : churches;
  const lgsOpts = churchId ? cells.filter(c => c.church_id === churchId) : cells;

  const fromChurchName = churches.find(c => c.id === member.church_id)?.name ?? "—";
  const fromLgName = cells.find(c => c.id === member.life_group_id)?.name ?? "—";
  const toChurchName = churches.find(c => c.id === churchId)?.name ?? "—";
  const toLgName = cells.find(c => c.id === lgId)?.name ?? "—";

  async function confirm() {
    if (!churchId) { setErr("Selecione a igreja de destino."); return; }
    setBusy(true); setErr("");
    try {
      await relocateMember(supabase, {
        member_id: member.id, to_church_id: churchId, to_life_group_id: lgId || null,
        reason, notes: notes || null,
      });
      await logAudit(supabase, "update", "members", member.id, { realocado_para: churchId });
      qc.invalidateQueries({ queryKey: ["all-members"] });
      qc.invalidateQueries({ queryKey: ["member-relocations", member.id] });
      onClose();
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Erro ao realocar. Confira se você tem permissão sobre origem e destino.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Realocar {member.full_name}</DialogTitle></DialogHeader>
        {step === "form" ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              Atualmente em: <b className="text-navy">{fromChurchName}</b>
              {member.life_group_id && <> · {fromLgName}</>}
            </div>

            <Field label="Motivo">
              <select value={reason} onChange={e => setReason(e.target.value as RelocationReason)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {RELOCATION_REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>

            <div className="rounded-md border bg-navy-50/40 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-navy-600">Nova unidade</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Estado">
                  <select value={stateId} onChange={e => { setStateId(e.target.value); setNucleoId(""); setDistrictId(""); setSectorId(""); setChurchId(""); setLgId(""); }} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
                    <option value="">— Todos —</option>
                    {statesList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.uf})</option>)}
                  </select>
                </Field>
                <Field label="Núcleo">
                  <select value={nucleoId} onChange={e => { setNucleoId(e.target.value); setDistrictId(""); setSectorId(""); setChurchId(""); setLgId(""); }} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
                    <option value="">— Todos —</option>
                    {nucleosOpts.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </Field>
                <Field label="Distrito">
                  <select value={districtId} onChange={e => { setDistrictId(e.target.value); setSectorId(""); setChurchId(""); setLgId(""); }} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
                    <option value="">— Todos —</option>
                    {districtsOpts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                <Field label="Setor">
                  <select value={sectorId} onChange={e => { setSectorId(e.target.value); setChurchId(""); setLgId(""); }} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
                    <option value="">— Todos —</option>
                    {sectorsOpts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Igreja Local">
                  <select value={churchId} onChange={e => { setChurchId(e.target.value); setLgId(""); }} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
                    <option value="">— Selecione —</option>
                    {churchesOpts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Life Group (opcional)">
                  <select value={lgId} onChange={e => setLgId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-xs">
                    <option value="">— Sem célula —</option>
                    {lgsOpts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            <Field label="Observações"><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalhes adicionais (opcional)" /></Field>

            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button onClick={() => churchId ? setStep("confirm") : setErr("Selecione a igreja de destino.")} className="w-full">Continuar</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">Confirme a movimentação:</p>
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p><b className="text-navy">De:</b> {fromChurchName}{member.life_group_id ? ` — ${fromLgName}` : ""}</p>
              <p><b className="text-navy">Para:</b> {toChurchName}{lgId ? ` — ${toLgName}` : ""}</p>
              <p className="text-xs text-muted-foreground">Motivo: {RELOCATION_REASONS.find(([k]) => k === reason)?.[1]}</p>
              {notes && <p className="text-xs text-muted-foreground">Obs: {notes}</p>}
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("form")} className="flex-1">Voltar</Button>
              <Button onClick={confirm} disabled={busy} className="flex-1 gap-1.5">
                <ArrowRightLeft className="h-4 w-4" /> {busy ? "Confirmando…" : "Confirmar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const { data: history = [], isLoading } = useMemberRelocations(member.id);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Histórico de realocações — {member.full_name}</DialogTitle></DialogHeader>
        {isLoading ? (
          <p className="py-6 text-center text-sm italic text-muted-foreground">Carregando…</p>
        ) : history.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-muted-foreground">Nenhuma realocação registrada ainda.</p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {history.map(h => (
              <div key={h.id} className="rounded-md border p-3 text-xs">
                <p className="font-medium text-navy">
                  {h.from_church_name ?? "—"} → {h.to_church_name ?? "—"}
                </p>
                {(h.from_life_group_name || h.to_life_group_name) && (
                  <p className="text-muted-foreground">{h.from_life_group_name ?? "sem LG"} → {h.to_life_group_name ?? "sem LG"}</p>
                )}
                <p className="mt-1 text-muted-foreground">
                  {RELOCATION_REASONS.find(([k]) => k === h.reason)?.[1] ?? h.reason} · {new Date(h.created_at).toLocaleDateString("pt-BR")}
                  {h.performed_by_name ? ` · por ${h.performed_by_name}` : ""}
                </p>
                {h.notes && <p className="mt-1 italic text-muted-foreground">"{h.notes}"</p>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CredentialsDialog({ data, onClose }: { data: { name: string; email: string; password: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    const text = `Olá ${data.name}!\nSeu acesso à plataforma CEC Family foi criado.\n\nE-mail: ${data.email}\nSenha inicial: ${data.password}\n\nApós o primeiro login, recomendamos trocar a senha nas configurações do seu perfil.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { alert("Não foi possível copiar"); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Check className="h-5 w-5 text-gold" />Membro cadastrado!</CardTitle>
          <CardDescription>Anote os dados de acesso antes de fechar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border-2 border-gold/30 bg-gold/5 p-4">
            <p className="text-xs text-muted">Nome</p>
            <p className="font-bold text-navy">{data.name}</p>
            <p className="mt-2 text-xs text-muted">E-mail</p>
            <p className="font-mono text-sm text-navy">{data.email}</p>
            <p className="mt-2 text-xs text-muted">Senha inicial</p>
            <p className="font-mono text-base font-bold text-navy">{data.password}</p>
          </div>
          <p className="text-xs text-muted">
            Comunique esses dados ao membro com segurança (WhatsApp pessoal, em mãos, etc.).
            Ele poderá trocar a senha após o primeiro login.
          </p>
          <div className="flex gap-2">
            <Button onClick={copyAll} variant="outline" className="flex-1 gap-2">
              <Copy className="h-4 w-4" />{copied ? "Copiado!" : "Copiar tudo"}
            </Button>
            <Button onClick={onClose} className="flex-1">Fechar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
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
