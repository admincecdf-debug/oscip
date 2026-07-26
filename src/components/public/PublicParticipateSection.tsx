"use client";
import Link from "next/link";
import { Users, Heart, MessageCircleHeart, Home as HomeIcon, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const CTAS = [
  { intent: "lifegroup",                label: "Quero um Life Group",         description: "Participar de uma célula próxima de mim",       icon: Users,             accent: "from-gold/15 to-gold/5"   },
  { intent: "discipulado",              label: "Quero discipulado",            description: "Caminhar com um discipulador na fé",            icon: Heart,             accent: "from-purple-100 to-purple-50" },
  { intent: "acompanhamento_pastoral",  label: "Acompanhamento pastoral",     description: "Conversar com um pastor da liderança",          icon: MessageCircleHeart, accent: "from-blue-100 to-blue-50" },
  { intent: "visita",                   label: "Quero ser visitado",          description: "Receber um líder da igreja em casa",            icon: HomeIcon,          accent: "from-green-100 to-green-50" },
] as const;

export function PublicParticipateSection() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-navy">
          <Sparkles className="h-5 w-5 text-gold" />
          <h2 className="font-display text-2xl">Quero participar</h2>
        </div>
        <p className="mt-2 text-sm text-muted max-w-xl">
          Quando você quiser dar um passo adiante na caminhada, criamos sua conta e a liderança entra em contato.
          Escolha o que melhor descreve o que você procura agora.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CTAS.map((cta) => {
          const Ico = cta.icon;
          return (
            <Link key={cta.intent} href={`/cadastrar?intent=${cta.intent}`} className="group">
              <Card className={`h-full transition-all hover:-translate-y-0.5 hover:shadow-lg bg-gradient-to-br ${cta.accent}`}>
                <CardContent className="flex items-start gap-4 pt-6">
                  <div className="rounded-xl bg-navy p-3 text-gold">
                    <Ico className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <b className="block text-navy">{cta.label}</b>
                    <p className="mt-1 text-xs text-muted">{cta.description}</p>
                    <p className="mt-3 flex items-center gap-1 text-xs font-bold text-gold opacity-0 transition group-hover:opacity-100">
                      Começar agora <ArrowRight className="h-3 w-3" />
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-muted">
        Já tem conta? <Link href="/entrar" className="font-bold text-gold hover:underline">Acesse a área do membro</Link>.
      </p>
    </div>
  );
}
