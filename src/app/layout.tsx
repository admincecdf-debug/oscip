import "./globals.css";
import type { Metadata } from "next";
import { QueryProvider } from "@/components/layout/QueryProvider";

export const metadata: Metadata = {
  title: "CEC Family",
  description: "Plataforma apostólica da CEC Manaus — discipulado, células e gestão pastoral",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body><QueryProvider>{children}</QueryProvider></body>
    </html>
  );
}
