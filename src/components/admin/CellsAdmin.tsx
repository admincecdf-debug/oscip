"use client";
import { useState } from "react";
import { useForm, type UseFormRegister, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, X, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cellSchema, type CellInput } from "@/schemas";
import { useCells, useSectors, useAllMembers, useChurches } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { createCell, updateCell, deleteCell } from "@/services/cells";
import { logAudit } from "@/services/audit";
import type { Cell, Church, Sector } from "@/types/domain";
import { LgEngagementCard } from "./LgEngagementCard";

const WEEKDAYS: [string, string][] = [
  ["domingo","Domingo"],["segunda","Segunda"],["terca","Terça"],
  ["quarta","Quarta"],["quinta","Quinta"],["sexta","Sexta"],["sabado","Sábado"],
];

export function CellsAdmin() {
  const { data: cells = [] } = useCells();
  const { data: sectors = [] } = useSectors();
  const { data: churches = [] } = useChurches();
  const { data: members = [] } = useAllMembers();
  const qc = useQueryClient();
  const [createErr, setCreateErr] = useState("");
  const [editingCell, setEditingCell] = useState<Cell | null>(null);

  const createForm = useForm<CellInput>({ resolver: zodResolver(cellSchema) });

  async function onCreate(v: CellInput) {
    setCreateErr("");
    try {
      const created = await createCell(supabase, buildPayload(v));
      await logAudit(supabase, "insert", "life_groups", created.id, { name: v.name });
      createForm.reset();
      qc.invalidateQueries({ queryKey: ["cells"] });
    } catch (e: unknown) {
      setCreateErr((e as { message?: string })?.message ?? "Erro ao salvar");
    }
  }

  async function remove(c: Cell) {
    if (!confirm(`Remover Life Group "${c.name}"?\n\nMembros vinculados ficarão sem Life Group.`)) return;
    try {
      await deleteCell(supabase, c.id);
      await logAudit(supabase, "delete", "life_groups", c.id, { name: c.name });
      qc.invalidateQueries({ queryKey: ["cells"] });
    } catch (e: unknown) {
      alert((e as { message?: string })?.message ?? "Erro ao remover");
    }
  }

  // Agrupa por setor
  const bySector = sectors.map((s) => ({
    sector: s,
    cells: cells.filter((c) => c.sector_id === s.id),
  }));
  const orphans = cells.filter((c) => !c.sector_id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar Life Group</CardTitle>
          <CardDescription>Vincule a um setor existente, ou direto a uma Igreja/Sede.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-3">
            <CellFormFields register={createForm.register} errors={createForm.formState.errors} sectors={sectors} churches={churches} members={members} />
            {createErr && <p className="text-sm text-destructive">{createErr}</p>}
            <Button type="submit" disabled={createForm.formState.isSubmitting} className="gap-2">
              <Plus className="h-4 w-4" />Cadastrar Life Group
            </Button>
            <p className="text-xs text-muted">
              Dica: <b>{members.length}</b> membro(s) já cadastrado(s) podem ser vinculados na aba "Membros".
            </p>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {bySector.map(({ sector, cells: sectorCells }) => (
          <div key={sector.id}>
            <h3 className="mb-2 font-display text-lg text-navy">{sector.name} <span className="text-sm text-muted">({sectorCells.length} Life Group(s))</span></h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {sectorCells.length === 0 && <p className="text-sm italic text-muted">Nenhum Life Group neste setor.</p>}
              {sectorCells.map((c) => <CellCard key={c.id} cell={c} onEdit={setEditingCell} onRemove={remove} />)}
            </div>
          </div>
        ))}

        {orphans.length > 0 && (
          <div>
            <h3 className="mb-2 font-display text-lg text-yellow-700">Sem setor ({orphans.length})</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {orphans.map((c) => <CellCard key={c.id} cell={c} onEdit={setEditingCell} onRemove={remove} />)}
            </div>
          </div>
        )}
      </div>

      {editingCell && (
        <EditCellDialog
          cell={editingCell} sectors={sectors} churches={churches} members={members}
          onClose={() => setEditingCell(null)}
        />
      )}
    </div>
  );
}

function buildPayload(v: CellInput): Partial<Cell> {
  return {
    name: v.name,
    sector_id: v.sector_id || null,
    church_id: v.sector_id ? undefined : (v.church_id || null),
    address: v.address || null,
    state: v.state || null,
    city: v.city || null,
    neighborhood: v.neighborhood || null,
    meeting_weekday: v.meeting_weekday ?? null,
    meeting_time: v.meeting_time || null,
    multiplication_target: v.multiplication_target ?? 12,
    target_audience: v.target_audience ?? "misto",
    status_lg: v.status_lg ?? "ativo",
    cep: v.cep || null,
    numero: v.numero || null,
    complemento: v.complemento || null,
    coleader_id: v.coleader_id || null,
    host_id: v.host_id || null,
    host_assistant_id: v.host_assistant_id || null,
    founded_at: v.founded_at || null,
  };
}

