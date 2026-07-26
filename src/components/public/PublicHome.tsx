"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Play, Calendar, Music, MapPin, Church as ChurchIcon, Sun, Sparkles,
  Clock, ArrowRight, ExternalLink, LayoutDashboard, FileDown, Search, Navigation,
  Home as HomeIcon, Newspaper, PlayCircle, CalendarDays, HandCoins, LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DarkBlueTheme } from "@/components/shared/DarkBlueTheme";
import { BottomNav, type BottomNavItem } from "@/components/shared/BottomNav";
import {
  usePublicSermons, usePublicEvents, useChurches, useCells, usePublicNews,
  useServiceTimes, useTodaysWord, useActiveBanners, useActiveCommunity, useMyProfile,
} from "@/hooks/use-queries";
import { youtubeThumb } from "@/services/content";
import { defaultServiceTimes, defaultWord } from "@/services/institutional";
import { PublicNewsSection } from "./PublicNewsSection";
import { PublicContactForms } from "./PublicContactForms";
import { PublicParticipateSection } from "./PublicParticipateSection";
import { HeroCarousel } from "./HeroCarousel";
import type { EventItem, Church, Cell } from "@/types/domain";

const STATUS_LABELS: Record<EventItem["status"], string> = {
  abertas: "Inscrições abertas", encerradas: "Encerradas", esgotado: "Esgotado", em_breve: "Em breve",
};
const EVENT_TYPE_LABELS: Record<string, string> = {
  culto: "Culto", congresso: "Congresso", conferencia: "Conferência",
  encontro: "Encontro", ebd: "Escola Bíblica", outro: "Outro",
};
const EVENT_TYPE_COLORS: Record<string, string> = {
  culto: "bg-navy/15 text-navy border-navy/30",
  congresso: "bg-gold/15 text-gold border-gold/30",
  conferencia: "bg-purple-100 text-purple-700 border-purple-200",
  encontro: "bg-blue-100 text-blue-700 border-blue-200",
  ebd: "bg-green-100 text-green-700 border-green-200",
  outro: "bg-muted/20 text-muted border-border",
};
const WEEKDAY_LABELS: Record<string, string> = {
  domingo: "Domingo", segunda: "Segunda", terca: "Terça",
  quarta: "Quarta", quinta: "Quinta", sexta: "Sexta", sabado: "Sábado",
};

