"use client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import * as P from "@/services/profiles";
import * as Co from "@/services/content";
import * as C from "@/services/churches";
import * as EvG from "@/services/evangelismGroups";
import * as A from "@/services/audit";
import * as D from "@/services/dashboard";
import * as I from "@/services/institutional";
import * as Me from "@/services/members";
import * as Di from "@/services/discipleship";
import * as Tl from "@/services/timeline";
import * as Pr from "@/services/prayer";
import * as Rm from "@/services/relmdaReports";
import * as Ev from "@/services/events";
import * as Gs from "@/services/globalSearch";
import * as Sec from "@/services/security";

export const useMyProfile      = () => useQuery({ queryKey: ["my-profile"], queryFn: () => P.getMyProfile(supabase) });
export const useChurches       = () => useQuery({ queryKey: ["churches"],   queryFn: () => C.listChurches(supabase) });
export const useChurchStateName = (churchId: string | null) =>
  useQuery({
    queryKey: ["church-state-name", churchId],
    queryFn: () => C.getChurchStateName(supabase, churchId as string),
    enabled: !!churchId,
  });
export const useStates          = () => useQuery({ queryKey: ["states"],    queryFn: () => C.listStates(supabase) });
export const useNucleos         = () => useQuery({ queryKey: ["nucleos"],   queryFn: () => C.listNucleos(supabase) });
export const useLeadershipAssignments = () => useQuery({ queryKey: ["leadership-assignments"], queryFn: () => Ld.listLeadershipAssignments(supabase) });
export const useMemberRelocations = (memberId: string | null) =>
  useQuery({
    queryKey: ["member-relocations", memberId],
    queryFn: () => Rl.listMemberRelocations(supabase, memberId as string),
    enabled: !!memberId,
  });
export const useMemberCard = (memberId: string | null) =>
  useQuery({
    queryKey: ["member-card", memberId],
    queryFn: () => Cid.getMemberCard(supabase, memberId as string),
    enabled: !!memberId,
  });
export const useChurchAncestry  = () => useQuery({ queryKey: ["church-ancestry"], queryFn: () => C.listChurchAncestry(supabase) });
export const useDistricts      = () => useQuery({ queryKey: ["districts"],  queryFn: () => C.listDistricts(supabase) });
export const useAreas          = () => useQuery({ queryKey: ["areas"],      queryFn: () => C.listAreas(supabase) });
export const useSectors        = () => useQuery({ queryKey: ["sectors"],    queryFn: () => C.listSectors(supabase) });
export const useCells          = () => useQuery({ queryKey: ["cells"],      queryFn: () => C.listCells(supabase) });
export const useEvangelismGroups = () => useQuery({ queryKey: ["evangelism-groups"], queryFn: () => EvG.listEvangelismGroups(supabase) });
export const useEvangelismParticipants = (groupId: string | null) =>
  useQuery({
    queryKey: ["evangelism-participants", groupId ?? "none"],
    queryFn: () => Pp.listEvangelismParticipants(supabase, groupId!),
    enabled: !!groupId,
  });
export const useMdaAlerts      = () => useQuery({ queryKey: ["mda-alerts"], queryFn: () => C.listMdaAlerts(supabase) });
export const usePublicSermons  = (churchId?: string|null) => useQuery({ queryKey: ["public-sermons", churchId ?? "all"], queryFn: () => Co.listPublicSermons(supabase, churchId) });
export const usePublicEvents   = (churchId?: string|null) => useQuery({ queryKey: ["public-events", churchId ?? "all"],  queryFn: () => Co.listPublicEvents(supabase, churchId) });
export const useSermons        = () => useQuery({ queryKey: ["sermons"], queryFn: () => Co.listSermons(supabase) });
export const useEvents         = () => useQuery({ queryKey: ["events"],  queryFn: () => Co.listEvents(supabase) });
export const useAuditLogs      = () => useQuery({ queryKey: ["audit-logs"], queryFn: () => A.listAuditLogs(supabase) });
export const useDashboard      = (churchId: string|null) => useQuery({ queryKey: ["dashboard", churchId ?? "all"], queryFn: () => D.getDashboardStats(supabase, churchId) });
export const useCentralPendencias = () => useQuery({ queryKey: ["central-pendencias"], queryFn: () => D.listCentralPendencias(supabase) });
export const useMinisteriosEventosStats = (churchId: string | null) =>
  useQuery({ queryKey: ["ministerios-eventos-stats", churchId], queryFn: () => D.getMinisteriosEventosStats(supabase, churchId) });
export const useMinisteriosRanking = (churchId: string | null) =>
  useQuery({ queryKey: ["ministerios-ranking", churchId], queryFn: () => D.getMinisteriosRanking(supabase, churchId) });
