"use client";
import { useState } from "react";
import {
  LayoutDashboard, Zap, RadioTower, Brain, BarChart3, Target,
  Users, Star, Heart, TrendingDown, Briefcase,
  Building2, GitBranch, Map, Mic2, Shield, Lock,
  FileBarChart, CalendarRange, CalendarDays,
  Megaphone, Image, Radio, BookOpen,
  DollarSign, Landmark, UserCog,
  Download, Search, Bell,
  Gavel, ClipboardList, ChevronDown, ChevronRight,
  Menu, X, LogOut,
  BarChart2, Users2, ChevronLeft, Flame, Network, Link2, Cake, UserCog2, Sparkles, IdCard, Clock, GraduationCap, Activity,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useMyProfile, useMyActiveModules } from "@/hooks/use-queries";
import { DELEGATION_TAB_MAP } from "@/services/delegations";

export type TabKey =
  | "supervision" | "org-dashboard" | "pendencias" | "agenda" | "notificacoes" | "usuarios-painel"
  | "control-tower" | "intelligence" | "ministerial-reports" | "metas"
  | "members" | "leadership" | "score" | "birthdays" | "discipleship"
  | "acolhimento" | "evasao" | "crm" | "prayer-requests" | "visit-requests"
  | "communities" | "structure" | "genealogy" | "expansion-map" | "evangelism-groups" | "formacao"
  | "ministerios" | "life-groups" | "mda-health" | "saude" | "mda" | "permissions"
  | "weekly" | "monthly" | "relmda-supervisao" | "relmda-consolidacao" | "relmda-dashboard" | "relmda-prazos" | "relmda-area" | "cec-id-portaria"
  | "news" | "banners" | "sermons" | "events" | "services" | "word"
  | "finance" | "patrimony" | "gpv" | "cecmais-ofertas"
  | "delegations" | "invites" | "audit"
  | "export";

interface NavItem {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}
interface NavGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
}
export interface AdminSidebarProps {
  activeTab: TabKey;
  onNavigate: (tab: TabKey) => void;
  counts?: {
    prayer_pending?: number;
    visit_pending?: number;
    pipeline_new?: number;
    tower_alerts?: number;
  };
  userName?: string;
  userRole?: string;
  onSearch?: () => void;
  mobileOnly?: boolean;
}

