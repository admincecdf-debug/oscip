"use client";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, TrendingUp, TrendingDown, Wallet, Pencil,
  BarChart3, PieChart, Globe, Target, Download, X, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { financeSchema, type FinanceFormInput } from "@/schemas";
import {
  useChurches, useFinances, useFinanceFlow,
  useFinanceCategories, useFinanceBudgets, useHasPermission,
} from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import {
  createFinance, deleteFinance, updateFinance,
  getNationalMonthly, upsertBudget, deleteBudget,
} from "@/services/finance";
import { logAudit } from "@/services/audit";
import type { Finance, FinanceBudgetVsActual } from "@/types/domain";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const KIND_LABELS: Record<string, string> = {
  dizimo:"Dízimo", oferta:"Oferta", primicia:"Primícia", missoes:"Missões",
  construcao:"Construção", outras_entradas:"Outras entradas",
  salario:"Salário", aluguel:"Aluguel", energia:"Energia",
  evangelismo:"Evangelismo", evento:"Evento", investimento:"Investimento",
  outras_saidas:"Outras saídas",
};
const ENTRADAS = ["dizimo","oferta","primicia","missoes","construcao","outras_entradas"];
const SAIDAS   = ["salario","aluguel","energia","evangelismo","evento","investimento","outras_saidas"];

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
}
function Field({ label, error, children }: { label:string; error?:string; children:React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Lançamentos ───────────────────────────────────────────────
function LancamentosTab({ churchId, year, month }: { churchId:string; year:number; month:number }) {
  const qc = useQueryClient();
  const today = new Date();
  const { data: items = [] } = useFinances(churchId||null, year, month);
  const { data: canLancar = true } = useHasPermission("financeiro.lancar", churchId || null);
  const { data: canAprovar = true } = useHasPermission("financeiro.aprovar", churchId || null);
  const canWrite = canLancar || canAprovar;
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<Finance|null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState:{errors,isSubmitting} } =
    useForm<FinanceFormInput>({
      resolver: zodResolver(financeSchema),
      defaultValues:{ direction:"entrada", kind:"dizimo", occurred_on:today.toISOString().slice(0,10), church_id:churchId },
    });
  const direction = watch("direction");

  async function onSubmit(v: FinanceFormInput) {
    setErr("");
    try {
      if (editing) {
        await updateFinance(supabase, editing.id, { kind:v.kind, direction:v.direction, amount:v.amount, description:v.description, occurred_on:v.occurred_on, payer_name:v.payer_name });
        await logAudit(supabase,"update","finances",editing.id,{amount:v.amount});
        setEditing(null);
      } else {
        const c = await createFinance(supabase,{church_id:v.church_id||churchId,kind:v.kind,direction:v.direction,amount:v.amount,description:v.description,occurred_on:v.occurred_on,payer_name:v.payer_name});
        await logAudit(supabase,"insert","finances",c.id,{kind:v.kind,amount:v.amount});
      }
      reset({direction:"entrada",kind:"dizimo",occurred_on:today.toISOString().slice(0,10),church_id:churchId});
      qc.invalidateQueries({queryKey:["finances"]});
      qc.invalidateQueries({queryKey:["finance-flow"]});
      qc.invalidateQueries({queryKey:["finance-categories"]});
    } catch(e:unknown){setErr(e instanceof Error?e.message:"Erro");}
  }

  function startEdit(item: Finance) {
    setEditing(item);
    setValue("direction",item.direction);
    setValue("kind",item.kind);
    setValue("amount",Number(item.amount));
    setValue("description",item.description??"");
    setValue("occurred_on",item.occurred_on);
    setValue("payer_name",item.payer_name??"");
  }

  async function remove(id: string) {
    if(!confirm("Apagar este lançamento?"))return;
    await deleteFinance(supabase,id);
    await logAudit(supabase,"delete","finances",id);
    qc.invalidateQueries({queryKey:["finances"]});
    qc.invalidateQueries({queryKey:["finance-flow"]});
    qc.invalidateQueries({queryKey:["finance-categories"]});
  }

  const totalE = items.filter(i=>i.direction==="entrada").reduce((s,i)=>s+Number(i.amount),0);
  const totalS = items.filter(i=>i.direction==="saida").reduce((s,i)=>s+Number(i.amount),0);
  const saldo  = totalE - totalS;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 grid-cols-3">
        <Card className="border-l-4 border-l-green-500"><CardContent className="pt-4">
          <p className="text-xs font-bold uppercase text-muted-foreground">Entradas</p>
          <p className="mt-1 font-display text-2xl font-bold text-green-700">{fmt(totalE)}</p>
        </CardContent></Card>
        <Card className="border-l-4 border-l-red-500"><CardContent className="pt-4">
          <p className="text-xs font-bold uppercase text-muted-foreground">Saídas</p>
          <p className="mt-1 font-display text-2xl font-bold text-red-700">{fmt(totalS)}</p>
        </CardContent></Card>
        <Card className={`border-l-4 ${saldo>=0?"border-l-[#C9A227] bg-[#0E2A47] text-white":"border-l-red-600 bg-red-600 text-white"}`}><CardContent className="pt-4">
          <p className="text-xs font-bold uppercase opacity-80">Saldo</p>
          <p className="mt-1 font-display text-2xl font-bold">{fmt(saldo)}</p>
        </CardContent></Card>
      </div>

      {canWrite && (
        <Card>
          <CardHeader><CardTitle className="text-base">{editing?"✏️ Editar lançamento":"➕ Novo lançamento"}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <input type="hidden" {...register("church_id")} value={churchId}/>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo">
                  <select {...register("direction")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="entrada">Entrada</option><option value="saida">Saída</option>
                  </select>
                </Field>
                <Field label="Categoria">
                  <select {...register("kind")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    {(direction==="saida"?SAIDAS:ENTRADAS).map(k=><option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Valor (R$)" error={errors.amount?.message}>
                  <Input type="number" step="0.01" min="0" {...register("amount")} placeholder="0,00"/>
                </Field>
                <Field label="Data" error={errors.occurred_on?.message}>
                  <Input type="date" {...register("occurred_on")}/>
                </Field>
              </div>
              {direction==="entrada"&&<Field label="Ofertante (opcional)"><Input {...register("payer_name")} placeholder="Nome"/></Field>}
              <Field label="Descrição"><Input {...register("description")} placeholder="Detalhes"/></Field>
              {err&&<p className="text-sm text-destructive">{err}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {editing?<><Check className="h-4 w-4"/>Salvar</>:<><Plus className="h-4 w-4"/>Lançar</>}
                </Button>
                {editing&&<Button type="button" variant="outline" onClick={()=>{setEditing(null);reset();}}><X className="h-4 w-4 mr-1"/>Cancelar</Button>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Lançamentos de {MONTHS[month-1]}/{year} ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {items.length===0?<p className="text-sm italic text-muted-foreground py-6 text-center">Nenhum lançamento.</p>:(
            <div className="space-y-2">
              {items.map(i=>(
                <div key={i.id} className={`flex items-center gap-3 rounded-xl border p-3 ${i.direction==="entrada"?"bg-green-50/50":"bg-red-50/50"} ${editing?.id===i.id?"ring-2 ring-[#C9A227]":""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <b className="text-[#0E2A47]">{KIND_LABELS[i.kind]??i.kind}</b>
                      <span className="text-[11px] text-muted-foreground">{new Date(i.occurred_on).toLocaleDateString("pt-BR")}</span>
                    </div>
                    {i.description&&<p className="text-xs text-muted-foreground truncate">{i.description}</p>}
                    {i.payer_name&&<p className="text-[11px] text-muted-foreground">por {i.payer_name}</p>}
                  </div>
                  <b className={`text-sm font-extrabold shrink-0 ${i.direction==="entrada"?"text-green-700":"text-red-700"}`}>
                    {i.direction==="entrada"?"+":"-"} {fmt(Number(i.amount))}
                  </b>
                  {canWrite && (
                    <div className="flex gap-1 shrink-0">
                      <Button onClick={()=>startEdit(i)} variant="ghost" size="sm"><Pencil className="h-3.5 w-3.5"/></Button>
                      <Button onClick={()=>remove(i.id)} variant="ghost" size="sm" className="text-red-500"><Trash2 className="h-3.5 w-3.5"/></Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Fluxo de Caixa ────────────────────────────────────────────
function FluxoTab({ churchId }: { churchId:string }) {
  const { data:flow=[], isLoading } = useFinanceFlow(churchId);
  const maxVal = Math.max(1,...flow.map(f=>Math.max(Number(f.entradas),Number(f.saidas))));
  const totalE = flow.reduce((s,f)=>s+Number(f.entradas),0);
  const totalS = flow.reduce((s,f)=>s+Number(f.saidas),0);
  if(isLoading)return<p className="py-8 text-center text-sm text-muted-foreground">Carregando fluxo…</p>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-green-500"><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-bold">Entradas 12m</p><p className="font-display text-2xl font-bold text-green-700 mt-1">{fmt(totalE)}</p></CardContent></Card>
        <Card className="border-l-4 border-l-red-500"><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-bold">Saídas 12m</p><p className="font-display text-2xl font-bold text-red-700 mt-1">{fmt(totalS)}</p></CardContent></Card>
        <Card className={`border-l-4 ${totalE-totalS>=0?"border-l-[#C9A227]":"border-l-red-600"}`}><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase font-bold">Saldo acumulado</p><p className={`font-display text-2xl font-bold mt-1 ${totalE-totalS>=0?"text-[#0E2A47]":"text-red-600"}`}>{fmt(totalE-totalS)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#C9A227]"/>Fluxo mensal — 12 meses</CardTitle></CardHeader>
        <CardContent>
          {flow.length===0?<p className="text-sm text-muted-foreground text-center py-8">Nenhum dado encontrado.</p>:(
            <div className="space-y-3">
              {flow.map(f=>{
                const pctE=Math.round((Number(f.entradas)/maxVal)*100);
                const pctS=Math.round((Number(f.saidas)/maxVal)*100);
                const s=Number(f.entradas)-Number(f.saidas);
                return(
                  <div key={f.mes_label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#0E2A47] w-16">{f.mes_label}</span>
                      <span className={`font-bold ${s>=0?"text-green-600":"text-red-500"}`}>{fmt(s)}</span>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-green-600 w-4">E</span>
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full"><div className="h-2.5 rounded-full bg-green-500" style={{width:`${pctE}%`}}/></div>
                        <span className="text-[10px] text-green-700 w-20 text-right">{fmt(Number(f.entradas))}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-red-500 w-4">S</span>
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full"><div className="h-2.5 rounded-full bg-red-400" style={{width:`${pctS}%`}}/></div>
                        <span className="text-[10px] text-red-600 w-20 text-right">{fmt(Number(f.saidas))}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Categorias ────────────────────────────────────────────────
function CategoriasTab({ churchId, year, month }: { churchId:string; year:number; month:number }) {
  const { data:cats=[], isLoading } = useFinanceCategories(churchId, year, month||undefined);
  const entradas = cats.filter(c=>c.direction==="entrada");
  const saidas   = cats.filter(c=>c.direction==="saida");
  const maxE = Math.max(1,...entradas.map(c=>Number(c.total)));
  const maxS = Math.max(1,...saidas.map(c=>Number(c.total)));
  if(isLoading)return<p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>;
  function CatList({items,max,color}:{items:typeof cats;max:number;color:string}){
    return(
      <div className="space-y-2">
        {items.map(c=>{const pct=Math.round((Number(c.total)/max)*100);return(
          <div key={c.kind} className="space-y-0.5">
            <div className="flex justify-between text-xs"><span className="font-medium text-[#0E2A47]">{KIND_LABELS[c.kind]??c.kind}</span><span className="font-bold">{fmt(Number(c.total))}</span></div>
            <div className="flex items-center gap-2"><div className="flex-1 h-2 bg-gray-100 rounded-full"><div className={`h-2 rounded-full ${color}`} style={{width:`${pct}%`}}/></div><span className="text-[10px] text-muted-foreground w-6 text-right">{c.qtd_lancamentos}</span></div>
          </div>
        );})}
        {items.length===0&&<p className="text-sm text-muted-foreground text-center py-4">Nenhum registro.</p>}
      </div>
    );
  }
  return(
    <div className="grid md:grid-cols-2 gap-5">
      <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600"/>Entradas</CardTitle></CardHeader><CardContent><CatList items={entradas} max={maxE} color="bg-green-500"/></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500"/>Saídas</CardTitle></CardHeader><CardContent><CatList items={saidas} max={maxS} color="bg-red-400"/></CardContent></Card>
    </div>
  );
}

// ── Consolidado Nacional ──────────────────────────────────────
function ConsolidadoTab() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useMemo(() => {
    getNationalMonthly().then(d => { setData(d); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalE = data.reduce((s, d) => s + Number(d.total_entradas), 0);
  const totalS = data.reduce((s, d) => s + Number(d.total_saidas), 0);

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-bold">Entradas nacionais</p>
            <p className="font-display text-2xl font-bold text-green-700 mt-1">{fmt(totalE)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-bold">Saídas nacionais</p>
            <p className="font-display text-2xl font-bold text-red-700 mt-1">{fmt(totalS)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#C9A227]">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase font-bold">Saldo nacional</p>
            <p className={`font-display text-2xl font-bold mt-1 ${totalE - totalS >= 0 ? "text-[#0E2A47]" : "text-red-600"}`}>
              {fmt(totalE - totalS)}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#C9A227]" />
            Consolidado nacional — 12 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado nacional encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0E2A47] text-white text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Mês</th>
                    <th className="px-3 py-2 text-center">Igrejas</th>
                    <th className="px-3 py-2 text-right">Entradas</th>
                    <th className="px-3 py-2 text-right">Saídas</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((d, i) => {
                    const s = Number(d.total_entradas) - Number(d.total_saidas);
                    return (
                      <tr key={d.mes_label} className={`border-t ${i % 2 === 0 ? "bg-gray-50/50" : ""}`}>
                        <td className="px-3 py-2 font-medium text-[#0E2A47]">{d.mes_label}</td>
                        <td className="px-3 py-2 text-center">{d.igrejas_com_lancamentos}</td>
                        <td className="px-3 py-2 text-right text-green-700 font-medium">{fmt(Number(d.total_entradas))}</td>
                        <td className="px-3 py-2 text-right text-red-600 font-medium">{fmt(Number(d.total_saidas))}</td>
                        <td className={`px-3 py-2 text-right font-bold ${s >= 0 ? "text-[#0E2A47]" : "text-red-600"}`}>{fmt(s)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Orçamento Anual ───────────────────────────────────────────
function OrcamentoTab({ churchId, year }: { churchId:string; year:number }) {
  const qc = useQueryClient();
  const { data:budgets=[], isLoading } = useFinanceBudgets(churchId, year);
  const [showForm, setShowForm] = useState(false);
  const [direction, setDirection] = useState("entrada");
  const [kind, setKind] = useState("dizimo");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if(!amount)return;
    setBusy(true);
    try {
      await upsertBudget(supabase,{church_id:churchId,year,kind,direction,amount:Number(amount),notes:notes||undefined});
      qc.invalidateQueries({queryKey:["finance-budgets"]});
      setShowForm(false);setAmount("");setNotes("");
    } finally{setBusy(false);}
  }

  if(isLoading)return<p className="py-8 text-center text-sm text-muted-foreground">Carregando orçamento…</p>;

  return(
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button size="sm" onClick={()=>setShowForm(true)}><Plus className="h-4 w-4 mr-1"/>Nova meta</Button>
      </div>
      {budgets.length===0&&<Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma meta para {year}.</CardContent></Card>}
      <div className="space-y-3">
        {budgets.map(b=>{
          const pct=Math.min(100,b.pct_realizado??0);
          const s=pct>=100?"atingido":pct>=70?"caminho":"atencao";
          return(
            <Card key={b.id} className={`border-l-4 ${s==="atingido"?"border-l-green-400":s==="caminho"?"border-l-blue-400":"border-l-red-400"}`}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#0E2A47]">{KIND_LABELS[b.kind]??b.kind}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${b.direction==="entrada"?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>{b.direction==="entrada"?"Entrada":"Saída"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 rounded-full bg-gray-100"><div className={`h-2.5 rounded-full ${s==="atingido"?"bg-green-500":s==="caminho"?"bg-blue-400":"bg-red-400"}`} style={{width:`${pct}%`}}/></div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(b.actual??0)} / {fmt(Number(b.amount))}</span>
                      <span className={`text-sm font-bold ${s==="atingido"?"text-green-600":s==="caminho"?"text-blue-600":"text-red-500"}`}>{pct.toFixed(0)}%</span>
                    </div>
                    {b.notes&&<p className="text-xs text-muted-foreground italic">{b.notes}</p>}
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-500 shrink-0"
                    onClick={async()=>{if(confirm("Excluir?")){{await deleteBudget(supabase,b.id);qc.invalidateQueries({queryKey:["finance-budgets"]});}}}}>
                    <Trash2 className="h-3.5 w-3.5"/>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {showForm&&(
        <Dialog open onOpenChange={()=>setShowForm(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Nova meta orçamentária</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Tipo</Label>
                <select value={direction} onChange={e=>{setDirection(e.target.value);setKind(e.target.value==="saida"?SAIDAS[0]:ENTRADAS[0]);}} className="h-10 w-full rounded-md border bg-background px-3 text-sm mt-1">
                  <option value="entrada">Entrada</option><option value="saida">Saída</option>
                </select>
              </div>
              <div><Label className="text-xs">Categoria</Label>
                <select value={kind} onChange={e=>setKind(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm mt-1">
                  {(direction==="saida"?SAIDAS:ENTRADAS).map(k=><option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Meta anual (R$)</Label><Input type="number" step="0.01" min="0" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-1"/></div>
              <div><Label className="text-xs">Observações</Label><Input value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1"/></div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={()=>setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={busy||!amount}>{busy?"Salvando…":"Salvar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Exportação ────────────────────────────────────────────────
function ExportacaoTab({ churchId, year, month, churchName }: { churchId:string; year:number; month:number; churchName:string }) {
  const { data:items=[] } = useFinances(churchId||null, year, month);
  const { data:flow=[] }  = useFinanceFlow(churchId);
  const { data: canExport = true } = useHasPermission("financeiro.exportar", churchId || null);

  function exportCSV() {
    const h=["Data","Tipo","Categoria","Valor","Ofertante","Descrição"];
    const r=items.map(i=>[new Date(i.occurred_on).toLocaleDateString("pt-BR"),i.direction==="entrada"?"Entrada":"Saída",KIND_LABELS[i.kind]??i.kind,Number(i.amount).toFixed(2).replace(".",","),i.payer_name??"",i.description??""]);
    const csv=[h,...r].map(r=>r.map(c=>`"${c}"`).join(";")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`financeiro_${churchName}_${MONTHS[month-1]}_${year}.csv`;a.click();URL.revokeObjectURL(url);
  }

  function exportFluxo() {
    const h=["Mês","Entradas","Saídas","Saldo","Lançamentos"];
    const r=flow.map(f=>[f.mes_label,Number(f.entradas).toFixed(2).replace(".",","),Number(f.saidas).toFixed(2).replace(".",","),(Number(f.entradas)-Number(f.saidas)).toFixed(2).replace(".",","),String(0)]);
    const csv=[h,...r].map(r=>r.map(c=>`"${c}"`).join(";")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`fluxo_${churchName}_${year}.csv`;a.click();URL.revokeObjectURL(url);
  }

  return(
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4 text-[#C9A227]"/>Exportar dados financeiros</CardTitle><CardDescription>CSV compatível com Excel e Google Sheets</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-gray-50">
            <div><p className="font-semibold text-[#0E2A47]">Lançamentos do mês</p><p className="text-xs text-muted-foreground">{MONTHS[month-1]}/{year} · {items.length} lançamentos</p></div>
            <Button onClick={exportCSV} disabled={items.length===0 || !canExport} className="gap-2"><Download className="h-4 w-4"/>Exportar CSV</Button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border bg-gray-50">
            <div><p className="font-semibold text-[#0E2A47]">Fluxo de caixa anual</p><p className="text-xs text-muted-foreground">{flow.length} meses · {churchName}</p></div>
            <Button onClick={exportFluxo} disabled={flow.length===0 || !canExport} variant="outline" className="gap-2"><Download className="h-4 w-4"/>Exportar CSV</Button>
          </div>
          {!canExport && <p className="text-xs text-muted-foreground italic">Sua delegação não inclui permissão de exportação de dados financeiros.</p>}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground text-center">💡 No Excel: Dados → De Texto/CSV → delimitador ponto e vírgula</p>
    </div>
  );
}

// ── MASTER ────────────────────────────────────────────────────
export function FinanceAdmin({ initialChurchId = "" }: { initialChurchId?: string } = {}) {
  const { data:churches=[] } = useChurches();
  const today = new Date();
  const [churchId, setChurchId] = useState(initialChurchId);
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()+1);
  const effectiveId = churchId||churches.find(c=>c.type==="sede")?.id||churches[0]?.id||"";
  const churchName  = churches.find(c=>c.id===effectiveId)?.name??"Igreja";

  return(
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-[#C9A227]"/>
        <div><h2 className="text-xl font-bold text-[#0E2A47]">Financeiro</h2><p className="text-xs text-muted-foreground">Lançamentos · Fluxo · Categorias · Nacional · Orçamento · Exportação</p></div>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div><Label className="text-xs">Comunidade</Label>
          <select value={effectiveId} onChange={e=>setChurchId(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm mt-1 block">
            {churches.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><Label className="text-xs">Mês</Label>
          <select value={month} onChange={e=>setMonth(Number(e.target.value))} className="h-9 rounded-md border bg-background px-3 text-sm mt-1 block">
            {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div><Label className="text-xs">Ano</Label><Input type="number" min="2020" max="2100" value={year} onChange={e=>setYear(Number(e.target.value))} className="h-9 w-24 mt-1"/></div>
      </div>
      <Tabs defaultValue="lancamentos">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="lancamentos" className="gap-1.5"><Wallet className="h-3.5 w-3.5"/>Lançamentos</TabsTrigger>
          <TabsTrigger value="fluxo" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5"/>Fluxo</TabsTrigger>
          <TabsTrigger value="categorias" className="gap-1.5"><PieChart className="h-3.5 w-3.5"/>Categorias</TabsTrigger>
          <TabsTrigger value="consolidado" className="gap-1.5"><Globe className="h-3.5 w-3.5"/>Nacional</TabsTrigger>
          <TabsTrigger value="orcamento" className="gap-1.5"><Target className="h-3.5 w-3.5"/>Orçamento</TabsTrigger>
          <TabsTrigger value="exportacao" className="gap-1.5"><Download className="h-3.5 w-3.5"/>Exportar</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="lancamentos"><LancamentosTab churchId={effectiveId} year={year} month={month}/></TabsContent>
          <TabsContent value="fluxo"><FluxoTab churchId={effectiveId}/></TabsContent>
          <TabsContent value="categorias"><CategoriasTab churchId={effectiveId} year={year} month={month}/></TabsContent>
          <TabsContent value="consolidado"><ConsolidadoTab/></TabsContent>
          <TabsContent value="orcamento"><OrcamentoTab churchId={effectiveId} year={year}/></TabsContent>
          <TabsContent value="exportacao"><ExportacaoTab churchId={effectiveId} year={year} month={month} churchName={churchName}/></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