export const useUsuariosStats = () => useQuery({ queryKey: ["usuarios-stats"], queryFn: () => D.getUsuariosStats(supabase) });
export const useGrowthBySector = () => useQuery({ queryKey: ["growth-by-sector"], queryFn: () => D.getGrowthBySector(supabase) });
export const useGrowthOverall = () => useQuery({ queryKey: ["growth-overall"], queryFn: () => D.getGrowthOverall(supabase) });

// B2 — conteudo institucional
export const useServiceTimes   = (churchId: string|null) => useQuery({ queryKey: ["service-times", churchId ?? "none"], queryFn: () => I.listServiceTimes(supabase, churchId) });
export const useAllServiceTimes= () => useQuery({ queryKey: ["service-times-all"], queryFn: () => I.listAllServiceTimes(supabase) });
export const useTodaysWord     = (churchId?: string|null) => useQuery({ queryKey: ["todays-word", churchId ?? "all"], queryFn: () => I.getTodaysWord(supabase, churchId) });
export const useDailyWords     = () => useQuery({ queryKey: ["daily-words"], queryFn: () => I.listDailyWords(supabase) });

// B3 — Area do membro
export const useMyMember          = () => useQuery({ queryKey: ["my-member"], queryFn: () => Me.getMyMember(supabase) });
export const useMemberCompletion  = (memberId: string | null) =>
  useQuery({
    queryKey: ["member-completion", memberId],
    queryFn: () => Me.getMemberCompletionPercent(supabase, memberId as string),
    enabled: !!memberId,
  });
export const useCellMembers       = (cellId: string|null, excludeId?: string|null) =>
  useQuery({
    queryKey: ["cell-members", cellId ?? "none", excludeId ?? "none"],
    queryFn: (): Promise<import("@/types/domain").Member[]> => cellId ? Me.listCellMembers(supabase, cellId, excludeId ?? undefined) : Promise.resolve([]),
    enabled: !!cellId,
  });
export const useMyActiveDiscipleship = (myMemberId: string|null) =>
  useQuery({
    queryKey: ["my-active-discipleship", myMemberId ?? "none"],
    queryFn: () => Di.getMyActiveDiscipleship(supabase, myMemberId),
    enabled: !!myMemberId,
  });
export const useDisciplesWithNames = (memberId: string | null) =>
  useQuery({
    queryKey: ["disciples-with-names", memberId],
    queryFn: () => Di.listDisciplesWithNames(supabase, memberId as string),
    enabled: !!memberId,
  });
export const useDiscipleshipChainUp = (memberId: string | null) =>
  useQuery({
    queryKey: ["discipleship-chain-up", memberId],
    queryFn: () => Di.getDiscipleshipChainUp(supabase, memberId as string),
    enabled: !!memberId,
  });
export const useMyDisciples = (myMemberId: string|null) =>
  useQuery({
    queryKey: ["my-disciples", myMemberId ?? "none"],
    queryFn: () => Di.listMyDisciples(supabase, myMemberId),
    enabled: !!myMemberId,
  });
export const useMyTimeline = (memberId: string|null) =>
  useQuery({
    queryKey: ["my-timeline", memberId ?? "none"],
    queryFn: () => Tl.listMemberTimeline(supabase, memberId),
    enabled: !!memberId,
  });
export const useRecentEvolutions = (days = 7) =>
  useQuery({
    queryKey: ["recent-evolutions", days],
    queryFn: () => Tl.listRecentEvolutions(supabase, days),
  });
export const useCellPrayers = (cellId: string|null) =>
  useQuery({
    queryKey: ["cell-prayers", cellId ?? "none"],
    queryFn: () => Pr.listCellPrayers(supabase, cellId),
    enabled: !!cellId,
  });

// B4a — Gestão da rede
export const useAllMembers = () => useQuery({
  queryKey: ["all-members"],
  queryFn: () => Me.listAllMembers(supabase),
});
export const useAllDiscipleships = () => useQuery({
  queryKey: ["all-discipleships"],
  queryFn: () => Di.listAllDiscipleships(supabase),
});

// B4b — Operação semanal
import * as Wr from "@/services/weeklyReports";
import * as Mr from "@/services/monthlyReports";
import * as Fn from "@/services/finance";

export const useWeeklyReports = (cellId: string | null) =>
  useQuery({
    queryKey: ["weekly-reports", cellId ?? "none"],
    queryFn: () => Wr.listWeeklyReports(supabase, cellId),
    enabled: !!cellId,
  });

