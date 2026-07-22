"use client";
import Link from "next/link";
import { IdCard, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMemberCard } from "@/hooks/use-queries";
import { CARD_STATUS_LABELS } from "@/services/cecId";
import type { Member } from "@/types/domain";

/**
 * Resumo da Carteira CEC ID no Dashboard — a experiência completa
 * (foto, QR Code, dados, elegibilidade) vive em /painel/carteira.
 */
export function MyCredentialCard({ member }: { member: Member | null | undefined; churchName?: string | null }) {
  const { data: card } = useMemberCard(member?.id ?? null);
  if (!member || !card) return null;

  const isReady = card.card_status === "elegivel" || card.card_status === "emitida";

  return (
    <Link href="/painel/carteira" className="block">
      <Card className="overflow-hidden transition hover:shadow-md hover:-translate-y-0.5">
        <CardContent className="flex items-center justify-between gap-3 pt-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy text-gold">
              <IdCard className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-base font-bold text-navy">Sua Carteira CEC ID</p>
              <p className="text-xs text-muted-foreground">
                {isReady ? "Credencial ativa" : CARD_STATUS_LABELS[card.card_status]}
                {card.cec_id && isReady && <> · <span className="font-mono">{card.cec_id}</span></>}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-1 shrink-0">
            Visualizar <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
