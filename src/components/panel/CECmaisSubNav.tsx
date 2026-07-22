"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/painel/cecmais", label: "Início" },
  { href: "/painel/cecmais/explorar", label: "Explorar" },
  { href: "/painel/cecmais/minha-area", label: "Minha Área" },
];

export function CECmaisSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b pb-2">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              active ? "bg-navy text-white" : "text-navy/60 hover:bg-muted"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
