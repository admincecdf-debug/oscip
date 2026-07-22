"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  LogOut, Sparkles, AlertTriangle, BarChart3, Users, Heart, Map,
  Clock, MessageSquareHeart, User, Check, Plus, Calendar as Cal,
  Award, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MyMinistriesPanel } from "./MyMinistriesPanel";
import { CompleteProfileCard } from "./CompleteProfileCard";
import { MyCredentialCard } from "./MyCredentialCard";
import { MemberHeader } from "./MemberHeader";
import { NotificationsPanel, useNotificationCount, NotificationBadge } from "./NotificationsPanel";
import { supabase } from "@/lib/supabase/client";
import { touchCurrentSession } from "@/services/security";
import {
  useMyProfile, useDashboard, useChurches, useMdaAlerts,
  useMyMember, useCells, useCellMembers, useMemberCard,
  useMyActiveDiscipleship, useMyDisciples,
  useMyTimeline, useCellPrayers,
} from "@/hooks/use-queries";
import { logAudit } from "@/services/audit";
import { addPrayer, markPrayerAnswered } from "@/services/prayer";
import { profileEditSchema, newPrayerSchema, type ProfileEditInput, type NewPrayerInput } from "@/schemas";
import type { Cell, Member, PastoralTimeline } from "@/types/domain";

const INSTITUTIONAL_LINKS: { tab: string; label: string }[] = [
  { tab: "inicio", label: "Início" },
  { tab: "noticias", label: "Notícias" },
  { tab: "cultos", label: "Cultos" },
  { tab: "videos", label: "Vídeos" },
  { tab: "agenda", label: "Agenda" },
  { tab: "igrejas", label: "Igrejas" },
  { tab: "celulas", label: "Mapa de Life Groups" },
  { tab: "participar", label: "Quero participar" },
  { tab: "contato", label: "Quero conversar" },
];

const ROLE_LABELS: Record<string, string> = {
  apostolo:"Apóstolo", pastor:"Pastor", supervisor:"Supervisor",
  lider:"Líder", anfitriao:"Anfitrião", discipulador:"Discipulador",
  membro:"Membro", visitante:"Visitante",
};
const WEEKDAYS: Record<string, string> = {
  domingo:"Domingo", segunda:"Segunda", terca:"Terça",
  quarta:"Quarta", quinta:"Quinta", sexta:"Sexta", sabado:"Sábado",
};
const TIMELINE_LABELS: Record<string, string> = {
  conversao:"Conversão", batismo:"Batismo", consolidacao:"Consolidação",
  discipulado:"Discipulado", curso:"Curso", ministerio:"Ministério",
  encontro:"Encontro", mudanca_etapa:"Mudança de etapa", observacao:"Observação",
};
const STAGE_LABELS: Record<string, string> = {
  visitante:"Visitante", novo_convertido:"Novo convertido", consolidacao:"Consolidação",
  discipulado:"Discipulado", batismo:"Batismo", membro_ativo:"Membro ativo",
  servo:"Servo", lider_formacao:"Líder em formação", lider:"Líder",
  supervisor:"Supervisor", missionario:"Missionário",
};