export const useMonthlyReports = (cellId: string | null) =>
  useQuery({
    queryKey: ["monthly-reports", cellId ?? "none"],
    queryFn: () => Mr.listMonthlyReports(supabase, cellId),
    enabled: !!cellId,
  });

export const useMonthlyReportFull = (reportId: string | null) =>
  useQuery({
    queryKey: ["monthly-report-full", reportId ?? "none"],
    queryFn: () => reportId ? Mr.getMonthlyReportFull(supabase, reportId) : Promise.resolve(null),
    enabled: !!reportId,
  });

export const useFinances = (churchId: string | null, year: number, month: number) =>
  useQuery({
    queryKey: ["finances", churchId ?? "none", year, month],
    queryFn: () => Fn.listFinances(supabase, churchId, year, month),
    enabled: !!churchId,
  });

// M1a — Conteudo publico e formularios
import * as N from "@/services/news";
import * as Pf from "@/services/publicForms";

export const usePublicNews = (category?: import("@/types/domain").NewsCategory, churchId?: string|null) =>
  useQuery({
    queryKey: ["public-news", category ?? "all", churchId ?? "all"],
    queryFn: () => N.listPublicNews(supabase, category, churchId),
  });
export const useAllNews = () => useQuery({
  queryKey: ["all-news"], queryFn: () => N.listAllNews(supabase),
});
export const usePrayerRequests = (status?: import("@/types/domain").ContactStatus) =>
  useQuery({
    queryKey: ["prayer-requests", status ?? "all"],
    queryFn: () => Pf.listPrayerRequests(supabase, status),
  });
export const useVisitRequests = (status?: import("@/types/domain").ContactStatus) =>
  useQuery({
    queryKey: ["visit-requests", status ?? "all"],
    queryFn: () => Pf.listVisitRequests(supabase, status),
  });
export const usePendingCounts = () => useQuery({
  queryKey: ["pending-counts"],
  queryFn: () => Pf.getPendingCounts(supabase),
  refetchInterval: 60_000, // atualiza a cada minuto
});

// M1b — Banners
import * as Bn from "@/services/banners";
export const useActiveBanners = (churchId?: string|null) => useQuery({
  queryKey: ["active-banners", churchId ?? "all"],
  queryFn: () => Bn.listActiveBanners(supabase, churchId),
  refetchInterval: 60_000,
});
export const useAllBanners = () => useQuery({
  queryKey: ["all-banners"],
  queryFn: () => Bn.listAllBanners(supabase),
});

// M2a — Multicomunidade
import * as Com from "@/services/community";
export const useActiveCommunity = () => useQuery({
  queryKey: ["active-community"],
  queryFn: () => Com.resolveCommunity(supabase),
  staleTime: 5 * 60 * 1000, // 5min — muda raramente
});

// M4 — CRM Pastoral
import * as Pp from "@/services/pipeline";
export const usePipeline = (opts?: { stage?: import("@/types/domain").PipelineStage; communityId?: string|null }) =>
  useQuery({
    queryKey: ["pipeline", opts?.stage ?? "all", opts?.communityId ?? "all"],
    queryFn: () => Pp.listPipeline(supabase, opts),
  });

// M5 — Central de Acolhimento
export const useAcolhimento = (key: string) =>
  useQuery({
    queryKey: ["acolhimento", key],
    queryFn: () => Pp.listAcolhimento(supabase, key as Parameters<typeof Pp.listAcolhimento>[1]),
  });

// Engajamento — evasão, badges, multiplicação
import * as Eg from "@/services/engagement";
export const useMembersAtRisk = (opts?: { churchId?: string|null; lgId?: string|null }) =>
  useQuery({
    queryKey: ["members-at-risk", opts?.churchId ?? "all", opts?.lgId ?? "all"],
    queryFn: () => Eg.listMembersAtRisk(supabase, opts),
  });
export const useLgBadges = (lgId: string | null) =>
  useQuery({
    queryKey: ["lg-badges", lgId],
    queryFn: () => lgId ? Eg.getLgBadges(supabase, lgId) : Promise.resolve([]),
    enabled: !!lgId,
  });
export const useLgMultiplicationProgress = (lgId: string | null) =>
  useQuery({
    queryKey: ["lg-progress", lgId],
    queryFn: () => lgId ? Eg.getLgMultiplicationProgress(supabase, lgId) : Promise.resolve(null),
    enabled: !!lgId,
  });

