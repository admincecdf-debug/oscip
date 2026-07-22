"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, History, BookOpen, GraduationCap, MapPin, Mic2, Network, Heart } from "lucide-react";
import { VisaoGeralMembro } from "./VisaoGeralMembro";
import { LinhaDoTempoMembro } from "./LinhaDoTempoMembro";
import { DiscipuladoMembro } from "./DiscipuladoMembro";
import { TrilhaMaturidadeMembro } from "./TrilhaMaturidadeMembro";
import { OrganizacaoMembro } from "./OrganizacaoMembro";
import { FormacaoMembro } from "./FormacaoMembro";
import { MinisteriosMembro } from "./MinisteriosMembro";
import { RedeRelacionamentosMembro } from "./RedeRelacionamentosMembro";
import { FamiliaMembro } from "./FamiliaMembro";
import { RecomendacoesMembro } from "./RecomendacoesMembro";
import type { Member } from "@/types/domain";

export function MembroPanelTabs({ memberId, member }: { memberId: string; member: Member }) {
  return (
    <Tabs defaultValue="visao-geral" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="visao-geral" className="gap-1.5"><LayoutDashboard size={14} /> Visão Geral</TabsTrigger>
        <TabsTrigger value="organizacao" className="gap-1.5"><MapPin size={14} /> Organização</TabsTrigger>
        <TabsTrigger value="familia" className="gap-1.5"><Heart size={14} /> Família</TabsTrigger>
        <TabsTrigger value="maturidade" className="gap-1.5"><GraduationCap size={14} /> Maturidade</TabsTrigger>
        <TabsTrigger value="formacao" className="gap-1.5"><GraduationCap size={14} /> Formação</TabsTrigger>
        <TabsTrigger value="ministerios" className="gap-1.5"><Mic2 size={14} /> Ministérios</TabsTrigger>
        <TabsTrigger value="timeline" className="gap-1.5"><History size={14} /> Jornada Ministerial</TabsTrigger>
        <TabsTrigger value="discipulado" className="gap-1.5"><BookOpen size={14} /> Discipulado</TabsTrigger>
        <TabsTrigger value="rede" className="gap-1.5"><Network size={14} /> Rede</TabsTrigger>
      </TabsList>
      <TabsContent value="visao-geral" className="space-y-4">
        <RecomendacoesMembro memberId={memberId} />
        <VisaoGeralMembro memberId={memberId} />
      </TabsContent>
      <TabsContent value="organizacao"><OrganizacaoMembro member={member} /></TabsContent>
      <TabsContent value="familia"><FamiliaMembro memberId={memberId} /></TabsContent>
      <TabsContent value="maturidade"><TrilhaMaturidadeMembro memberId={memberId} /></TabsContent>
      <TabsContent value="formacao"><FormacaoMembro memberId={memberId} /></TabsContent>
      <TabsContent value="ministerios"><MinisteriosMembro memberId={memberId} /></TabsContent>
      <TabsContent value="timeline"><LinhaDoTempoMembro memberId={memberId} /></TabsContent>
      <TabsContent value="discipulado"><DiscipuladoMembro memberId={memberId} /></TabsContent>
      <TabsContent value="rede"><RedeRelacionamentosMembro memberId={memberId} memberName={member.full_name} /></TabsContent>
    </Tabs>
  );
}
