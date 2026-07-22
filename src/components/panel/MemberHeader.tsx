"use client";
import Link from "next/link";
import { Sparkles, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mais } from "@/components/shared/CECmaisBrand";

export function MemberHeader({ active, isAdmin, cardReady, onSignOut }: {
  active: "dashboard" | "carteira" | "cecmais";
  isAdmin?: boolean;
  cardReady?: boolean;
  onSignOut: () => void;
}) {
  return (
    <header className="border-b-[3px] border-gold bg-navy">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="h-5 w-5 text-gold" />
          <span className="font-display text-lg font-bold tracking-wide">CEC FAMILY</span>
          <nav className="ml-3 hidden items-center gap-1 border-l border-white/20 pl-3 sm:flex">
            <Link
              href="/painel"
              className={`rounded px-2 py-1.5 text-xs font-semibold transition ${
                active === "dashboard" ? "border-b-2 border-gold text-white" : "text-white/60 hover:text-white"
              }`}
            >
              Área do membro
            </Link>
            <Link
              href="/painel/carteira"
              className={`rounded px-2 py-1.5 text-xs font-semibold transition ${
                active === "carteira" ? "border-b-2 border-gold text-white" : "text-white/60 hover:text-white"
              }`}
            >
              Carteira Digital
            </Link>
            <Link
              href="/painel/cecmais/explorar"
              className={`rounded px-2 py-1.5 text-xs font-semibold transition ${
                active === "cecmais" ? "border-b-2 border-gold text-white" : "text-white/60 hover:text-white"
              }`}
            >
              CEC<Mais className="text-sm" />
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button asChild variant="outline" size="sm" className="border-gold/80 bg-transparent text-gold hover:bg-gold/10 hover:text-gold">
              <Link href="/admin">Administração ✦</Link>
            </Button>
          )}
          <Button onClick={onSignOut} variant="outline" size="sm" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
            <LogOut className="mr-1 h-3.5 w-3.5" /> Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