// IA-1 — Indicadores objetivos
export const useLgIndicators = (lgId: string | null) => useQuery({
  queryKey: ["lg-indicators", lgId],
  queryFn: () => lgId ? Eg.getLgIndicators(supabase, lgId) : Promise.resolve(null),
  enabled: !!lgId,
});
export const useAllLgIndicators = (communityId?: string | null) => useQuery({
  queryKey: ["all-lg-indicators", communityId ?? "all"],
  queryFn: () => Eg.getAllLgIndicators(supabase, communityId),
});
export const useAggregateIndicators = (level: import("@/types/domain").AggregateLevel | null, scopeId: string | null) =>
  useQuery({
    queryKey: ["aggregate-indicators", level, scopeId],
    queryFn: () => (level && scopeId) ? Eg.getAggregateIndicators(supabase, level, scopeId) : Promise.resolve(null),
    enabled: !!level && !!scopeId,
  });

// Ministérios
import * as Mn from "@/services/ministries";
export const useMinistries = (churchId?: string|null) =>
  useQuery({
    queryKey: ["ministries", churchId ?? "all"],
    queryFn: () => Mn.listMinistries(supabase, churchId),
  });
export const useMyMinistries = () =>
  useQuery({
    queryKey: ["my-ministries"],
    queryFn: () => Mn.listMyMinistries(supabase),
  });
export const useMinistriesByMember = (memberId: string | null) =>
  useQuery({
    queryKey: ["ministries-by-member", memberId],
    queryFn: () => memberId ? Mn.listMinistriesByMember(supabase, memberId) : Promise.resolve([]),
    enabled: !!memberId,
  });
export const useMinistryMembers = (ministryId: string | null) =>
  useQuery({
    queryKey: ["ministry-members", ministryId],
    queryFn: () => ministryId ? Mn.listMinistryMembers(supabase, ministryId) : Promise.resolve([]),
    enabled: !!ministryId,
  });
export const useMinistryPosts = (ministryId?: string|null) =>
  useQuery({
    queryKey: ["ministry-posts", ministryId ?? "all"],
    queryFn: () => Mn.listMinistryPosts(supabase, ministryId),
  });

// M6 — Sugestão de LG
export const useLgSuggestions = (pipelineId: string | null) =>
  useQuery({
    queryKey: ["lg-suggestions", pipelineId],
    queryFn: () => pipelineId ? Pp.suggestLifeGroups(supabase, pipelineId) : Promise.resolve([]),
    enabled: !!pipelineId,
  });

// Tela detalhada do relatório semanal
import { getReportFull } from "@/services/weeklyReports";
export const useReportFull = (reportId: string | null) =>
  useQuery({
    queryKey: ["report-full", reportId],
    queryFn: () => reportId ? getReportFull(supabase, reportId) : Promise.resolve(null),
    enabled: !!reportId,
  });

// Permissões hierárquicas — escopo dos pastores
import * as Ps from "@/services/pastorScope";
export const usePastors = () =>
  useQuery({
    queryKey: ["pastors"],
    queryFn: () => Ps.listPastors(supabase),
  });
export const usePastorsWithoutScopeCount = () =>
  useQuery({
    queryKey: ["pastors-without-scope-count"],
    queryFn: () => Ps.countPastorsWithoutScope(supabase),
  });

// Supervisão hierárquica
import * as Sv from "@/services/supervision";
type SupLevel = "national" | "church_tree" | "church" | "district" | "area" | "sector";
export const useScopeMetrics = (level: SupLevel, id?: string | null) =>
  useQuery({
    queryKey: ["scope-metrics", level, id ?? "self"],
    queryFn: () => Sv.getScopeMetrics(supabase, level, id),
  });
export const useLgsWithHealth = (churchId?: string | null) =>
  useQuery({
    queryKey: ["lgs-with-health", churchId ?? "all"],
    queryFn: () => Sv.listLgsWithHealth(supabase, churchId),
  });

// MDA Health (Caderno 11-B)
import { getMdaHealthDashboard } from "@/services/mdaHealth";
export const useMdaHealth = () =>
  useQuery({
    queryKey: ["mda-health"],
    queryFn: () => getMdaHealthDashboard(supabase),
  });

// Caderno 13 — Visualizações grandes
import * as Vz from "@/services/visualizations";
export const useLgGenealogy = () =>
  useQuery({ queryKey: ["lg-genealogy"], queryFn: () => Vz.getLgGenealogy(supabase) });
export const useOrgKpis = () =>
  useQuery({ queryKey: ["org-kpis"], queryFn: () => Vz.getOrgKpis(supabase) });
export const useGrowthMonthly = () =>
  useQuery({ queryKey: ["growth-monthly"], queryFn: () => Vz.getGrowthMonthly(supabase) });
export const useExpansionCities = () =>
  useQuery({ queryKey: ["expansion-cities"], queryFn: () => Vz.getExpansionCities(supabase) });