export function buildGroups(counts: AdminSidebarProps["counts"] = {}): NavGroup[] {
  return [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard size={16} />,
      items: [
        { key: "org-dashboard", label: "Visão geral", icon: <BarChart2 size={15} /> },
        { key: "pendencias",    label: "Pendências",  icon: <ClipboardList size={15} /> },
        { key: "agenda",        label: "Agenda",       icon: <CalendarRange size={15} /> },
        { key: "notificacoes",  label: "Notificações", icon: <Bell size={15} /> },
        { key: "relmda-dashboard", label: "M.D.A. — Visão Geral", icon: <BarChart3 size={15} /> },
        { key: "supervision",   label: "Supervisão",  icon: <BarChart3 size={15} /> },
      ],
    },
    {
      id: "estrategico",
      label: "Estratégico",
      icon: <Zap size={16} />,
      items: [
        { key: "control-tower",       label: "Torre de Controle", icon: <RadioTower size={15} />, badge: counts.tower_alerts },
        { key: "intelligence",        label: "Inteligência",       icon: <Brain size={15} /> },
        { key: "ministerial-reports", label: "Relatórios",         icon: <BarChart3 size={15} /> },
        { key: "metas",               label: "Metas",              icon: <Target size={15} /> },
      ],
    },
    {
      id: "organizacao",
      label: "Organização",
      icon: <Building2 size={16} />,
      items: [
        { key: "communities",   label: "Comunidades",    icon: <Building2 size={15} /> },
        { key: "structure",     label: "Estrutura",      icon: <GitBranch size={15} /> },
        { key: "genealogy",     label: "Genealogia",     icon: <Network size={15} /> },
        { key: "ministerios",   label: "Ministérios",    icon: <Mic2 size={15} /> },
        { key: "formacao",      label: "Formação",       icon: <GraduationCap size={15} /> },
        { key: "life-groups",   label: "Life Groups",    icon: <Flame size={15} /> },
        { key: "evangelism-groups", label: "Grupos de Evangelismo", icon: <Megaphone size={15} /> },
        { key: "mda",           label: "Estrutura MDA",  icon: <Network size={15} /> },
        { key: "mda-health",    label: "Saúde MDA",      icon: <Heart size={15} /> },
        { key: "saude",         label: "Saúde",          icon: <Heart size={15} /> },
        { key: "expansion-map", label: "Mapa de Expansão",icon: <Map size={15} /> },
      ],
    },
    {
      id: "relatorios",
      label: "Relatórios Operacionais",
      icon: <FileBarChart size={16} />,
      items: [
        { key: "weekly",  label: "Life Groups — Semanal", icon: <CalendarDays size={15} /> },
        { key: "monthly", label: "Life Groups — Mensal",  icon: <CalendarRange size={15} /> },
        { key: "relmda-supervisao", label: "M.D.A. — Supervisão", icon: <FileBarChart size={15} /> },
        { key: "relmda-consolidacao", label: "M.D.A. — Consolidação", icon: <Network size={15} /> },
        { key: "relmda-dashboard", label: "M.D.A. — Visão Geral", icon: <BarChart3 size={15} /> },
        { key: "relmda-prazos", label: "M.D.A. — Prazos", icon: <Clock size={15} /> },
        { key: "relmda-area", label: "M.D.A. — Consolidado por Área", icon: <FileBarChart size={15} /> },
      ],
    },
    {
      id: "conteudo",
      label: "Conteúdo",
      icon: <Megaphone size={16} />,
      items: [
        { key: "news",    label: "Notícias",     icon: <Megaphone size={15} /> },
        { key: "banners", label: "Banners",      icon: <Image size={15} /> },
        { key: "sermons", label: "Pregações",    icon: <Mic2 size={15} /> },
        { key: "events",  label: "Agenda",       icon: <CalendarDays size={15} /> },
        { key: "services",label: "Cultos",       icon: <Radio size={15} /> },
        { key: "word",    label: "Palavra do dia",icon: <BookOpen size={15} /> },
      ],
    },
    {
      id: "cecmais",
      label: "CECmais",
      icon: <Sparkles size={16} />,
      items: [
        { key: "cecmais-ofertas", label: "Ofertas", icon: <Sparkles size={15} /> },
      ],
    },
    {
      id: "recursos",
      label: "Gestão de Recursos",
      icon: <DollarSign size={16} />,
      items: [
        { key: "finance",   label: "Financeiro",              icon: <DollarSign size={15} /> },
        { key: "patrimony", label: "Patrimônio",              icon: <Landmark size={15} /> },
        { key: "gpv",       label: "Recursos Humanos",icon: <UserCog size={15} /> },
      ],
    },
    {
      id: "cec-id",
      label: "CEC ID",
      icon: <IdCard size={16} />,
      items: [
        { key: "cec-id-portaria", label: "Leitor de Portaria", icon: <IdCard size={15} /> },
      ],
    },
    {
      id: "usuarios",
      label: "Administração de Usuários",
      icon: <UserCog2 size={16} />,
      items: [
        { key: "usuarios-painel", label: "Painel de Usuários", icon: <Activity size={15} /> },
        { key: "members",     label: "Membros",             icon: <Users2 size={15} /> },
        { key: "leadership",  label: "Liderança / Níveis",  icon: <UserCog2 size={15} /> },
        { key: "invites",     label: "Convites",            icon: <Link2 size={15} /> },
        { key: "permissions", label: "Permissões",          icon: <Shield size={15} /> },
        { key: "delegations", label: "Delegações",          icon: <Gavel size={15} /> },
        { key: "score",            label: "Score",               icon: <Star size={15} /> },
        { key: "birthdays",        label: "Aniversários",        icon: <Cake size={15} /> },
        { key: "discipleship",     label: "Discipulado",         icon: <BookOpen size={15} /> },
        { key: "acolhimento",      label: "Acolhimento",         icon: <Heart size={15} /> },
        { key: "evasao",           label: "Em risco",            icon: <TrendingDown size={15} /> },
        { key: "crm",              label: "CRM",                 icon: <Briefcase size={15} />, badge: counts.pipeline_new },
        { key: "prayer-requests",  label: "Pedidos de oração",   icon: <Bell size={15} />, badge: counts.prayer_pending },
        { key: "visit-requests",   label: "Visitas",             icon: <Users size={15} />, badge: counts.visit_pending },
      ],
    },
    {
      id: "auditoria",
      label: "Auditoria",
      icon: <ClipboardList size={16} />,
      items: [
        { key: "audit", label: "Registros de Auditoria", icon: <ClipboardList size={15} /> },
      ],
    },
    {
      id: "ferramentas",
      label: "Ferramentas",
      icon: <Download size={16} />,
      items: [
        { key: "export", label: "Exportar", icon: <Download size={15} /> },
      ],
    },
  ];
}

