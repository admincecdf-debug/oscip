"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2, BarChart3, RadioTower, Brain, FileBarChart, Target } from "lucide-react";
import { OrgDashboardAdmin } from "@/components/admin/OrgDashboardAdmin";
import { SupervisionDashboard } from "@/components/admin/SupervisionDashboard";
import { ControlTowerAdmin } from "@/components/admin/ControlTowerAdmin";
import { IntelligenceAdmin } from "@/components/admin/IntelligenceAdmin";
import { MinisterialReportsAdmin } from "@/components/admin/MinisterialReportsAdmin";
import { MetasPlaceholder } from "@/components/admin/Placeholders";

export function ExecutivoTabs() {
  return (
    <Tabs defaultValue="visao-geral" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="visao-geral" className="gap-1.5"><BarChart2 size={14} /> Visão geral</TabsTrigger>
        <TabsTrigger value="supervisao" className="gap-1.5"><BarChart3 size={14} /> Supervisão</TabsTrigger>
        <TabsTrigger value="torre" className="gap-1.5"><RadioTower size={14} /> Torre de Controle</TabsTrigger>
        <TabsTrigger value="inteligencia" className="gap-1.5"><Brain size={14} /> Inteligência</TabsTrigger>
        <TabsTrigger value="relatorios" className="gap-1.5"><FileBarChart size={14} /> Relatórios</TabsTrigger>
        <TabsTrigger value="metas" className="gap-1.5"><Target size={14} /> Metas</TabsTrigger>
      </TabsList>
      <TabsContent value="visao-geral"><OrgDashboardAdmin /></TabsContent>
      <TabsContent value="supervisao"><SupervisionDashboard /></TabsContent>
      <TabsContent value="torre"><ControlTowerAdmin /></TabsContent>
      <TabsContent value="inteligencia"><IntelligenceAdmin /></TabsContent>
      <TabsContent value="relatorios"><MinisterialReportsAdmin /></TabsContent>
      <TabsContent value="metas"><MetasPlaceholder /></TabsContent>
    </Tabs>
  );
}