export const useExpansionStates = () =>
  useQuery({ queryKey: ["expansion-states"], queryFn: () => Vz.getExpansionStates(supabase) });

// Caderno 12 — Patrimônio
import * as Pt from "@/services/patrimony";
export const useProperties = (churchId?: string | null) =>
  useQuery({ queryKey: ["properties", churchId ?? "all"], queryFn: () => Pt.listProperties(supabase, churchId) });
export const useAssets = (opts?: { churchId?: string | null; propertyId?: string | null }) =>
  useQuery({ queryKey: ["assets", opts?.churchId ?? "all", opts?.propertyId ?? "all"], queryFn: () => Pt.listAssets(supabase, opts) });
export const usePropertyDocs = (propertyId: string | null) =>
  useQuery({
    queryKey: ["property-docs", propertyId],
    queryFn: () => propertyId ? Pt.listPropertyDocs(supabase, propertyId) : Promise.resolve([]),
    enabled: !!propertyId,
  });
export const useAssetDocs = (assetId: string | null) =>
  useQuery({
    queryKey: ["asset-docs", assetId],
    queryFn: () => assetId ? Pt.listAssetDocs(supabase, assetId) : Promise.resolve([]),
    enabled: !!assetId,
  });
export const useAssetPhotos = (assetId: string | null) =>
  useQuery({
    queryKey: ["asset-photos", assetId],
    queryFn: () => assetId ? Pt.listAssetPhotos(supabase, assetId) : Promise.resolve([]),
    enabled: !!assetId,
  });
export const usePatrimonySummary = () =>
  useQuery({ queryKey: ["patrimony-summary"], queryFn: () => Pt.getPatrimonySummary(supabase) });

// C16 — Inteligência Ministerial
import * as Intel from "@/services/intelligence";
export const useLgScores = (churchId?: string) =>
  useQuery({ queryKey: ["lg-scores", churchId], queryFn: () => Intel.getLgScores(supabase, churchId) });
export const useLgRankings = (churchId?: string) =>
  useQuery({ queryKey: ["lg-rankings", churchId], queryFn: () => Intel.getLgRankings(supabase, churchId) });
export const useRetentionFunnel = () =>
  useQuery({ queryKey: ["retention-funnel"], queryFn: () => Intel.getRetentionFunnel(supabase) });
export const useRetentionFunnelByChurch = () =>
  useQuery({ queryKey: ["retention-funnel-church"], queryFn: () => Intel.getRetentionFunnelByChurch(supabase) });
export const useLgReliability = (churchId?: string) =>
  useQuery({ queryKey: ["lg-reliability", churchId], queryFn: () => Intel.getLgReliability(supabase, churchId) });
export const useReliabilitySummary = () =>
  useQuery({ queryKey: ["reliability-summary"], queryFn: () => Intel.getReliabilitySummary(supabase) });
export const useMonthlyConsolidation = (churchId?: string, mes?: string) =>
  useQuery({ queryKey: ["monthly-consolidation", churchId, mes], queryFn: () => Intel.getMonthlyConsolidation(supabase, { churchId, mes }) });
export const useGrowthVariation = () =>
  useQuery({ queryKey: ["growth-variation"], queryFn: () => Intel.getGrowthVariation(supabase) });

// C17 — Central de Metas
import * as Goals from "@/services/goals";
export const useGoals = (year?: number) =>
  useQuery({ queryKey: ["goals", year], queryFn: () => Goals.listGoals(supabase, year) });
export const useGoalsVsActual = (year?: number) =>
  useQuery({ queryKey: ["goals-vs-actual", year], queryFn: () => Goals.listGoalsVsActual(supabase, year) });
export const useMinistryGoalsVsActual = () =>
  useQuery({ queryKey: ["ministry-goals-vs-actual"], queryFn: () => Goals.listMinistryGoalsVsActual(supabase) });

// C18 — Torre de Controle
import * as CT from "@/services/controlTower";
import type { AlertType, AlertSeverity } from "@/types/domain";
export const useControlTowerAlerts = (opts?: { severity?: AlertSeverity; alertType?: AlertType; churchId?: string }) =>
  useQuery({ queryKey: ["control-tower-alerts", opts], queryFn: () => CT.getControlTowerAlerts(supabase, opts), refetchInterval: 60000 });
export const useControlTowerSummary = () =>
  useQuery({ queryKey: ["control-tower-summary"], queryFn: () => CT.getControlTowerSummary(supabase), refetchInterval: 60000 });