export function AdminSidebar({
  activeTab, onNavigate, counts = {}, userName, userRole, onSearch, mobileOnly = false,
}: AdminSidebarProps) {
  const { data: profile } = useMyProfile();
  const { data: activeModules = [] } = useMyActiveModules();
  const isApostolo = profile?.role === "apostolo";

  let groups = buildGroups(counts);
  if (!isApostolo) {
    const allowedTabKeys = new Set(activeModules.flatMap((m) => DELEGATION_TAB_MAP[m] ?? []));
    groups = groups
      .map((g) => ({ ...g, items: g.items.filter((i) => allowedTabKeys.has(i.key)) }))
      .filter((g) => g.items.length > 0);
  }

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeGroupId = groups.find((g) => g.items.some((i) => i.key === activeTab))?.id ?? "";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map((g) => [g.id, g.id === activeGroupId]))
  );

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  function handleNavigate(tab: TabKey) {
    onNavigate(tab);
    setMobileOpen(false);
  }

  const totalAlerts =
    (counts.prayer_pending ?? 0) + (counts.visit_pending ?? 0) +
    (counts.pipeline_new ?? 0) + (counts.tower_alerts ?? 0);

  const roleLabel: Record<string, string> = {
    apostolo: "Apóstolo", pastor: "Pastor", supervisor: "Supervisor", lider: "Líder",
  };

  const SidebarContent = (
    <aside className={[
      "flex h-full flex-col bg-navy text-white transition-all duration-300",
      collapsed ? "w-[60px]" : "w-[240px]",
    ].join(" ")}>
      {/* Cabeçalho */}
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-gold text-base">✦</span>
            <span className="font-display text-sm font-bold tracking-wide">CEC FAMILY</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="ml-auto rounded p-1 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          <ChevronLeft size={16} className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Busca global */}
      {!collapsed && onSearch && (
        <button onClick={onSearch}
          className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors">
          <Search size={13} />
          <span className="flex-1 text-left">Busca global</span>
          <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px] font-mono">⌘K</kbd>
        </button>
      )}
      {collapsed && onSearch && (
        <button onClick={onSearch}
          className="mx-auto mt-3 flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Busca global">
          <Search size={14} />
        </button>
      )}

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {groups.map((group) => {
          const isOpen = openGroups[group.id] ?? false;
          const groupHasActive = group.items.some((i) => i.key === activeTab);
          const groupBadge = group.items.reduce((s, i) => s + (i.badge ?? 0), 0);
          return (
            <div key={group.id} className="mb-0.5">
              <button
                onClick={() => toggleGroup(group.id)}
                className={[
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider transition-colors",
                  groupHasActive ? "text-gold" : "text-white/40 hover:text-white/70",
                ].join(" ")}
                title={collapsed ? group.label : undefined}
              >
                <span className={groupHasActive ? "text-gold" : "text-white/50"}>{group.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{group.label}</span>
                    {groupBadge > 0 && (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
                        {groupBadge}
                      </span>
                    )}
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </>
                )}
              </button>

              {(isOpen || collapsed) && (
                <div className={collapsed ? "space-y-0.5 px-1.5" : "space-y-0.5 pb-1"}>
                  {group.items.map((item) => {
                    const isActive = item.key === activeTab;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleNavigate(item.key)}
                        title={collapsed ? item.label : undefined}
                        className={[
                          "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-all",
                          collapsed ? "justify-center px-2" : "",
                          isActive ? "bg-gold/15 font-semibold text-gold" : "text-white/65 hover:bg-white/8 hover:text-white",
                        ].join(" ")}
                      >
                        <span className={isActive ? "text-gold" : "text-white/50"}>{item.icon}</span>
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {(item.badge ?? 0) > 0 && (
                              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Rodapé */}
      <div className="border-t border-white/10 p-3">
        {collapsed ? (
          <Button asChild variant="ghost" size="sm" className="w-full p-2 text-white/50 hover:text-white">
            <Link href="/painel" title="Voltar ao painel"><LogOut size={15} /></Link>
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold text-xs font-bold">
              {userName ? userName.charAt(0).toUpperCase() : "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{userName ?? "Admin"}</p>
              <p className="truncate text-[10px] text-white/40">{roleLabel[userRole ?? ""] ?? userRole ?? "Liderança"}</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0 p-1.5 text-white/40 hover:text-white">
              <Link href="/painel" title="Voltar ao painel"><LogOut size={14} /></Link>
            </Button>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {!mobileOnly && (
        <div className="hidden md:flex h-screen sticky top-0 flex-shrink-0">
          {SidebarContent}
        </div>
      )}

      <div className="md:hidden">
        <button onClick={() => setMobileOpen(true)} className="flex items-center gap-2 text-white" aria-label="Abrir menu">
          <Menu size={20} />
          {totalAlerts > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
              {totalAlerts}
            </span>
          )}
        </button>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <div className="w-[260px] h-full">
              <div className="relative h-full">
                <button onClick={() => setMobileOpen(false)}
                  className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20"
                  aria-label="Fechar menu">
                  <X size={14} />
                </button>
                <aside className="flex h-full w-full flex-col bg-navy text-white">
                  <div className="flex h-14 items-center border-b border-white/10 px-4">
                    <span className="text-gold mr-2">✦</span>
                    <span className="font-display text-sm font-bold">CEC FAMILY</span>
                  </div>
                  {onSearch && (
                    <button onClick={() => { onSearch(); setMobileOpen(false); }}
                      className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50">
                      <Search size={13} /><span>Busca global</span>
                    </button>
                  )}
                  <nav className="flex-1 overflow-y-auto py-3">
                    {groups.map((group) => {
                      const isOpen = openGroups[group.id] ?? false;
                      const groupHasActive = group.items.some((i) => i.key === activeTab);
                      return (
                        <div key={group.id} className="mb-0.5">
                          <button onClick={() => toggleGroup(group.id)}
                            className={["flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider",
                              groupHasActive ? "text-gold" : "text-white/40"].join(" ")}>
                            <span>{group.icon}</span>
                            <span className="flex-1">{group.label}</span>
                            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                          {isOpen && (
                            <div className="space-y-0.5 pb-1">
                              {group.items.map((item) => {
                                const isActive = item.key === activeTab;
                                return (
                                  <button key={item.key} onClick={() => handleNavigate(item.key)}
                                    className={["flex w-full items-center gap-2.5 px-6 py-2 text-sm transition-all",
                                      isActive ? "bg-gold/15 font-semibold text-gold" : "text-white/65 hover:bg-white/8 hover:text-white"].join(" ")}>
                                    <span>{item.icon}</span>
                                    <span className="flex-1">{item.label}</span>
                                    {(item.badge ?? 0) > 0 && (
                                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
                                        {item.badge}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </nav>
                  <div className="border-t border-white/10 p-4">
                    <p className="text-xs text-white/50">{userName ?? "Admin"} · {roleLabel[userRole ?? ""] ?? "Liderança"}</p>
                    <Button asChild variant="link" className="mt-1 p-0 text-xs text-white/40">
                      <Link href="/painel">← Voltar ao painel</Link>
                    </Button>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