export default function PanelDashboard() {
  const { data: profile } = useMyProfile();
  const { data: member } = useMyMember();
  const { data: card } = useMemberCard(member?.id ?? null);
  const { data: allChurches = [] } = useChurches();
  const myChurchName = allChurches.find((c) => c.id === member?.church_id)?.name ?? null;
  const isAdmin = profile?.role === "apostolo" || profile?.role === "pastor";
  const notifCount = useNotificationCount();

  useEffect(() => {
    touchCurrentSession(supabase);
  }, []);

  async function signOut() {
    if (profile) await logAudit(supabase, "logout", "auth", profile.id);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-background">
      <MemberHeader active="dashboard" isAdmin={isAdmin} cardReady={card?.card_status === "elegivel" || card?.card_status === "emitida"} onSignOut={signOut} />

      <Tabs defaultValue={isAdmin ? "geral" : "celula"}>
        {/* Menu Institucional Permanente — leva pra home pública já com a aba certa aberta */}
        <div className="border-b bg-navy/95">
          <nav className="container flex flex-wrap items-center gap-1 overflow-x-auto py-1.5">
            {INSTITUTIONAL_LINKS.map((l) => (
              <Link key={l.tab} href={`/?tab=${l.tab}`} className="whitespace-nowrap rounded px-2.5 py-1 text-[11px] font-semibold text-white/70 transition hover:bg-white/10 hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Abas pessoais do painel — logo abaixo da barra institucional */}
        <div className="border-b bg-card">
          <div className="container overflow-x-auto">
            <TabsList className="my-1.5 min-w-max">
              {isAdmin && <TabsTrigger value="geral"><BarChart3 className="mr-1 h-4 w-4" />Visão geral</TabsTrigger>}
              <TabsTrigger value="alertas" className="flex items-center gap-1.5">
                <NotificationBadge count={notifCount} />
                <span>Alertas{notifCount > 0 ? ` (${notifCount})` : ""}</span>
              </TabsTrigger>
              <TabsTrigger value="celula"><Users className="mr-1 h-4 w-4" />Minha célula</TabsTrigger>
              <TabsTrigger value="discipulado"><Heart className="mr-1 h-4 w-4" />Discipulado</TabsTrigger>
              <TabsTrigger value="jornada"><Map className="mr-1 h-4 w-4" />Minha jornada</TabsTrigger>
              <TabsTrigger value="oracao"><MessageSquareHeart className="mr-1 h-4 w-4" />Oração</TabsTrigger>
              <TabsTrigger value="ministerio"><Award className="mr-1 h-4 w-4" />Ministério</TabsTrigger>
              <TabsTrigger value="perfil"><User className="mr-1 h-4 w-4" />Meu Perfil/Atualizar</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <main className="container space-y-8 py-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Painel</p>
            <h1 className="mt-1 font-display text-3xl text-navy">{profile ? `Paz, ${profile.full_name.split(" ")[0]}.` : "Bem-vindo"}</h1>
            {profile && <p className="mt-1 text-sm font-bold text-gold">{ROLE_LABELS[profile.role] ?? profile.role}</p>}
            <Link href="/painel/seguranca" className="mt-1 inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-navy">
              Segurança e senha
            </Link>
          </div>

          {isAdmin && <TabsContent value="geral"><GeneralView /></TabsContent>}
          <TabsContent value="alertas"><NotificationsPanel /></TabsContent>
          <TabsContent value="celula"><MyCellTab member={member ?? null} profileId={profile?.id ?? null} /></TabsContent>
          <TabsContent value="discipulado"><DiscipleshipTab member={member ?? null} /></TabsContent>
          <TabsContent value="jornada"><JourneyTab member={member ?? null} /></TabsContent>
          <TabsContent value="oracao"><PrayerTab member={member ?? null} /></TabsContent>
          <TabsContent value="ministerio"><MyMinistriesPanel /></TabsContent>
          <TabsContent value="perfil"><ProfileTab /></TabsContent>
        </main>
      </Tabs>
    </div>
  );
}

// ============================================================
// VISÃO GERAL (admin) - KPIs + alertas MDA
// ============================================================
function GeneralView() {
  const [scope, setScope] = useState("");
  const { data: churches = [] } = useChurches();
  const { data: stats } = useDashboard(scope || null);
  const { data: alerts = [] } = useMdaAlerts();
  const multi = churches.length > 1;
  const scopeName = scope ? (churches.find((c) => c.id === scope)?.name ?? "Igreja") : "Toda a rede";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">{scopeName}</p>
        {multi && (
          <div className="rounded-xl border bg-card px-4 py-3">
            <Label htmlFor="scope" className="block text-[11px] uppercase tracking-wider text-muted">Visão</Label>
            <select id="scope" value={scope} onChange={(e)=>setScope(e.target.value)}
              className="mt-1 h-9 rounded-md border bg-background px-3 text-sm font-bold text-navy">
              <option value="">Toda a rede</option>
              {churches.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800"><AlertTriangle className="h-5 w-5"/>Estrutura MDA — alertas</CardTitle>
            <CardDescription className="text-yellow-700/80">Itens abaixo do mínimo recomendado de 3 filhos:</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-yellow-900">
              {alerts.map((a)=>(
                <li key={`${a.nivel}-${a.id}`}>
                  <b className="capitalize">{a.nivel}</b> — {a.nome}: <b>{a.filhos}</b> de 3 recomendados
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Membros"    value={stats?.total_members ?? 0} hero href="/admin?tab=members"/>
        <Kpi label="Visitantes" value={stats?.total_visitors ?? 0} href="/admin?tab=crm"/>
        <Kpi label="Células"    value={stats?.total_groups ?? 0} href="/admin?tab=life-groups"/>
        <Kpi label="Relatórios" value={stats?.total_reports ?? 0} href="/admin?tab=weekly"/>
        <Kpi label="Batismos"   value={stats?.baptisms ?? 0} href="/admin?tab=members"/>
      </section>

      {stats && Object.keys(stats.by_stage).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Jornada espiritual</CardTitle>
            <CardDescription>Distribuição dos membros por etapa</CardDescription>
          </CardHeader>
          <CardContent><JourneyBars byStage={stats.by_stage}/></CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, hero, href }:{ label:string; value:number; hero?:boolean; href?:string }) {
  const card = (
    <Card className={`${hero ? "bg-navy text-white" : ""} ${href ? "transition hover:shadow-md cursor-pointer" : ""}`}>
      <CardContent className="pt-6">
        <p className={`font-display text-3xl font-semibold ${hero ? "text-gold":"text-navy"}`}>{value}</p>
        <p className={`mt-1 text-xs font-semibold uppercase ${hero ? "text-white/70":"text-muted"}`}>{label}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}
function JourneyBars({ byStage }: { byStage: Record<string, number> }) {
  const entries = Object.entries(byStage).sort((a,b)=>b[1]-a[1]);
  const max = Math.max(1, ...entries.map(([,n])=>n));
  return (
    <div className="space-y-2.5">
      {entries.map(([k,n])=>(
        <div key={k} className="flex items-center gap-3">
          <span className="w-32 text-right text-xs font-semibold capitalize text-navy-600">{STAGE_LABELS[k] ?? k.replace(/_/g," ")}</span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-navy-50">
            <div className="h-full rounded bg-gradient-to-r from-navy to-gold" style={{ width: `${(n/max)*100}%` }}/>
          </div>
          <span className="w-8 text-sm font-extrabold text-navy">{n}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MINHA CÉLULA
// ============================================================
function MyCellTab({ member, profileId }: { member: Member | null; profileId: string | null }) {
  const { data: cells = [] } = useCells();
  const myCell: Cell | null = member?.life_group_id ? (cells.find((c)=>c.id === member.life_group_id) ?? null) : null;
  const { data: companions = [] } = useCellMembers(myCell?.id ?? null, member?.id ?? null);

  if (!member) return <NotLinkedMessage subject="a uma célula"/>;
  if (!myCell)  return <AwaitingLgMessage/>;

  const isResponsible = !!profileId && (myCell.leader_id === profileId || myCell.coleader_id === profileId || myCell.supervisor_id === profileId);
  const mapsUrl = myCell.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(myCell.address)}` : null;

  return (
    <div className="space-y-4">
      {isResponsible && (
        <Card className="border-l-4 border-l-gold bg-gold/5">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-gold" />
              <div>
                <p className="text-sm font-semibold text-navy">Relatório Semanal do Life Group</p>
                <p className="text-xs text-muted-foreground">Preencha o relatório desta semana pelo celular.</p>
              </div>
            </div>
            <Button asChild size="sm"><Link href="/painel/relatorio-lg">Preencher</Link></Button>
          </CardContent>
        </Card>
      )}
      <Card className="border-l-4 border-l-gold">
        <CardHeader>
          <CardTitle>{myCell.name}</CardTitle>
          {myCell.meeting_weekday && myCell.meeting_time && (
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5"/>{WEEKDAYS[myCell.meeting_weekday]} às {myCell.meeting_time.slice(0,5)}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {myCell.address ? (
            <p className="text-sm text-ink">{myCell.address}</p>
          ) : (
            <p className="text-sm italic text-muted">Endereço não informado</p>
          )}
          {mapsUrl && <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0 text-xs"><a href={mapsUrl} target="_blank" rel="noreferrer">Como chegar →</a></Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-gold"/>Companheiros de célula</CardTitle>
          <CardDescription>{companions.length} pessoa(s) além de você</CardDescription>
        </CardHeader>
        <CardContent>
          {companions.length === 0 ? (
            <p className="text-sm italic text-muted">Ainda não há outros membros cadastrados nesta célula.</p>
          ) : (
            <ul className="divide-y">
              {companions.map((c)=>(
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <b className="text-navy">{c.full_name}</b>
                    <p className="text-xs text-muted">{STAGE_LABELS[c.journey_stage] ?? c.journey_stage}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// DISCIPULADO
// ============================================================
function DiscipleshipTab({ member }: { member: Member | null }) {
  const { data: active } = useMyActiveDiscipleship(member?.id ?? null);
  const { data: disciples = [] } = useMyDisciples(member?.id ?? null);

  if (!member) return <NotLinkedMessage subject="ao discipulado"/>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-gold"/>Meu discipulador</CardTitle>
          <CardDescription>Quem caminha comigo na fé</CardDescription>
        </CardHeader>
        <CardContent>
          {!active ? (
            <p className="text-sm italic text-muted">Você ainda não foi vinculado a um discipulador. Fale com a liderança da sua célula.</p>
          ) : (
            <div className="space-y-2">
              <p className="font-display text-lg text-navy">{active.discipler?.full_name ?? "—"}</p>
              {active.disc.current_module && (
                <p className="text-sm"><b className="text-gold">Módulo atual:</b> {active.disc.current_module}</p>
              )}
              <p className="text-xs text-muted">Iniciado em {new Date(active.disc.started_on).toLocaleDateString("pt-BR")}</p>
              {active.disc.notes && <p className="mt-2 rounded-md bg-navy-50 p-3 text-sm text-ink">{active.disc.notes}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {disciples.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quem eu disciplino ({disciples.length})</CardTitle>
            <CardDescription>Pessoas que você está acompanhando na jornada</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {disciples.map((d)=>(
                <li key={d.id} className="rounded-md border p-3">
                  Discípulo: <b>{d.disciple_id.slice(0,8)}…</b>
                  {d.current_module && <p className="text-xs text-muted">{d.current_module}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// MINHA JORNADA (linha do tempo espiritual)
// ============================================================
function JourneyTab({ member }: { member: Member | null }) {
  const { data: events = [] } = useMyTimeline(member?.id ?? null);

  if (!member) return <NotLinkedMessage subject="à jornada espiritual"/>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Map className="h-5 w-5 text-gold"/>Minha jornada espiritual</CardTitle>
        <CardDescription>Os marcos da sua caminhada com Deus</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-navy-50 p-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Etapa atual</p>
            <b className="font-display text-lg text-navy">{STAGE_LABELS[member.journey_stage] ?? member.journey_stage}</b>
          </div>
        </div>

        {events.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-muted">Nenhum marco registrado na sua linha do tempo.</p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-gold/40 pl-6">
            {events.map((e)=><TimelineEvent key={e.id} event={e}/>)}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
function TimelineEvent({ event }: { event: PastoralTimeline }) {
  return (
    <li className="relative">
      <span className="absolute -left-[31px] mt-1.5 inline-block h-3 w-3 rounded-full border-2 border-gold bg-background"/>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-gold">{TIMELINE_LABELS[event.event_type] ?? event.event_type}</span>
        <span className="text-xs text-muted"><Cal className="mr-1 inline h-3 w-3"/>{new Date(event.event_date).toLocaleDateString("pt-BR")}</span>
      </div>
      <b className="mt-1 block text-navy">{event.title}</b>
      {event.description && <p className="text-sm text-muted">{event.description}</p>}
    </li>
  );
}

// ============================================================
// PEDIDOS DE ORAÇÃO
// ============================================================
function PrayerTab({ member }: { member: Member | null }) {
  const cellId = member?.life_group_id ?? null;
  const { data: prayers = [] } = useCellPrayers(cellId);
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<NewPrayerInput>({ resolver: zodResolver(newPrayerSchema) });

  async function onSubmit(v: NewPrayerInput) {
    setErr("");
    try {
      await addPrayer(supabase, v.request, member?.id ?? null, cellId);
      await logAudit(supabase, "insert", "prayer_requests", null, { from: "member-area" });
      reset({ request: "" });
      qc.invalidateQueries({ queryKey: ["cell-prayers", cellId] });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }
  async function toggle(id: string, answered: boolean) {
    await markPrayerAnswered(supabase, id, answered);
    qc.invalidateQueries({ queryKey: ["cell-prayers", cellId] });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquareHeart className="h-5 w-5 text-gold"/>Novo pedido</CardTitle>
          <CardDescription>Compartilhe com sua célula um motivo de oração</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <textarea {...register("request")} rows={3}
              className="w-full rounded-md border bg-background p-3 text-sm"
              placeholder="Pelo que você gostaria de pedir oração?"/>
            {errors.request && <p className="text-xs text-destructive">{errors.request.message}</p>}
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={isSubmitting} className="gap-2"><Plus className="h-4 w-4"/>Cadastrar pedido</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos da minha célula ({prayers.length})</CardTitle>
          <CardDescription>Pedidos compartilhados pelos companheiros</CardDescription>
        </CardHeader>
        <CardContent>
          {!cellId && <p className="text-sm italic text-muted">Você ainda não está vinculado a uma célula.</p>}
          {cellId && prayers.length === 0 && <p className="text-sm italic text-muted">Nenhum pedido cadastrado ainda.</p>}
          <ul className="divide-y">
            {prayers.map((p)=>(
              <li key={p.id} className="flex items-start justify-between gap-3 py-3">
                <div className={p.is_answered ? "opacity-60 line-through" : ""}>
                  <p className="text-sm text-ink">{p.request}</p>
                  <p className="mt-1 text-[11px] text-muted">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <Button onClick={()=>toggle(p.id, !p.is_answered)} variant="outline" size="sm" className="gap-1">
                  <Check className="h-3.5 w-3.5"/>{p.is_answered ? "Reabrir" : "Respondido"}
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// MEU PERFIL
// ============================================================
function ProfileTab() {
  const { data: profile } = useMyProfile();
  const { data: member } = useMyMember();
  const qc = useQueryClient();
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ProfileEditInput>({
      resolver: zodResolver(profileEditSchema),
      values: profile ? { full_name: profile.full_name, phone: profile.phone ?? "" } : undefined,
    });

  async function onSubmit(v: ProfileEditInput) {
    setOk(false); setErr("");
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({
      full_name: v.full_name, phone: v.phone || null,
    }).eq("id", profile.id);
    if (error) { setErr(error.message); return; }
    await logAudit(supabase, "update", "profiles", profile.id, { from: "member-area" });
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    setOk(true);
  }

  if (!profile) return <p className="text-sm text-muted">Carregando…</p>;

  return (
    <div className="space-y-4">
      <CompleteProfileCard member={member} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-gold"/>Meu Perfil/Atualizar</CardTitle>
          <CardDescription>{profile.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input {...register("full_name")}/>
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input {...register("phone")} placeholder="(00) 00000-0000"/>
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            {ok && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Perfil atualizado com sucesso.</p>}
            <Button type="submit" disabled={isSubmitting}>Salvar alterações</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// AUXILIARES
// ============================================================
function NotLinkedMessage({ subject }: { subject: string }) {
  return (
    <Card>
      <CardContent className="pt-8 pb-8 text-center">
        <p className="text-sm text-muted">Você ainda não está vinculado {subject}.</p>
        <p className="mt-1 text-xs text-muted">Fale com a liderança da sua célula para ser cadastrado.</p>
      </CardContent>
    </Card>
  );
}

function AwaitingLgMessage() {
  return (
    <Card className="border-2 border-dashed border-gold/40 bg-gradient-to-br from-gold/5 to-card">
      <CardContent className="pt-8 pb-8 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-gold" />
        <p className="mt-3 font-display text-lg text-navy">Aguardando indicação do seu Life Group</p>
        <p className="mt-2 text-sm text-muted max-w-md mx-auto">
          A liderança pastoral está cuidando de te indicar para o Life Group mais alinhado com o seu perfil e localização.
          Em breve um pastor(a) entrará em contato.
        </p>
        <p className="mt-3 text-xs text-muted">
          Enquanto isso, navegue pelos demais conteúdos da plataforma.
        </p>
      </CardContent>
    </Card>
  );
}