// C19 — Governança por Delegação
import * as Del from "@/services/delegations";
import type { DelegationModule } from "@/types/domain";
export const useCouncilMembers = () =>
  useQuery({ queryKey: ["council-members"], queryFn: () => Del.listCouncilMembers(supabase) });
export const useUsersDirectorySearch = (opts: { query?: string; stateId?: string; churchId?: string; role?: string }) =>
  useQuery({ queryKey: ["users-directory-search", opts], queryFn: () => Del.searchUsersDirectory(supabase, opts) });
export const useDelegations = (opts?: { status?: string; module?: DelegationModule; profile_id?: string }) =>
  useQuery({ queryKey: ["delegations", opts], queryFn: () => Del.listDelegations(supabase, opts) });
export const useRoleDelegations = () =>
  useQuery({ queryKey: ["role-delegations"], queryFn: () => Del.listRoleDelegations(supabase) });
export const useEmergencyAccess = () =>
  useQuery({ queryKey: ["emergency-access"], queryFn: () => Del.listEmergencyAccess(supabase) });
export const useComplianceDashboard = () =>
  useQuery({ queryKey: ["compliance-dashboard"], queryFn: () => Del.getComplianceDashboard(supabase), refetchInterval: 60000 });
export const useModuleRanking = () =>
  useQuery({ queryKey: ["module-ranking"], queryFn: () => Del.getModuleRanking(supabase) });
export const useModuleAccess = (module: DelegationModule) =>
  useQuery({ queryKey: ["module-access", module], queryFn: () => Del.checkModuleAccess(supabase, module), staleTime: 60000 });
export const useMyActiveModules = () =>
  useQuery({ queryKey: ["my-active-modules"], queryFn: () => Del.listMyActiveModules(supabase), staleTime: 60000 });
export const useHasPermission = (permissionKey: string, targetChurchId?: string | null) =>
  useQuery({
    queryKey: ["has-permission", permissionKey, targetChurchId],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      return Del.hasPermission(supabase, u.user.id, permissionKey, targetChurchId);
    },
    staleTime: 60000,
  });

// C20 — Score do Membro + Aniversariantes
import * as MS from "@/services/memberScore";
export const useMemberScores = (opts?: { churchId?: string; lgId?: string; band?: string }) =>
  useQuery({ queryKey: ["member-scores", opts], queryFn: () => MS.getMemberScores(supabase, opts) });
export const useMemberScoreById = (memberId: string) =>
  useQuery({ queryKey: ["member-score", memberId], queryFn: () => MS.getMemberScoreById(supabase, memberId), enabled: !!memberId });
export const useBirthdaysToday = (churchId?: string) =>
  useQuery({ queryKey: ["birthdays-today", churchId], queryFn: () => MS.getBirthdaysToday(supabase, churchId), refetchInterval: 3600000 });
export const useBirthdaysMonth = (opts?: { churchId?: string; lgId?: string }) =>
  useQuery({ queryKey: ["birthdays-month", opts], queryFn: () => MS.getBirthdaysMonth(supabase, opts) });
export const useBirthdaysUpcoming = (churchId?: string) =>
  useQuery({ queryKey: ["birthdays-upcoming", churchId], queryFn: () => MS.getBirthdaysUpcoming(supabase, churchId) });

// C21 — Financeiro Completo
export const useFinanceFlow = (churchId: string) =>
  useQuery({ queryKey: ["finance-flow", churchId], queryFn: () => import("@/services/finance").then(m => m.getMonthlyFlow(supabase, churchId)), enabled: !!churchId });
export const useFinanceCategories = (churchId: string, year: number, month?: number) =>
  useQuery({ queryKey: ["finance-categories", churchId, year, month], queryFn: () => import("@/services/finance").then(m => m.getCategoryBreakdown(supabase, churchId, year, month)), enabled: !!churchId });
export const useFinanceBudgets = (churchId: string, year: number) =>
  useQuery({ queryKey: ["finance-budgets", churchId, year], queryFn: () => import("@/services/finance").then(m => m.getBudgets(supabase, churchId, year)), enabled: !!churchId });

// C12 Blocos 2-5 — Patrimônio Avançado
import * as PA from "@/services/patrimonyAdvanced";
import * as Inv from "@/services/invites";
import * as Ld from "@/services/leadership";
import * as Rl from "@/services/relocations";
import * as Cid from "@/services/cecId";
import * as Cm from "@/services/cecmaisOfertas";
export const useDepreciationSummary = (churchId?: string) =>
  useQuery({ queryKey: ["depreciation-summary", churchId], queryFn: () => PA.getDepreciationSummary(supabase, churchId) });
export const useDepreciation = (assetId: string) =>
  useQuery({ queryKey: ["depreciation", assetId], queryFn: () => PA.getDepreciation(supabase, assetId), enabled: !!assetId });
