"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

/**
 * Shell do grupo (workspaces). Navegação entre workspaces é provisória —
 * lista só os que já foram migrados. A navegação definitiva dos 7 workspaces
 * (Executivo, Organizacional, Pessoas, Operacional, Comunicação, Recursos,
 * Governança) é uma decisão de design em aberto — ver
 * CONTEXTO_NOVO_CHAT_CEC_FAMILY_V3.md.
 */
const MIGRATED_WORKSPACES = [
  { href: "/executivo", label: "Executivo" },
  { href: "/organizacional", label: "Organizacional" },
  { href: "/pessoas", label: "Pessoas" },
  { href: "/recursos", label: "Recursos" },
  { href: "/governanca", label: "Governança" },
];

export function WorkspaceShell({
  title,
  userName,
  children,
}: {
  title: string;
  userName?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/entrar";
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-14 items-center justify-between border-b-[3px] border-gold bg-navy px-4 text-white">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm" className="text-white/70 hover:bg-white/10 hover:text-white">
            <Link href="/admin"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Painel</Link>
          </Button>
          <span className="font-display text-sm font-semibold">CEC Family · {title}</span>
          <nav className="hidden items-center gap-1 md:flex">
            {MIGRATED_WORKSPACES.map((w) => (
              <Link
                key={w.href}
                href={w.href}
                className={[
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  pathname === w.href ? "bg-gold/15 text-gold" : "text-white/50 hover:bg-white/8 hover:text-white",
                ].join(" ")}
              >
                {w.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/60">
          {userName && <span>{userName}</span>}
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-white/60 hover:bg-white/10 hover:text-white">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
