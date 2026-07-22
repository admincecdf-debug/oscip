"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Network, DollarSign, Landmark, Mic2, GitBranch } from "lucide-react";
import { VisaoGeralComunidade } from "./VisaoGeralComunidade";
import { MdaStructure } from "@/components/admin/MdaStructure";
import { FinanceAdmin } from "@/components/admin/FinanceAdmin";
import { PatrimonyAdmin } from "@/components/admin/PatrimonyAdmin";
import { MinistriesAdmin } from "@/components/admin/MinistriesAdmin";
import { GenealogyAdmin } from "@/components/admin/GenealogyAdmin";

export function ComunidadePanelTabs({ churchId }: { churchId: string }) {
  return (
    <Tabs defaultValue="visao-geral" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="visao-geral" className="gap-1.5"><LayoutDashboard size={14} /> Visão Geral</TabsTrigger>
        <TabsTrigger value="estrutura" className="gap-1.5"><Network size={14} /> Estrutura MDA</TabsTrigger>
        <TabsTrigger value="financeiro" className="gap-1.5"><DollarSign size={14} /> Financeiro</TabsTrigger>
        <TabsTrigger value="patrimonio" className="gap-1.5"><Landmark size={14} /> Patrimônio</TabsTrigger>
        <TabsTrigger value="ministerios" className="gap-1.5"><Mic2 size={14} /> Ministérios</TabsTrigger>
        <TabsTrigger value="genealogia" className="gap-1.5"><GitBranch size={14} /> Genealogia</TabsTrigger>
      </TabsList>
      <TabsContent value="visao-geral"><VisaoGeralComunidade churchId={churchId} /></TabsContent>
      <TabsContent value="estrutura"><MdaStructure churchId={churchId} /></TabsContent>
      <TabsContent value="financeiro"><FinanceAdmin initialChurchId={churchId} /></TabsContent>
      <TabsContent value="patrimonio"><PatrimonyAdmin initialChurchId={churchId} /></TabsContent>
      <TabsContent value="ministerios"><MinistriesAdmin initialChurchId={churchId} /></TabsContent>
      <TabsContent value="genealogia"><GenealogyAdmin initialChurchId={churchId} /></TabsContent>
    </Tabs>
  );
}