export const useMaintenanceUpcoming = (churchId?: string) =>
  useQuery({ queryKey: ["maintenance-upcoming", churchId], queryFn: () => PA.getMaintenanceUpcoming(supabase, churchId) });
export const useMaintenanceHistory = (churchId?: string) =>
  useQuery({ queryKey: ["maintenance-history", churchId], queryFn: () => PA.getMaintenanceHistory(supabase, churchId) });
export const useInventoryCampaigns = (churchId?: string) =>
  useQuery({ queryKey: ["inventory-campaigns", churchId], queryFn: () => PA.getCampaigns(supabase, churchId) });
export const useLastInventory = (churchId?: string) =>
  useQuery({ queryKey: ["last-inventory", churchId], queryFn: () => PA.getLastInventory(supabase, churchId) });
export const usePatrimonyAccounting = (churchId?: string) =>
  useQuery({ queryKey: ["patrimony-accounting", churchId], queryFn: () => PA.getPatrimonyAccounting(supabase, churchId) });
export const usePatrimonyNationalSummary = () =>
  useQuery({ queryKey: ["patrimony-national-summary"], queryFn: () => PA.getPatrimonyNationalSummary(supabase) });
export const usePatrimonyAlerts = (churchId?: string) =>
  useQuery({ queryKey: ["patrimony-alerts", churchId], queryFn: () => PA.getPatrimonyAlerts(supabase, churchId) });

// CT-002 — Convites
export const useInviteLinks = (churchId?: string | null) =>
  useQuery({ queryKey: ["invite-links", churchId], queryFn: () => Inv.listInviteLinks(supabase, churchId) });
export const useValidateInviteToken = (token: string) =>
  useQuery({
    queryKey: ["invite-token", token],
    queryFn: () => Inv.validateInviteToken(supabase, token),
    enabled: !!token,
    retry: false,
  });

export const useCecmaisOfertas = (categoria?: import("@/types/domain").CECmaisCategoriaSlug) =>
  useQuery({
    queryKey: ["cecmais-ofertas", categoria ?? "all"],
    queryFn: () => Cm.listOfertas(supabase, categoria),
  });
export const useCecmaisOfertasAdmin = () =>
  useQuery({ queryKey: ["cecmais-ofertas-admin"], queryFn: () => Cm.listAllOfertasAdmin(supabase) });
export const useCecmaisOferta = (id: string | null) =>
  useQuery({
    queryKey: ["cecmais-oferta", id],
    queryFn: () => Cm.getOferta(supabase, id as string),
    enabled: !!id,
  });

// ============================================================
// RELMDA — Relatório Semanal de Life Group (Fase 1)
// ============================================================
export const useRelmdaDraftId = (lifeGroupId: string | null, weekNumber: number, month: number, year: number) =>
  useQuery({
    queryKey: ["relmda-draft-id", lifeGroupId, weekNumber, year],
    queryFn: () => Rm.getOrCreateDraft(supabase, lifeGroupId as string, weekNumber, month, year),
    enabled: !!lifeGroupId,
  });

export const useRelmdaReportFull = (reportId: string | null) =>
  useQuery({
    queryKey: ["relmda-report-full", reportId],
    queryFn: () => Rm.getReportFull(supabase, reportId as string),
    enabled: !!reportId,
  });

export const useRelmdaStatusHistory = (reportId: string | null) =>
  useQuery({
    queryKey: ["relmda-status-history", reportId],
    queryFn: () => Rm.getStatusHistory(supabase, reportId as string),
    enabled: !!reportId,
  });

export const useRelmdaSupervisorOverview = (weekNumber: number, month: number, year: number) =>
  useQuery({
    queryKey: ["relmda-supervisor-overview", weekNumber, month, year],
    queryFn: () => Rm.getSupervisorOverview(supabase, weekNumber, month, year),
  });

export const useRelmdaDeadline = (churchId: string | null) =>
  useQuery({
    queryKey: ["relmda-deadline", churchId],
    queryFn: () => Rm.getEffectiveDeadline(supabase, churchId as string),
    enabled: !!churchId,
  });
export const useRelmdaMonthlyComparison = (month: number, year: number) =>
  useQuery({
    queryKey: ["relmda-monthly-comparison", month, year],
    queryFn: () => Rm.getMonthlyComparison(supabase, month, year),
  });

export const useMemberStructureNames = (memberId: string | null) =>
  useQuery({
    queryKey: ["member-structure-names", memberId],
    queryFn: () => Me.getMemberStructureNames(supabase, memberId as string),
    enabled: !!memberId,
  });

