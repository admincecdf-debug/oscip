"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users2, Star, Cake, BookOpen, Heart, TrendingDown, Briefcase, Bell, Users,
} from "lucide-react";
import { MembersAdmin } from "@/components/admin/MembersAdmin";
import { MemberScoreAdmin } from "@/components/admin/MemberScoreAdmin";
import { BirthdaysAdmin } from "@/components/admin/BirthdaysAdmin";
import { DiscipleshipAdmin } from "@/components/admin/DiscipleshipAdmin";
import { AcolhimentoAdmin } from "@/components/admin/AcolhimentoAdmin";
import { EvasionAdmin } from "@/components/admin/EvasionAdmin";
import { CrmPipelineAdmin } from "@/components/admin/CrmPipelineAdmin";
import { PublicPrayerRequestsAdmin, VisitRequestsAdmin } from "@/components/admin/ContactRequestsAdmin";

export function PessoasTabs() {
  return (
    <Tabs defaultValue="members" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="members" className="gap-1.5"><Users2 size={14} /> Membros</TabsTrigger>
        <TabsTrigger value="score" className="gap-1.5"><Star size={14} /> Score</TabsTrigger>
        <TabsTrigger value="birthdays" className="gap-1.5"><Cake size={14} /> Aniversários</TabsTrigger>
        <TabsTrigger value="discipleship" className="gap-1.5"><BookOpen size={14} /> Discipulado</TabsTrigger>
        <TabsTrigger value="acolhimento" className="gap-1.5"><Heart size={14} /> Acolhimento</TabsTrigger>
        <TabsTrigger value="evasao" className="gap-1.5"><TrendingDown size={14} /> Em risco</TabsTrigger>
        <TabsTrigger value="crm" className="gap-1.5"><Briefcase size={14} /> CRM</TabsTrigger>
        <TabsTrigger value="prayer-requests" className="gap-1.5"><Bell size={14} /> Pedidos de oração</TabsTrigger>
        <TabsTrigger value="visit-requests" className="gap-1.5"><Users size={14} /> Visitas</TabsTrigger>
      </TabsList>
      <TabsContent value="members"><MembersAdmin /></TabsContent>
      <TabsContent value="score"><MemberScoreAdmin /></TabsContent>
      <TabsContent value="birthdays"><BirthdaysAdmin /></TabsContent>
      <TabsContent value="discipleship"><DiscipleshipAdmin /></TabsContent>
      <TabsContent value="acolhimento"><AcolhimentoAdmin /></TabsContent>
      <TabsContent value="evasao"><EvasionAdmin /></TabsContent>
      <TabsContent value="crm"><CrmPipelineAdmin /></TabsContent>
      <TabsContent value="prayer-requests"><PublicPrayerRequestsAdmin /></TabsContent>
      <TabsContent value="visit-requests"><VisitRequestsAdmin /></TabsContent>
    </Tabs>
  );
}
