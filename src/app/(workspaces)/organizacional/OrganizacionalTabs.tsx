"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, GitBranch, Network, Mic2, Flame, Heart, Map, Shield, Megaphone,
} from "lucide-react";
import { CommunitiesAdmin } from "@/components/admin/CommunitiesAdmin";
import { OrgStructureAdmin } from "@/components/admin/OrgStructureAdmin";
import { GenealogyAdmin } from "@/components/admin/GenealogyAdmin";
import { MinistriesAdmin } from "@/components/admin/MinistriesAdmin";
import { CellsAdmin } from "@/components/admin/CellsAdmin";
import { EvangelismGroupsAdmin } from "@/components/admin/EvangelismGroupsAdmin";
import { MdaStructureAdmin } from "@/components/admin/MdaStructureAdmin";
import { MdaHealthAdmin } from "@/components/admin/MdaHealthAdmin";
import { HealthAdmin } from "@/components/admin/HealthAdmin";
import { ExpansionMapAdmin } from "@/components/admin/ExpansionMapAdmin";
import { PermissionsAdmin } from "@/components/admin/PermissionsAdmin";

export function OrganizacionalTabs() {
  return (
    <Tabs defaultValue="communities" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="communities" className="gap-1.5"><Building2 size={14} /> Comunidades</TabsTrigger>
        <TabsTrigger value="structure" className="gap-1.5"><GitBranch size={14} /> Estrutura</TabsTrigger>
        <TabsTrigger value="genealogy" className="gap-1.5"><Network size={14} /> Genealogia</TabsTrigger>
        <TabsTrigger value="ministerios" className="gap-1.5"><Mic2 size={14} /> Ministérios</TabsTrigger>
        <TabsTrigger value="life-groups" className="gap-1.5"><Flame size={14} /> Life Groups</TabsTrigger>
        <TabsTrigger value="evangelism-groups" className="gap-1.5"><Megaphone size={14} /> Grupos de Evangelismo</TabsTrigger>
        <TabsTrigger value="mda" className="gap-1.5"><Network size={14} /> Estrutura MDA</TabsTrigger>
        <TabsTrigger value="mda-health" className="gap-1.5"><Heart size={14} /> Saúde MDA</TabsTrigger>
        <TabsTrigger value="saude" className="gap-1.5"><Heart size={14} /> Saúde</TabsTrigger>
        <TabsTrigger value="expansion-map" className="gap-1.5"><Map size={14} /> Mapa de Expansão</TabsTrigger>
        <TabsTrigger value="permissions" className="gap-1.5"><Shield size={14} /> Permissões</TabsTrigger>
      </TabsList>
      <TabsContent value="communities"><CommunitiesAdmin /></TabsContent>
      <TabsContent value="structure"><OrgStructureAdmin /></TabsContent>
      <TabsContent value="genealogy"><GenealogyAdmin /></TabsContent>
      <TabsContent value="ministerios"><MinistriesAdmin /></TabsContent>
      <TabsContent value="life-groups"><CellsAdmin /></TabsContent>
      <TabsContent value="evangelism-groups"><EvangelismGroupsAdmin /></TabsContent>
      <TabsContent value="mda"><MdaStructureAdmin /></TabsContent>
      <TabsContent value="mda-health"><MdaHealthAdmin /></TabsContent>
      <TabsContent value="saude"><HealthAdmin /></TabsContent>
      <TabsContent value="expansion-map"><ExpansionMapAdmin /></TabsContent>
      <TabsContent value="permissions"><PermissionsAdmin /></TabsContent>
    </Tabs>
  );
}