// ── Modal de edição — bem visível, separado do cadastro ──────────────────
function EditCellDialog({ cell, sectors, churches, members, onClose }: {
  cell: Cell; sectors: Sector[]; churches: Church[];
  members: { id: string; profile_id: string | null; full_name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CellInput>({
    resolver: zodResolver(cellSchema),
    defaultValues: {
      name: cell.name,
      sector_id: cell.sector_id ?? "",
      church_id: cell.sector_id ? "" : (cell.church_id ?? ""),
      address: cell.address ?? "",
      state: cell.state ?? "",
      city: cell.city ?? "",
      neighborhood: cell.neighborhood ?? "",
      meeting_weekday: cell.meeting_weekday,
      meeting_time: cell.meeting_time ? cell.meeting_time.slice(0,5) : "",
      leader_id: null,
      coleader_id: cell.coleader_id,
      host_id: cell.host_id,
      host_assistant_id: cell.host_assistant_id ?? null,
      multiplication_target: cell.multiplication_target ?? 12,
      target_audience: (cell.target_audience as "misto") ?? "misto",
      status_lg: (cell.status_lg as "ativo") ?? "ativo",
      cep: cell.cep ?? "",
      numero: cell.numero ?? "",
      complemento: cell.complemento ?? "",
      founded_at: cell.founded_at ?? "",
    },
  });

  async function onSubmit(v: CellInput) {
    setErr("");
    try {
      await updateCell(supabase, cell.id, buildPayload(v));
      await logAudit(supabase, "update", "life_groups", cell.id, { name: v.name });
      qc.invalidateQueries({ queryKey: ["cells"] });
      onClose();
    } catch (e: unknown) {
      setErr((e as { message?: string })?.message ?? "Erro ao salvar");
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Editar Life Group — {cell.name}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <CellFormFields register={register} errors={errors} sectors={sectors} churches={churches} members={members} />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 gap-1"><X className="h-4 w-4" />Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
              <Pencil className="h-4 w-4" />{isSubmitting ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Campos compartilhados entre Cadastrar e Editar ────────────────────────
function CellFormFields({ register, errors, sectors, churches, members }: {
  register: UseFormRegister<CellInput>;
  errors: FieldErrors<CellInput>;
  sectors: Sector[]; churches: Church[];
  members: { id: string; profile_id: string | null; full_name: string }[];
}) {
  return (
    <>
      <Field label="Nome do Life Group" error={errors.name?.message}>
        <Input {...register("name")} placeholder="Ex: Vida Nova" />
      </Field>
      <Field label="Setor" error={errors.sector_id?.message}>
        <select {...register("sector_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">— Selecione um setor —</option>
          {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {sectors.length === 0 && (
          <p className="mt-1 text-xs text-amber-700">
            Nenhum setor cadastrado ainda. Vincule direto a uma Igreja/Sede abaixo, ou crie a Estrutura MDA primeiro (aba "Estrutura MDA").
          </p>
        )}
      </Field>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
      <Field label="Vincular direto a uma Igreja/Sede">
        <select {...register("church_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">— Nenhuma (usar o setor acima) —</option>
          {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dia da semana">
          <select {...register("meeting_weekday")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">— Selecione —</option>
            {WEEKDAYS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Horário (HH:MM)" error={errors.meeting_time?.message}>
          <Input type="time" {...register("meeting_time")} />
        </Field>
      </div>
      <Field label="Meta de multiplicação (membros ativos)" error={errors.multiplication_target?.message}>
        <Input type="number" min={3} max={50} {...register("multiplication_target")} placeholder="12" />
      </Field>
      <Field label="Público-alvo (define para quem o LG é recomendado)">
        <select {...register("target_audience")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="misto">Misto — todas as idades e perfis</option>
          <option value="jovens">Jovens</option>
          <option value="adolescentes">Adolescentes</option>
          <option value="adultos">Adultos</option>
          <option value="casais">Casais</option>
          <option value="terceira_idade">Terceira idade</option>
          <option value="mulheres">Mulheres</option>
          <option value="homens">Homens</option>
          <option value="outro">Outro</option>
        </select>
      </Field>

      <Field label="Status do Life Group">
        <select {...register("status_lg")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="em_formacao">🟡 Em Formação</option>
          <option value="ativo">🟢 Ativo</option>
          <option value="em_multiplicacao">✂️ Em Multiplicação</option>
          <option value="multiplicado">⭐ Multiplicado</option>
          <option value="encerrado">⚪ Encerrado</option>
        </select>
      </Field>

      <Field label="Data de fundação" error={errors.founded_at?.message}>
        <Input type="date" {...register("founded_at")} />
      </Field>

      <div className="rounded-xl border bg-navy-50/30 p-3 space-y-3">
        <Label className="block font-bold uppercase tracking-wider text-navy-600 text-xs">Endereço</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="CEP" error={errors.cep?.message}>
            <Input {...register("cep")} placeholder="00000-000" maxLength={9} />
          </Field>
          <Field label="Estado" error={errors.state?.message}>
            <Input {...register("state")} placeholder="AM" maxLength={3} />
          </Field>
          <Field label="Cidade" error={errors.city?.message}>
            <Input {...register("city")} placeholder="Manaus" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bairro" error={errors.neighborhood?.message}>
            <Input {...register("neighborhood")} placeholder="Centro" />
          </Field>
          <Field label="Logradouro" error={errors.address?.message}>
            <Input {...register("address")} placeholder="Rua / Avenida" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Número" error={errors.numero?.message}>
            <Input {...register("numero")} placeholder="123" />
          </Field>
          <Field label="Complemento" error={errors.complemento?.message}>
            <Input {...register("complemento")} placeholder="Apto 201, bloco B" />
          </Field>
        </div>
      </div>

      <div className="rounded-xl border bg-gold/5 p-3 space-y-3">
        <Label className="block font-bold uppercase tracking-wider text-gold text-xs">Equipe do Life Group</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Líder">
            <select {...register("leader_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Sem líder definido —</option>
              {members.filter(m => m.profile_id).map(m =>
                <option key={m.id} value={m.profile_id ?? ""}>{m.full_name}</option>
              )}
            </select>
          </Field>
          <Field label="Co-líder">
            <select {...register("coleader_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Sem co-líder —</option>
              {members.filter(m => m.profile_id).map(m =>
                <option key={m.id} value={m.profile_id ?? ""}>{m.full_name}</option>
              )}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Anfitrião principal">
            <select {...register("host_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Sem anfitrião —</option>
              {members.filter(m => m.profile_id).map(m =>
                <option key={m.id} value={m.profile_id ?? ""}>{m.full_name}</option>
              )}
            </select>
          </Field>
          <Field label="Anfitrião auxiliar">
            <select {...register("host_assistant_id")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Sem auxiliar —</option>
              {members.filter(m => m.profile_id).map(m =>
                <option key={m.id} value={m.profile_id ?? ""}>{m.full_name}</option>
              )}
            </select>
          </Field>
        </div>
        <p className="text-[10px] text-muted">Anfitriões podem ser o próprio líder, co-líder ou membros distintos.</p>
      </div>
    </>
  );
}

function CellCard({ cell: c, onEdit, onRemove }: { cell: Cell; onEdit: (c: Cell) => void; onRemove: (c: Cell) => void }) {
  return (
    <Card className="border-l-4 border-l-gold">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <b className="block truncate text-navy">{c.name}</b>
            {c.status_lg && <LgStatusBadge status={c.status_lg} />}
            {c.meeting_weekday && c.meeting_time && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Clock className="h-3 w-3" />{WEEKDAYS.find(([v])=>v===c.meeting_weekday)?.[1]} às {c.meeting_time.slice(0,5)}</p>
            )}
            {c.address && <p className="mt-1 flex items-start gap-1 text-xs text-muted"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{c.address}</p>}
          </div>
          <div className="flex gap-1">
            <Button onClick={() => onEdit(c)} variant="outline" size="sm" className="gap-1" title="Editar Life Group">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button onClick={() => onRemove(c)} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <LgEngagementCard lgId={c.id} />
      </CardContent>
    </Card>
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

const LG_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  em_formacao:      { label: "Em Formação",      cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  ativo:            { label: "Ativo",            cls: "bg-green-50 text-green-700 border-green-200" },
  em_multiplicacao: { label: "Em Multiplicação", cls: "bg-gold/15 text-gold border-gold/30" },
  multiplicado:     { label: "Multiplicado",     cls: "bg-purple-50 text-purple-700 border-purple-200" },
  encerrado:        { label: "Encerrado",        cls: "bg-gray-100 text-gray-600 border-gray-300" },
};

function LgStatusBadge({ status }: { status: string }) {
  const cfg = LG_STATUS_CONFIG[status];
  if (!cfg) return null;
  return (
    <span className={`mt-1 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