export default function PublicHome() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "inicio";
  const [tab, setTab] = useState(initialTab);
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && t !== tab) setTab(t);
  }, [searchParams]);
  const { data: profile } = useMyProfile();
  const { data: community } = useActiveCommunity();
  const communityId = community?.id ?? null;
  const { data: sermons = [] } = usePublicSermons(communityId);
  const { data: news = [] } = usePublicNews(undefined, communityId);
  const { data: events = [] } = usePublicEvents(communityId);
  const { data: churches = [] } = useChurches();
  const { data: cells = [] } = useCells();
  const { data: banners = [] } = useActiveBanners(communityId);
  const sede = community ?? churches.find((c) => c.type === "sede") ?? churches[0] ?? null;
  const { data: dbServices = [] } = useServiceTimes(sede?.id ?? null);
  const { data: dbWord } = useTodaysWord(communityId);

  // Fallback inteligente: se o banco tem dados use-os; senao mostra defaults.
  const services = dbServices.length > 0 ? dbServices : defaultServiceTimes(sede);
  const word = dbWord ?? defaultWord();

  const navItems: BottomNavItem[] = [
    { href: "/?tab=inicio", label: "Home", icon: HomeIcon, isActive: (p) => p === "/" && tab === "inicio" },
    { href: "/?tab=noticias", label: "Notícias", icon: Newspaper, isActive: (p) => p === "/" && tab === "noticias" },
    { href: "/?tab=videos", label: "Vídeos", icon: PlayCircle, isActive: (p) => p === "/" && tab === "videos" },
    { href: "/?tab=cultos", label: "Cultos", icon: Clock, isActive: (p) => p === "/" && tab === "cultos" },
    { href: "/?tab=agenda", label: "Agenda", icon: CalendarDays, isActive: (p) => p === "/" && tab === "agenda" },
    { href: "/?tab=igrejas", label: "Endereços", icon: MapPin, isActive: (p) => p === "/" && tab === "igrejas" },
    { href: "/dizimo", label: "Doação", icon: HandCoins },
    { href: profile ? "/painel" : "/entrar", label: profile ? "Meu Painel" : "Entrar", icon: LogIn },
  ];

  return (
    <DarkBlueTheme>
      <header className="sticky top-0 z-20 border-b-[3px] border-gold bg-navy">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white">
            <img src={community?.logo_url || "/images/cec-family-logo.png"} alt={community?.name ?? "CEC Family"} className="h-9 w-9 rounded-full object-contain bg-white/5" />
            <span className="font-display text-lg font-bold tracking-wide">
              {community?.name ? community.name.toUpperCase() : "CEC FAMILY"}
            </span>
          </Link>
          <Button asChild size="sm">
            <Link href={profile ? "/painel" : "/entrar"}>{profile ? "Meu Painel" : "Área do membro"}</Link>
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="container py-4 pb-24">
        <TabsList className="sr-only">
          <NavTrigger value="inicio">Início</NavTrigger>
          <NavTrigger value="noticias">Notícias</NavTrigger>
          <NavTrigger value="cultos">Cultos</NavTrigger>
          <NavTrigger value="videos">Vídeos</NavTrigger>
          <NavTrigger value="agenda">Agenda</NavTrigger>
          <NavTrigger value="igrejas">Igrejas</NavTrigger>
          <NavTrigger value="celulas">Mapa de Life Groups</NavTrigger>
          <NavTrigger value="participar">Quero participar</NavTrigger>
          <NavTrigger value="contato">Quero conversar</NavTrigger>
        </TabsList>

        {/* === INÍCIO === */}
        <TabsContent value="inicio" className="space-y-8">
          {/* Hero rotativo (carousel) — fallback para hero estático se sem banners */}
          <HeroCarousel banners={banners}
            onSeeVideos={() => setTab("videos")}
            onSeeServices={() => setTab("cultos")}
          />

          {/* Palavra do dia */}
          <section>
            <Card className="bg-gradient-to-br from-gold/10 to-gold/0 border-gold/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-navy"><Sun className="h-5 w-5 text-gold" />{word.title}</CardTitle>
                {word.verse_ref && <CardDescription className="text-base font-semibold text-gold">{word.verse_ref}</CardDescription>}
              </CardHeader>
              <CardContent>
                {word.verse_text && <p className="font-display text-lg italic text-ink leading-relaxed">"{word.verse_text}"</p>}
                {word.reflection && <p className="mt-3 text-sm text-muted">{word.reflection}</p>}
                {word.prayer && (
                  <div className="mt-4 rounded-md border border-gold/30 bg-gold/5 p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-gold">Oração</p>
                    <p className="mt-1 font-display italic text-sm text-ink">{word.prayer}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Endereços próximos + Sedes Regionais */}
          <NearbyAddressesTeaser churches={churches} onGoTo={() => setTab("igrejas")} />

          {/* Últimos Vídeos */}
          {sermons.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl text-navy">Últimos vídeos</h2>
                <Button variant="ghost" onClick={() => setTab("videos")} className="gap-2">Mais vídeos... <ArrowRight className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sermons.slice(0, 5).map((s) => (
                  <a key={s.id} href={s.youtube_url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
                    <div className="relative">
                      <img src={s.thumbnail_url || youtubeThumb(s.youtube_url) || ""} alt="" className="aspect-video w-full object-cover" />
                      <div className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-navy/85 text-white"><Play className="h-5 w-5" /></div>
                      {s.duration && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">{s.duration}</span>}
                    </div>
                    <div className="p-4">
                      <b className="block text-sm text-ink">{s.title}</b>
                      <p className="mt-1 text-xs text-muted">
                        {new Date(s.published_at).toLocaleDateString("pt-BR")}
                        {s.speaker ? ` · ${s.speaker}` : ""}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Últimas Notícias */}
          {news.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl text-navy">Últimas notícias</h2>
                <Button variant="ghost" onClick={() => setTab("noticias")} className="gap-2">Ver todas <ArrowRight className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-3">
                {news.slice(0, 1).map((n) => (
                  <button key={n.id} onClick={() => setTab("noticias")} className="block w-full overflow-hidden rounded-2xl border bg-card text-left transition-shadow hover:shadow-md">
                    {n.cover_url && <img src={n.cover_url} alt="" className="aspect-[16/9] w-full object-cover" />}
                    <div className="p-4">
                      <span className="mb-2 inline-block rounded bg-red-600 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">Notícias</span>
                      <b className="block text-lg leading-snug text-ink">{n.title}</b>
                      {n.published_at && <p className="mt-1.5 text-xs text-muted">{new Date(n.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>}
                    </div>
                  </button>
                ))}
                {news.slice(1, 4).map((n) => (
                  <button key={n.id} onClick={() => setTab("noticias")} className="flex w-full items-center gap-3 overflow-hidden rounded-xl border bg-card p-2 text-left transition-shadow hover:shadow-md">
                    {n.cover_url && <img src={n.cover_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
                    <div className="min-w-0 flex-1">
                      <span className="mb-1 inline-block rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">Notícias</span>
                      <b className="block truncate text-sm text-ink">{n.title}</b>
                      {n.published_at && <p className="mt-0.5 text-[11px] text-muted">{new Date(n.published_at).toLocaleDateString("pt-BR")}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Próximos eventos resumo */}
          {events.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-xl text-navy">Próximos eventos</h2>
              <div className="space-y-3">{events.slice(0, 3).map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>
              <Button variant="ghost" onClick={() => setTab("agenda")} className="mt-4 gap-2">Ver agenda completa <ArrowRight className="h-4 w-4" /></Button>
            </section>
          )}

          {/* Próximos Cultos */}
          {services.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-xl text-navy">Próximos cultos</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.slice(0, 4).map((s) => (
                  <Card key={s.id} className="border-l-4 border-l-gold">
                    <CardContent className="flex items-center gap-4 pt-6">
                      <div className="text-center">
                        <b className="block font-display text-xl text-navy">{s.time.slice(0, 5)}</b>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{WEEKDAY_LABELS[s.weekday]}</span>
                      </div>
                      <div className="flex-1 border-l border-border pl-4">
                        <b className="text-ink">{s.description ?? "Culto"}</b>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Button variant="ghost" onClick={() => setTab("cultos")} className="mt-4 gap-2">Ver todos os cultos <ArrowRight className="h-4 w-4" /></Button>
            </section>
          )}
        </TabsContent>

        {/* === NOTÍCIAS === */}
        <TabsContent value="noticias">
          <PublicNewsSection churchId={communityId} />
        </TabsContent>

        {/* === CULTOS === */}
        <TabsContent value="cultos">
          <h2 className="mb-2 font-display text-2xl text-navy">Cultos e encontros</h2>
          <p className="mb-6 text-sm text-muted">Horários e dias das celebrações na {sede?.name ?? "Sede"}.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <Card key={s.id} className="border-l-4 border-l-gold">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="text-center">
                    <b className="block font-display text-xl text-navy">{s.time.slice(0,5)}</b>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{WEEKDAY_LABELS[s.weekday]}</span>
                  </div>
                  <div className="flex-1 border-l border-border pl-4">
                    <b className="text-ink">{s.description ?? "Culto"}</b>
                    {sede?.address && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><MapPin className="h-3 w-3" />{sede.address}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* === VÍDEOS === */}
        <TabsContent value="videos">
          <h2 className="mb-4 font-display text-2xl text-navy">Pregações</h2>
          {sermons.length === 0 ? (
            <p className="py-8 text-center italic text-muted">Em breve novas pregações por aqui.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sermons.map((s) => (
                <div key={s.id} className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
                  <a href={s.youtube_url} target="_blank" rel="noreferrer" className="block relative">
                    <img src={s.thumbnail_url || youtubeThumb(s.youtube_url) || ""} alt="" className="aspect-video w-full object-cover" />
                    <div className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-navy/85 text-white"><Play className="h-5 w-5" /></div>
                  </a>
                  <div className="p-4">
                    <b className="block text-sm text-ink">{s.title}</b>
                    <p className="mt-1 text-xs text-muted">{[s.reference, s.speaker].filter(Boolean).join(" · ")}</p>
                    {s.description && <p className="mt-1 text-xs text-muted line-clamp-2">{s.description}</p>}
                    {s.pdf_url && (
                      <a href={s.pdf_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline">
                        <FileDown className="h-3.5 w-3.5" /> Baixar PDF da palavra
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* === AGENDA === */}
        <TabsContent value="agenda">
          <h2 className="mb-4 font-display text-2xl text-navy">Agenda</h2>
          <AgendaList events={events} />
        </TabsContent>

        {/* === IGREJAS / ENDEREÇOS === */}
        <TabsContent value="igrejas">
          <AddressesBrowser churches={churches} />
        </TabsContent>

        {/* === MAPA DAS CÉLULAS === */}
        <TabsContent value="celulas">
          <h2 className="mb-2 font-display text-2xl text-navy">Mapa de Life Groups</h2>
          <p className="mb-6 text-sm text-muted">Encontre a célula (Life Group) mais próxima de você.</p>
          <CellsSearch cells={cells} />
        </TabsContent>

        {/* === QUERO PARTICIPAR === */}
        <TabsContent value="participar">
          <PublicParticipateSection />
        </TabsContent>

        {/* === QUERO CONVERSAR === */}
        <TabsContent value="contato">
          <PublicContactForms churchId={communityId} />
        </TabsContent>
      </Tabs>

      <footer className="container flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-6 pb-24">
        <p className="text-xs text-white/60">
          {community?.name ?? "CEC Manaus"} · Comunidade Evangélica Cristã
          {community?.whatsapp_phone && <> · WhatsApp: <a href={`https://wa.me/${community.whatsapp_phone.replace(/\D/g, '')}`} className="hover:underline">{community.whatsapp_phone}</a></>}
        </p>
      </footer>

      <BottomNav items={navItems} />
    </DarkBlueTheme>
  );
}

function NavTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsTrigger value={value} className="rounded-none bg-transparent px-4 py-3 text-sm font-semibold text-muted data-[state=active]:bg-transparent data-[state=active]:text-navy data-[state=active]:border-b-2 data-[state=active]:border-gold">
      {children}
    </TabsTrigger>
  );
}

function EventRow({ ev, light }: { ev: EventItem; light?: boolean }) {
  const d = new Date(ev.starts_at);
  const day = d.toLocaleDateString("pt-BR", { day:"2-digit" });
  const mon = d.toLocaleDateString("pt-BR", { month:"short" }).replace(".", "");
  const tlabel = EVENT_TYPE_LABELS[ev.event_type] ?? EVENT_TYPE_LABELS.outro;
  const tcolor = EVENT_TYPE_COLORS[ev.event_type] ?? EVENT_TYPE_COLORS.outro;
  return (
    <div className={`flex items-center gap-4 rounded-xl border p-4 ${light ? "bg-card" : "bg-navy text-white border-navy-600"}`}>
      <div className="flex w-12 flex-col items-center leading-tight">
        <b className="text-lg text-gold">{day}</b>
        <span className={`text-[11px] uppercase ${light ? "text-muted" : "text-white/70"}`}>{mon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <b className={`truncate text-sm ${light ? "text-ink" : "text-white"}`}>{ev.title}</b>
          <span className={`whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase ${light ? tcolor : "border-white/30 text-white/85"}`}>{tlabel}</span>
        </div>
        <p className={`mt-0.5 text-xs ${light ? "text-muted" : "text-white/70"}`}>
          {d.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}{ev.location ? ` · ${ev.location}` : ""}
        </p>
      </div>
      <span className="whitespace-nowrap rounded-full border border-gold px-2 py-1 text-[11px] font-extrabold text-gold">{STATUS_LABELS[ev.status]}</span>
    </div>
  );
}

function AddressesBrowser({ churches }: { churches: Church[] }) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const matches = (c: Church) => !term || [c.name, c.city, c.state, c.address].filter(Boolean).join(" ").toLowerCase().includes(term);

  const locais = churches.filter((c) => c.type === "igreja_local" && matches(c));
  const regionais = churches.filter((c) => c.type === "nucleo" && matches(c));
  const sedes = churches.filter((c) => c.type === "sede" && matches(c));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 font-display text-2xl text-navy">Endereços</h2>
        <p className="mb-4 text-sm text-muted">Encontre a Comunidade Evangélica Cristã mais próxima de você.</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por igreja, cidade ou endereço..."
            className="w-full rounded-full border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:border-gold"
          />
        </div>
      </div>

      <AddressSection title="Igrejas Locais" icon={<ChurchIcon className="h-5 w-5" />} churches={locais} />
      <AddressSection title="Sedes Regionais" icon={<Navigation className="h-5 w-5" />} churches={regionais} />
      <AddressSection title="Sede" icon={<Sparkles className="h-5 w-5" />} churches={sedes} />
    </div>
  );
}

function AddressSection({ title, icon, churches }: { title: string; icon: React.ReactNode; churches: Church[] }) {
  if (churches.length === 0) return null;
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 font-display text-lg text-navy"><span className="text-gold">{icon}</span>{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {churches.map((c) => <ChurchCard key={c.id} church={c} />)}
      </div>
    </section>
  );
}

/** Teaser da home: prévia de igrejas + botão "Ir para Endereços" / "Sede Regional". */
function NearbyAddressesTeaser({ churches, onGoTo }: { churches: Church[]; onGoTo: () => void }) {
  const locais = churches.filter((c) => c.type === "igreja_local").slice(0, 3);
  const regionais = churches.filter((c) => c.type === "nucleo").slice(0, 3);
  if (locais.length === 0 && regionais.length === 0) return null;

  return (
    <section className="space-y-4">
      {locais.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-navy"><ChurchIcon className="h-5 w-5 text-gold" />Comunidade mais próxima</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {locais.map((c) => (
              <div key={c.id} className="w-48 shrink-0 overflow-hidden rounded-xl border bg-card">
                {c.banner_url ? <img src={c.banner_url} alt={c.name} className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center bg-navy/10"><ChurchIcon className="h-8 w-8 text-navy/40" /></div>}
                <p className="p-2 text-xs font-bold uppercase text-navy">{c.name}</p>
              </div>
            ))}
          </div>
          <Button onClick={onGoTo} className="mt-3 w-full gap-2 rounded-full"><ChurchIcon className="h-4 w-4" />Ir para Endereços</Button>
        </div>
      )}
      {regionais.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-navy"><Navigation className="h-5 w-5 text-gold" />Sedes Regionais</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {regionais.map((c) => (
              <div key={c.id} className="w-48 shrink-0 overflow-hidden rounded-xl border bg-card">
                {c.banner_url ? <img src={c.banner_url} alt={c.name} className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center bg-navy/10"><Navigation className="h-8 w-8 text-navy/40" /></div>}
                <p className="p-2 text-xs font-bold uppercase text-navy">{c.name}</p>
              </div>
            ))}
          </div>
          <Button onClick={onGoTo} variant="outline" className="mt-3 w-full gap-2 rounded-full">Ir para Sede Regional</Button>
        </div>
      )}
    </section>
  );
}

function ChurchCard({ church }: { church: Church }) {
  const fullAddress = [church.address, church.city, church.state].filter(Boolean).join(", ");
  const mapsUrl = fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : null;
  const typeLabel = church.type === "sede" ? "SEDE" : church.type === "nucleo" ? "NÚCLEO" : "IGREJA LOCAL";
  return (
    <Card className="overflow-hidden">
      {church.banner_url ? (
        <img src={church.banner_url} alt={church.name} className="aspect-[16/10] w-full object-cover" />
      ) : (
        <div className="grid aspect-[16/10] w-full place-items-center bg-navy/10"><ChurchIcon className="h-10 w-10 text-navy/40" /></div>
      )}
      <CardHeader>
        <span className="text-[10px] font-extrabold tracking-widest text-gold">{typeLabel}</span>
        <CardTitle className="flex items-center gap-2"><ChurchIcon className="h-5 w-5 text-navy" />{church.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {church.address && <p className="flex items-start gap-2 text-sm text-ink"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />{church.address}</p>}
        {(church.city || church.state) && <p className="text-xs text-muted ml-6">{[church.city, church.state].filter(Boolean).join(" — ")}</p>}
        {mapsUrl && (
          <Button asChild variant="outline" size="sm" className="mt-3 gap-1">
            <a href={mapsUrl} target="_blank" rel="noreferrer">Ver no mapa <ExternalLink className="h-3 w-3" /></a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AgendaList({ events }: { events: EventItem[] }) {
  const [filter, setFilter] = useState<string>("todos");
  const types = ["todos","culto","congresso","conferencia","encontro","ebd","outro"] as const;
  const filtered = filter === "todos" ? events : events.filter((e) => (e.event_type ?? "outro") === filter);

  if (events.length === 0) {
    return <p className="py-8 text-center italic text-muted">Nenhum evento publicado no momento.</p>;
  }

  return (
    <div>
      <div className="mb-4 overflow-x-auto">
        <div className="flex min-w-max gap-1.5">
          {types.map((t) => (
            <button key={t} onClick={() => setFilter(t)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase transition ${
                filter === t
                  ? "bg-navy text-white border-navy"
                  : "bg-card text-muted border-border hover:border-navy/30"
              }`}>
              {t === "todos" ? "Todos" : (EVENT_TYPE_LABELS[t] ?? t)}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center italic text-muted">Nenhum evento nessa categoria.</p>
      ) : (
        <div className="space-y-3">{filtered.map((ev) => <EventRow key={ev.id} ev={ev} light />)}</div>
      )}
    </div>
  );
}

function CellsSearch({ cells }: { cells: Cell[] }) {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [weekday, setWeekday] = useState("");
  const [time, setTime] = useState("");

  // Listas para os selects (apenas valores reais já cadastrados)
  const states = Array.from(new Set(cells.map((c) => c.state).filter(Boolean) as string[])).sort();
  const cities = Array.from(new Set(cells.filter((c) => !state || c.state === state).map((c) => c.city).filter(Boolean) as string[])).sort();
  const neighborhoods = Array.from(new Set(cells.filter((c) => (!city || c.city === city) && (!state || c.state === state)).map((c) => c.neighborhood).filter(Boolean) as string[])).sort();

  const filtered = cells.filter((c) => c.is_active)
    .filter((c) => !state || c.state === state)
    .filter((c) => !city || c.city === city)
    .filter((c) => !neighborhood || c.neighborhood === neighborhood)
    .filter((c) => !weekday || c.meeting_weekday === weekday)
    .filter((c) => !time || (c.meeting_time && c.meeting_time.slice(0,2) === time));

  const hasFilter = state || city || neighborhood || weekday || time;

  function clear() {
    setState(""); setCity(""); setNeighborhood(""); setWeekday(""); setTime("");
  }

  return (
    <div>
      <div className="mb-4 rounded-xl border bg-card p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Filtros de busca</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select value={state} onChange={(e) => { setState(e.target.value); setCity(""); setNeighborhood(""); }}
            className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">Estado (todos)</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={city} onChange={(e) => { setCity(e.target.value); setNeighborhood(""); }}
            className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">Cidade (todas)</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">Bairro (todos)</option>
            {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={weekday} onChange={(e) => setWeekday(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">Dia (qualquer)</option>
            <option value="domingo">Domingo</option>
            <option value="segunda">Segunda</option>
            <option value="terca">Terça</option>
            <option value="quarta">Quarta</option>
            <option value="quinta">Quinta</option>
            <option value="sexta">Sexta</option>
            <option value="sabado">Sábado</option>
          </select>
          <select value={time} onChange={(e) => setTime(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">Horário (qualquer)</option>
            <option value="06">Manhã (06h–11h)</option>
            <option value="12">Tarde (12h–17h)</option>
            <option value="18">Noite (18h–23h)</option>
          </select>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">{filtered.length} célula(s) encontrada(s)</p>
          {hasFilter && <Button onClick={clear} variant="ghost" size="sm">Limpar filtros</Button>}
        </div>
      </div>

      <CellsList cells={filtered} />
    </div>
  );
}

function CellsList({ cells }: { cells: Cell[] }) {
  const active = cells.filter((c) => c.is_active);
  if (active.length === 0) return <p className="py-8 text-center italic text-muted">Nenhuma célula cadastrada ainda.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {active.map((c) => {
        const mapsUrl = c.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}` : null;
        return (
          <Card key={c.id} className="border-l-4 border-l-gold">
            <CardHeader>
              <CardTitle className="text-base">{c.name}</CardTitle>
              {c.meeting_weekday && c.meeting_time && (
                <CardDescription className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{WEEKDAY_LABELS[c.meeting_weekday]} às {c.meeting_time.slice(0,5)}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {c.address ? (
                <p className="flex items-start gap-1 text-xs text-muted"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{c.address}</p>
              ) : (
                <p className="text-xs italic text-muted">Endereço não informado</p>
              )}
              {mapsUrl && (
                <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0 text-xs">
                  <a href={mapsUrl} target="_blank" rel="noreferrer">Como chegar →</a>
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