export const useRecentCheckins = (eventLabel?: string) =>
  useQuery({
    queryKey: ["cec-id-checkins", eventLabel ?? "all"],
    queryFn: () => Cid.listRecentCheckins(supabase, eventLabel),
    refetchInterval: 8000,
  });

// ============================================================
// Eventos com Inscrição (módulo novo — diferente da Agenda simples acima)
// ============================================================
export const usePublicRegistrationEvents = (churchId?: string | null) =>
  useQuery({ queryKey: ["registration-events-public", churchId ?? "all"], queryFn: () => Ev.listPublicRegistrationEvents(supabase, churchId) });

export const useRegistrationEventBySlug = (slug: string | null) =>
  useQuery({
    queryKey: ["registration-event-by-slug", slug],
    queryFn: () => Ev.getRegistrationEventBySlug(supabase, slug as string),
    enabled: !!slug,
  });

export const useMyEventRegistrations = () =>
  useQuery({ queryKey: ["my-event-registrations"], queryFn: () => Ev.listMyEventRegistrations(supabase) });

export const useRegistrationEventsAdmin = () =>
  useQuery({ queryKey: ["registration-events-admin"], queryFn: () => Ev.listRegistrationEventsAdmin(supabase) });

export const useRegistrationEventAdmin = (id: string | null) =>
  useQuery({
    queryKey: ["registration-event-admin", id],
    queryFn: () => Ev.getRegistrationEventAdmin(supabase, id as string),
    enabled: !!id,
  });

export const useEventRegistrations = (eventId: string | null) =>
  useQuery({
    queryKey: ["event-registrations", eventId],
    queryFn: () => Ev.listEventRegistrations(supabase, eventId as string),
    enabled: !!eventId,
  });

export const useEventRegistrationSummary = (eventId: string | null) =>
  useQuery({
    queryKey: ["event-registration-summary", eventId],
    queryFn: () => Ev.getRegistrationSummary(supabase, eventId as string),
    enabled: !!eventId,
  });

export const useGlobalSearch = (query: string) =>
  useQuery({
    queryKey: ["global-search", query],
    queryFn: () => Gs.globalSearch(supabase, query),
    enabled: query.trim().length >= 2,
  });

export const useMySessions = () =>
  useQuery({ queryKey: ["my-sessions"], queryFn: () => Sec.listMySessions(supabase) });

// ── Formação (Cursos/Turmas/Matrículas) ─────────────────────────
import * as Fo from "@/services/formacao";
export const useCourses = () => useQuery({ queryKey: ["courses"], queryFn: () => Fo.listCourses(supabase) });
export const useCourseClasses = (courseId?: string) =>
  useQuery({ queryKey: ["course-classes", courseId], queryFn: () => Fo.listClasses(supabase, courseId) });
export const useEnrollments = (classId?: string) =>
  useQuery({ queryKey: ["enrollments", classId], queryFn: () => Fo.listEnrollments(supabase, classId), enabled: !!classId });
export const useMemberEnrollments = (memberId: string | null) =>
  useQuery({ queryKey: ["member-enrollments", memberId], queryFn: () => Fo.listMemberEnrollments(supabase, memberId as string), enabled: !!memberId });
export const useFormacaoStats = (churchId: string | null) =>
  useQuery({ queryKey: ["formacao-stats", churchId], queryFn: () => Fo.getFormacaoStats(supabase, churchId) });

// ── Família ──────────────────────────────────────────────────
import * as Fam from "@/services/family";
export const useMemberRelationships = (memberId: string | null) =>
  useQuery({
    queryKey: ["member-relationships", memberId],
    queryFn: () => Fam.listMemberRelationships(supabase, memberId as string),
    enabled: !!memberId,
  });

// ── Motor de Regras Ministeriais ─────────────────────────────
import * as Rec from "@/services/recommendations";
export const useMemberRecommendations = (memberId: string | null) =>
  useQuery({
    queryKey: ["member-recommendations", memberId],
    queryFn: () => Rec.getMemberRecommendations(supabase, memberId as string),
    enabled: !!memberId,
  });

// ── Relatório Consolidado por Área ──────────────────────────────
import * as AreaRep from "@/services/areaReport";
export const useAccessibleAreas = () => useQuery({ queryKey: ["accessible-areas"], queryFn: () => AreaRep.listAccessibleAreas(supabase) });
export const useAreaConsolidado = (areaId: string | null, month: number, year: number) =>
  useQuery({
    queryKey: ["area-consolidado", areaId, month, year],
    queryFn: () => AreaRep.getAreaConsolidado(supabase, areaId as string, month, year),
    enabled: !!areaId,
  });
