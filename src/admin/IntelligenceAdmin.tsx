"use client";
import { useState } from "react";
import { Brain, TrendingUp, Users, Shield, BarChart3, ChevronUp, ChevronDown, Minus, AlertTriangle, CheckCircle2, XCircle, Info, Trophy, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLgScores, useLgRankings, useRetentionFunnel, useRetentionFunnelByChurch, useLgReliability, useReliabilitySummary, useGrowthVariation, useChurches } from "@/hooks/use-queries";
import type { LgRanking, LgReliabilityIndex, HealthBand, ReliabilityBand } from "@/types/domain";

const BAND_COLOR: Record<HealthBand, string> = { saudavel:"bg-green-100 text-green-800 border-green-300", atencao:"bg-yellow-100 text-yellow-800 border-yellow-300", critico:"bg-red-100 text-red-800 border-red-300" };
const BAND_ICON: Record<HealthBand, string> = { saudavel:"🟢", atencao:"🟡", critico:"🔴" };
const BAND_LABEL: Record<HealthBand, string> = { saudavel:"Saudável", atencao:"Atenção", critico:"Crítico" };
const REL_COLOR: Record<ReliabilityBand, string> = { confiavel:"bg-green-100 text-green-800", atencao:"bg-yellow-100 text-yellow-800", critico:"bg-red-100 text-red-800" };
const REL_LABEL: Record<ReliabilityBand, string> = { confiavel:"Confiável", atencao:"Atenção", critico:"Crítico" };

function ScoreBar({ value, max=100, color="bg-[#C9A227]" }: { value:number; max?:number; color?:string }) {
  const pct = Math.min(100, Math.round((value/max)*100));
  return <div className="h-1.5 w-full rounded-full bg-gray-100"><div className={`h-1.5 rounded-full ${color} transition-all`} style={{width:`${pct}%`}}/></div>;
}
function VarBadge({ val }: { val:number|null }) {
  if(val===null) return <span className="text-xs text-muted-foreground">—</span>;
  if(val>0) return <span className="flex items-center gap-0.5 text-xs font-semibold text-green-600"><ChevronUp className="h-3 w-3"/>{val}%</span>;
  if(val<0) return <span className="flex items-center gap-0.5 text-xs font-semibold text-red-500"><ChevronDown className="h-3 w-3"/>{Math.abs(val)}%</span>;
  return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3"/>0%</span>;
}

