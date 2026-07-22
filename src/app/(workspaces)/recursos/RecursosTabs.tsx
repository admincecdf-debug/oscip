"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Landmark, UserCog } from "lucide-react";
import { FinanceAdmin } from "@/components/admin/FinanceAdmin";
import { PatrimonyAdmin } from "@/components/admin/PatrimonyAdmin";
import { GpvAdmin } from "@/components/admin/GpvAdmin";

export function RecursosTabs() {
  return (
    <Tabs defaultValue="financeiro" className="space-y-4">
      <TabsList>
        <TabsTrigger value="financeiro" className="gap-1.5"><DollarSign size={14} /> Financeiro</TabsTrigger>
        <TabsTrigger value="patrimonio" className="gap-1.5"><Landmark size={14} /> Patrimônio</TabsTrigger>
        <TabsTrigger value="gpv" className="gap-1.5"><UserCog size={14} /> Pessoas & Vínculos (GPV)</TabsTrigger>
      </TabsList>
      <TabsContent value="financeiro"><FinanceAdmin /></TabsContent>
      <TabsContent value="patrimonio"><PatrimonyAdmin /></TabsContent>
      <TabsContent value="gpv"><GpvAdmin /></TabsContent>
    </Tabs>
  );
}