function ScoreTab({ churchFilter }: { churchFilter:string }) {
  const { data:scores=[], isLoading } = useLgScores(churchFilter||undefined);
  const saudaveis=scores.filter(s=>s.health_band==="saudavel").length;
  const atencao=scores.filter(s=>s.health_band==="atencao").length;
  const criticos=scores.filter(s=>s.health_band==="critico").length;
  const avgScore=scores.length?Math.round(scores.reduce((a,s)=>a+s.score_total,0)/scores.length):0;
  if(isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Calculando scores…</p>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{label:"Score médio",value:avgScore,color:"border-l-[#C9A227]"},{label:"🟢 Saudáveis",value:saudaveis,color:"border-l-green-500"},{label:"🟡 Atenção",value:atencao,color:"border-l-yellow-500"},{label:"🔴 Críticos",value:criticos,color:"border-l-red-500"}].map(k=>(
          <Card key={k.label} className={`border-l-4 ${k.color}`}><CardContent className="pt-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p><p className="mt-1 font-display text-3xl font-bold text-[#0E2A47]">{k.value}</p></CardContent></Card>
        ))}
      </div>
      <div className="space-y-2">
        {scores.map(s=>(
          <Card key={s.id} className={`border-l-4 ${s.health_band==="saudavel"?"border-l-green-400":s.health_band==="atencao"?"border-l-yellow-400":"border-l-red-400"}`}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#0E2A47] truncate">{s.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${BAND_COLOR[s.health_band]}`}>{BAND_ICON[s.health_band]} {BAND_LABEL[s.health_band]}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-display text-2xl font-bold text-[#0E2A47]">{s.score_total}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                    <div className="flex-1"><ScoreBar value={s.score_total}/></div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 md:grid-cols-6 gap-2">
                    {[{label:"Reporte",pts:s.pts_reporte,max:20},{label:"Freq.",pts:s.pts_frequencia,max:20},{label:"Retenção",pts:s.pts_retencao,max:15},{label:"Discip.",pts:s.pts_discipulado,max:15},{label:"Evang.",pts:s.pts_evangelismo,max:15},{label:"Mult.",pts:s.pts_multiplicacao,max:15}].map(d=>(
                      <div key={d.label} className="text-center">
                        <p className="text-[10px] text-muted-foreground">{d.label}</p>
                        <p className="text-xs font-bold text-[#0E2A47]">{d.pts}<span className="font-normal text-muted-foreground">/{d.max}</span></p>
                        <ScoreBar value={d.pts} max={d.max} color={d.pts/d.max>=0.7?"bg-green-500":d.pts/d.max>=0.4?"bg-yellow-400":"bg-red-400"}/>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0 text-xs text-muted-foreground space-y-0.5">
                  <p>👥 {s.members_count} membros</p>
                  <p>📋 {s.total_relatorios??0} relat. (90d)</p>
                  {s.ultimo_relatorio&&<p>📅 {new Date(s.ultimo_relatorio).toLocaleDateString("pt-BR")}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {scores.length===0&&<p className="py-10 text-center text-sm text-muted-foreground">Nenhum LG encontrado.</p>}
      </div>
    </div>
  );
}

type RankDim = "rank_geral"|"rank_frequencia"|"rank_evangelismo"|"rank_multiplicacao"|"rank_discipulado"|"rank_visitantes"|"rank_membros";
const RANK_OPTIONS: {value:RankDim;label:string}[] = [
  {value:"rank_geral",label:"🏆 Score Geral"},{value:"rank_frequencia",label:"📊 Frequência"},
  {value:"rank_evangelismo",label:"✨ Evangelismo"},{value:"rank_multiplicacao",label:"🌱 Multiplicação"},
  {value:"rank_discipulado",label:"📖 Discipulado"},{value:"rank_visitantes",label:"👋 Visitantes"},
  {value:"rank_membros",label:"👥 Membros"},
];
function RankingsTab({ churchFilter }: { churchFilter:string }) {
  const { data:rankings=[], isLoading } = useLgRankings(churchFilter||undefined);
  const [dimension, setDimension] = useState<RankDim>("rank_geral");
  const sorted = [...rankings].sort((a,b)=>(a[dimension]??999)-(b[dimension]??999));
  if(isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando rankings…</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={dimension} onValueChange={v=>setDimension(v as RankDim)}>
          <SelectTrigger className="w-52"><SelectValue/></SelectTrigger>
          <SelectContent>{RANK_OPTIONS.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{rankings.length} Life Groups</span>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-[#0E2A47] text-white text-xs uppercase tracking-wider">
            <tr><th className="px-3 py-2 text-left w-8">#</th><th className="px-3 py-2 text-left">Life Group</th><th className="px-3 py-2 text-center">Score</th><th className="px-3 py-2 text-center">Membros</th><th className="px-3 py-2 text-center">Visitantes</th><th className="px-3 py-2 text-center">Discip.</th><th className="px-3 py-2 text-center">Filhos</th></tr>
          </thead>
          <tbody>
            {sorted.slice(0,50).map((r,i)=>(
              <tr key={r.id} className={`border-t ${i<3?"bg-[#C9A227]/5":i%2===0?"bg-gray-50/50":""}`}>
                <td className="px-3 py-2 font-bold text-[#0E2A47]">{i===0?"🥇":i===1?"🥈":i===2?"🥉":r[dimension]}</td>
                <td className="px-3 py-2"><div className="font-medium text-[#0E2A47]">{r.name}</div>{r.church_name&&<div className="text-[11px] text-muted-foreground">{r.church_name}</div>}</td>
                <td className="px-3 py-2 text-center"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${BAND_COLOR[r.health_band]}`}>{BAND_ICON[r.health_band]} {r.score_total}</span></td>
                <td className="px-3 py-2 text-center font-medium">{r.members_count}</td>
                <td className="px-3 py-2 text-center">{r.total_visitantes??0}</td>
                <td className="px-3 py-2 text-center">{r.total_disc_ativos??0}</td>
                <td className="px-3 py-2 text-center">{r.direct_children}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const FUNNEL_STAGES = [
  {key:"visitantes" as const,label:"Visitante",color:"bg-blue-200",icon:"👋"},
  {key:"consolidacao" as const,label:"Consolidação",color:"bg-blue-300",icon:"🤝"},
  {key:"discipulado" as const,label:"Discipulado",color:"bg-indigo-300",icon:"📖"},
  {key:"batismo" as const,label:"Batismo",color:"bg-indigo-400",icon:"💧"},
  {key:"membros_ativos" as const,label:"Membro Ativo",color:"bg-[#0E2A47]",icon:"⭐"},
  {key:"servos_e_formacao" as const,label:"Servo / Formação",color:"bg-[#C9A227]",icon:"🙌"},
  {key:"lideres" as const,label:"Líder",color:"bg-amber-600",icon:"👑"},
];
function FunnelTab() {
  const { data:funnel, isLoading } = useRetentionFunnel();
  const { data:byChurch=[] } = useRetentionFunnelByChurch();
  if(isLoading||!funnel) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando funil…</p>;
  const maxVal = Math.max(1, funnel.visitantes);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-[#C9A227]"/>Funil Nacional de Retenção</CardTitle><CardDescription>Visitante até Líder · Total: {funnel.total} pessoas</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {FUNNEL_STAGES.map((stage,i)=>{
              const val=funnel[stage.key];
              const prev=i>0?funnel[FUNNEL_STAGES[i-1].key]:val;
              const conv=prev>0?Math.round((val/prev)*100):100;
              const barPct=Math.round((val/maxVal)*100);
              return (
                <div key={stage.key}>
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-base">{stage.icon}</span>
                    <div className="w-32 shrink-0 text-xs font-medium text-[#0E2A47]">{stage.label}</div>
                    <div className="flex-1 relative">
                      <div className={`h-8 rounded ${stage.color} opacity-80`} style={{width:`${barPct}%`,minWidth:"40px"}}/>
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white drop-shadow">{val.toLocaleString("pt-BR")}</span>
                    </div>
                    {i>0&&<div className="w-20 text-right"><span className={`text-xs font-semibold ${conv>=50?"text-green-600":conv>=25?"text-yellow-600":"text-red-500"}`}>{conv}% conv.</span></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {byChurch.length>1&&(
        <Card>
          <CardHeader><CardTitle className="text-base">Funil por Comunidade</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0E2A47] text-white"><tr><th className="px-3 py-2 text-left">Comunidade</th>{FUNNEL_STAGES.map(s=><th key={s.key} className="px-2 py-2 text-center">{s.icon}</th>)}<th className="px-3 py-2 text-center">Total</th></tr></thead>
                <tbody>{byChurch.map((c,i)=><tr key={c.church_id} className={`border-t ${i%2===0?"bg-gray-50/50":""}`}><td className="px-3 py-2 font-medium text-[#0E2A47]">{c.church_name??"—"}</td>{FUNNEL_STAGES.map(s=><td key={s.key} className="px-2 py-2 text-center">{c[s.key]}</td>)}<td className="px-3 py-2 text-center font-bold">{c.total}</td></tr>)}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReliabilityTab({ churchFilter }: { churchFilter:string }) {
  const { data:summary } = useReliabilitySummary();
  const { data:lgs=[], isLoading } = useLgReliability(churchFilter||undefined);
  if(isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Analisando dados…</p>;
  return (
    <div className="space-y-5">
      {summary&&(
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-green-500"><CardContent className="pt-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">✅ Confiáveis</p><p className="mt-1 font-display text-3xl font-bold text-green-700">{summary.lgs_confiaveis}</p><p className="text-xs text-muted-foreground">{summary.pct_confiaveis}% do total</p></CardContent></Card>
          <Card className="border-l-4 border-l-yellow-400"><CardContent className="pt-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">⚠️ Atenção</p><p className="mt-1 font-display text-3xl font-bold text-yellow-700">{summary.lgs_atencao}</p></CardContent></Card>
          <Card className="border-l-4 border-l-red-500"><CardContent className="pt-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">🔴 Críticos</p><p className="mt-1 font-display text-3xl font-bold text-red-700">{summary.lgs_criticos}</p></CardContent></Card>
          <Card className="border-l-4 border-l-[#C9A227]"><CardContent className="pt-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">📊 Taxa média</p><p className="mt-1 font-display text-3xl font-bold text-[#0E2A47]">{summary.taxa_reporte_media_pct}%</p><p className="text-xs text-muted-foreground">de reporte semanal</p></CardContent></Card>
        </div>
      )}
      {summary&&summary.lgs_sem_relatorio_recente>0&&(
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0"/>
          <p className="text-sm text-red-800"><strong>{summary.lgs_sem_relatorio_recente} Life Group(s)</strong> não enviaram relatório nos últimos 14 dias.</p>
        </div>
      )}
      <div className="space-y-2">
        {lgs.map(lg=>(
          <Card key={lg.id} className={`border-l-4 ${lg.reliability_band==="confiavel"?"border-l-green-400":lg.reliability_band==="atencao"?"border-l-yellow-400":"border-l-red-500"}`}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#0E2A47]">{lg.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REL_COLOR[lg.reliability_band]}`}>{REL_LABEL[lg.reliability_band]}</span>
                    {lg.church_name&&<span className="text-xs text-muted-foreground">{lg.church_name}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lg.flag_sem_relatorio_recente&&<span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded"><XCircle className="h-3 w-3"/>Sem relatório +14d</span>}
                    {lg.flag_reporte_irregular&&<span className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded"><AlertTriangle className="h-3 w-3"/>Reporte irregular</span>}
                    {lg.flag_dados_suspeitos&&<span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded"><Info className="h-3 w-3"/>Dados suspeitos</span>}
                    {lg.flag_sem_membros&&<span className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded"><Info className="h-3 w-3"/>Sem membros</span>}
                    {lg.total_flags===0&&<span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded"><CheckCircle2 className="h-3 w-3"/>Dados consistentes</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 text-xs text-muted-foreground space-y-0.5">
                  <p>📋 {lg.relatorios_90d} relatórios (90d)</p>
                  <p>📊 {lg.taxa_reporte_pct}% reporte</p>
                  <p>⏱️ {lg.dias_sem_relatorio===999?"Nunca reportou":`${lg.dias_sem_relatorio}d sem relatório`}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {lgs.length===0&&<p className="py-10 text-center text-sm text-muted-foreground">Nenhum LG encontrado.</p>}
      </div>
    </div>
  );
}

function GrowthTab() {
  const { data:growth=[], isLoading } = useGrowthVariation();
  if(isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando dados…</p>;
  const last=growth[growth.length-1];
  const maxP=Math.max(1,...growth.map(g=>g.presentes));
  const maxV=Math.max(1,...growth.map(g=>g.visitantes));
  return (
    <div className="space-y-5">
      {last&&(
        <Card>
          <CardHeader><CardTitle className="text-base">Variação vs. mês anterior — {last.mes_label}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {[{label:"Presentes",val:last.var_pct_presentes,abs:last.presentes},{label:"Visitantes",val:last.var_pct_visitantes,abs:last.visitantes},{label:"LGs Reportando",val:last.var_pct_lgs_reportaram,abs:last.lgs_reportaram}].map(m=>(
                <div key={m.label} className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{m.label}</p>
                  <p className="font-display text-2xl font-bold text-[#0E2A47]">{m.abs.toLocaleString("pt-BR")}</p>
                  <VarBadge val={m.val??null}/>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">Presentes por mês</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-36 items-end gap-1.5">
            {growth.map(g=>{const h=(g.presentes/maxP)*100;return(
              <div key={g.mes_label} className="group flex flex-1 flex-col items-center justify-end">
                <div className="relative w-full rounded-t bg-[#0E2A47]/80 hover:bg-[#0E2A47] transition-colors" style={{height:`${h}%`,minHeight:g.presentes>0?"4px":"0"}}>
                  <span className="invisible absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#0E2A47] px-1.5 py-0.5 text-[10px] text-white group-hover:visible z-10">{g.presentes}</span>
                </div>
                <p className="mt-1 text-[9px] text-muted-foreground">{g.mes_label.slice(5)}</p>
              </div>
            );})}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Visitantes por mês</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-28 items-end gap-1.5">
            {growth.map(g=>{const h=(g.visitantes/maxV)*100;return(
              <div key={g.mes_label} className="group flex flex-1 flex-col items-center justify-end">
                <div className="relative w-full rounded-t bg-[#C9A227]/80 hover:bg-[#C9A227] transition-colors" style={{height:`${h}%`,minHeight:g.visitantes>0?"4px":"0"}}>
                  <span className="invisible absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#0E2A47] px-1.5 py-0.5 text-[10px] text-white group-hover:visible z-10">{g.visitantes}</span>
                </div>
                <p className="mt-1 text-[9px] text-muted-foreground">{g.mes_label.slice(5)}</p>
              </div>
            );})}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico completo</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0E2A47] text-white"><tr><th className="px-3 py-2 text-left">Mês</th><th className="px-2 py-2 text-center">Presentes</th><th className="px-2 py-2 text-center">Var.%</th><th className="px-2 py-2 text-center">Visitantes</th><th className="px-2 py-2 text-center">Var.%</th><th className="px-2 py-2 text-center">Decisões</th><th className="px-2 py-2 text-center">Discip.</th><th className="px-2 py-2 text-center">LGs</th></tr></thead>
              <tbody>{[...growth].reverse().map((g,i)=><tr key={g.mes_label} className={`border-t ${i%2===0?"bg-gray-50/50":""}`}><td className="px-3 py-2 font-medium text-[#0E2A47]">{g.mes_label}</td><td className="px-2 py-2 text-center">{g.presentes.toLocaleString("pt-BR")}</td><td className="px-2 py-2 text-center"><VarBadge val={g.var_pct_presentes??null}/></td><td className="px-2 py-2 text-center">{g.visitantes}</td><td className="px-2 py-2 text-center"><VarBadge val={g.var_pct_visitantes??null}/></td><td className="px-2 py-2 text-center">{g.decisoes}</td><td className="px-2 py-2 text-center">{g.disc_ativos}</td><td className="px-2 py-2 text-center">{g.lgs_reportaram}</td></tr>)}</tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function IntelligenceAdmin() {
  const { data:churches=[] } = useChurches();
  const [churchFilter, setChurchFilter] = useState("");
  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-[#C9A227]"/>
          <div><h2 className="text-xl font-bold text-[#0E2A47]">Inteligência Ministerial</h2><p className="text-xs text-muted-foreground">Dados estratégicos para a liderança</p></div>
        </div>
        <Select value={churchFilter} onValueChange={setChurchFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todas as comunidades"/></SelectTrigger>
          <SelectContent><SelectItem value="">Todas as comunidades</SelectItem>{churches.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Tabs defaultValue="score">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="score" className="gap-1.5"><Trophy className="h-3.5 w-3.5"/>Score</TabsTrigger>
          <TabsTrigger value="rankings" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5"/>Rankings</TabsTrigger>
          <TabsTrigger value="funil" className="gap-1.5"><Users className="h-3.5 w-3.5"/>Funil</TabsTrigger>
          <TabsTrigger value="confiabilidade" className="gap-1.5"><Shield className="h-3.5 w-3.5"/>Confiabilidade</TabsTrigger>
          <TabsTrigger value="crescimento" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5"/>Crescimento</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="score"><ScoreTab churchFilter={churchFilter}/></TabsContent>
          <TabsContent value="rankings"><RankingsTab churchFilter={churchFilter}/></TabsContent>
          <TabsContent value="funil"><FunnelTab/></TabsContent>
          <TabsContent value="confiabilidade"><ReliabilityTab churchFilter={churchFilter}/></TabsContent>
          <TabsContent value="crescimento"><GrowthTab/></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
